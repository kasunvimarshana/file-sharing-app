import dgram from 'dgram';
import { logger } from './logger.js';
import { config } from './config.js';

export class TURNServer {
  constructor() {
    this.socket = null;
    this.allocations = new Map();
    this.permissions = new Map();
    this.stats = {
      allocateRequests: 0,
      refreshRequests: 0,
      sendIndications: 0,
      dataIndications: 0,
      errors: 0
    };
    
    // Cleanup interval
    this.cleanupInterval = null;
  }

  start(port) {
    try {
      this.socket = dgram.createSocket('udp4');
      
      this.socket.bind(port);
      
      this.socket.on('message', (msg, rinfo) => {
        this.handleTURNMessage(msg, rinfo);
      });

      this.socket.on('listening', () => {
        const address = this.socket.address();
        logger.info(`TURN server listening on ${address.address}:${address.port}`);
      });

      this.socket.on('error', (err) => {
        logger.error('TURN server error:', err);
        this.stats.errors++;
      });

      this.socket.on('close', () => {
        logger.info('TURN server closed');
      });

      // Start cleanup task
      this.cleanupInterval = setInterval(() => {
        this.cleanupExpiredAllocations();
      }, 60000); // Every minute

      // Periodic stats logging
      setInterval(() => {
        if (this.stats.allocateRequests > 0) {
          logger.debug('TURN server stats:', this.stats);
        }
      }, 60000); // Every minute

    } catch (error) {
      logger.error('Failed to start TURN server:', error);
      throw error;
    }
  }

  handleTURNMessage(message, rinfo) {
    try {
      if (message.length < 20) {
        logger.warn(`TURN message too short: ${message.length} bytes from ${rinfo.address}:${rinfo.port}`);
        return;
      }

      const turnMessage = this.parseSTUNMessage(message);
      
      switch (turnMessage.messageType) {
        case 0x0003: // Allocate Request
          this.stats.allocateRequests++;
          this.handleAllocateRequest(turnMessage, rinfo);
          break;
        case 0x0004: // Refresh Request
          this.stats.refreshRequests++;
          this.handleRefreshRequest(turnMessage, rinfo);
          break;
        case 0x0016: // Send Indication
          this.stats.sendIndications++;
          this.handleSendIndication(turnMessage, rinfo);
          break;
        case 0x0017: // Data Indication
          this.stats.dataIndications++;
          this.handleDataIndication(turnMessage, rinfo);
          break;
        default:
          logger.debug(`Unsupported TURN message type: 0x${turnMessage.messageType.toString(16)} from ${rinfo.address}:${rinfo.port}`);
      }
    } catch (error) {
      logger.error(`Error handling TURN message from ${rinfo.address}:${rinfo.port}:`, error);
      this.stats.errors++;
    }
  }

  parseSTUNMessage(buffer) {
    try {
      const messageType = buffer.readUInt16BE(0);
      const messageLength = buffer.readUInt16BE(2);
      const magicCookie = buffer.readUInt32BE(4);
      const transactionId = buffer.subarray(8, 20);

      // Validate magic cookie
      if (magicCookie !== 0x2112A442) {
        throw new Error(`Invalid magic cookie: 0x${magicCookie.toString(16)}`);
      }

      return {
        messageType,
        messageLength,
        magicCookie,
        transactionId,
        attributes: this.parseAttributes(buffer.subarray(20))
      };
    } catch (error) {
      logger.error('Error parsing TURN message:', error);
      throw error;
    }
  }

  parseAttributes(buffer) {
    const attributes = [];
    let offset = 0;

    while (offset < buffer.length) {
      if (offset + 4 > buffer.length) {
        break;
      }

      const type = buffer.readUInt16BE(offset);
      const length = buffer.readUInt16BE(offset + 2);
      
      if (offset + 4 + length > buffer.length) {
        break;
      }

      const value = buffer.subarray(offset + 4, offset + 4 + length);
      attributes.push({ type, length, value });
      
      // Move to next attribute (with padding)
      const paddedLength = Math.ceil(length / 4) * 4;
      offset += 4 + paddedLength;
    }

    return attributes;
  }

  handleAllocateRequest(request, rinfo) {
    try {
      // Simple authentication check (in production, implement proper auth)
      const usernameAttr = request.attributes.find(attr => attr.type === 0x0006);
      if (!usernameAttr || usernameAttr.value.toString() !== config.turnUsername) {
        this.sendErrorResponse(request, rinfo, 401, 'Unauthorized');
        return;
      }

      const allocationId = this.generateAllocationId();
      const relayAddress = { 
        address: '127.0.0.1', 
        port: 50000 + Math.floor(Math.random() * 10000) 
      };
      
      this.allocations.set(allocationId, {
        clientAddress: rinfo,
        relayAddress,
        lifetime: 600, // 10 minutes
        createdAt: Date.now(),
        lastRefresh: Date.now()
      });

      const response = this.createAllocateResponse(request, relayAddress);
      this.socket.send(response, rinfo.port, rinfo.address, (err) => {
        if (err) {
          logger.error(`Failed to send TURN allocate response to ${rinfo.address}:${rinfo.port}:`, err);
          this.stats.errors++;
        } else {
          logger.debug(`TURN allocation created for ${rinfo.address}:${rinfo.port}, relay: ${relayAddress.address}:${relayAddress.port}`);
        }
      });
    } catch (error) {
      logger.error('Error handling TURN allocate request:', error);
      this.stats.errors++;
    }
  }

  handleRefreshRequest(request, rinfo) {
    try {
      // Find allocation for this client
      const allocation = Array.from(this.allocations.values())
        .find(alloc => alloc.clientAddress.address === rinfo.address && 
                      alloc.clientAddress.port === rinfo.port);
      
      if (allocation) {
        allocation.lifetime = 600; // Refresh lifetime
        allocation.lastRefresh = Date.now();
        logger.debug(`TURN allocation refreshed for ${rinfo.address}:${rinfo.port}`);
      }

      const response = this.createRefreshResponse(request);
      this.socket.send(response, rinfo.port, rinfo.address, (err) => {
        if (err) {
          logger.error(`Failed to send TURN refresh response to ${rinfo.address}:${rinfo.port}:`, err);
          this.stats.errors++;
        }
      });
    } catch (error) {
      logger.error('Error handling TURN refresh request:', error);
      this.stats.errors++;
    }
  }

  handleSendIndication(indication, rinfo) {
    try {
      // Handle data forwarding through TURN relay
      const dataAttr = indication.attributes.find(attr => attr.type === 0x0013);
      const peerAddrAttr = indication.attributes.find(attr => attr.type === 0x0012);
      
      if (dataAttr && peerAddrAttr) {
        const peerAddress = this.parseXORPeerAddress(peerAddrAttr.value);
        if (peerAddress) {
          // In a real implementation, forward data to peer
          logger.debug(`TURN relay data from ${rinfo.address}:${rinfo.port} to ${peerAddress.address}:${peerAddress.port} (${dataAttr.length} bytes)`);
        }
      }
    } catch (error) {
      logger.error('Error handling TURN send indication:', error);
      this.stats.errors++;
    }
  }

  handleDataIndication(indication, rinfo) {
    try {
      // Handle incoming data from peers
      logger.debug(`TURN received data indication from ${rinfo.address}:${rinfo.port}`);
    } catch (error) {
      logger.error('Error handling TURN data indication:', error);
      this.stats.errors++;
    }
  }

  generateAllocationId() {
    return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  }

  createAllocateResponse(request, relayAddress) {
    try {
      const responseBuffer = Buffer.alloc(64);
      
      // Message Type: Allocate Success Response (0x0103)
      responseBuffer.writeUInt16BE(0x0103, 0);
      
      // Message Length: will be calculated
      responseBuffer.writeUInt16BE(44, 2);
      
      // Magic Cookie
      responseBuffer.writeUInt32BE(0x2112A442, 4);
      
      // Transaction ID
      request.transactionId.copy(responseBuffer, 8);
      
      // XOR-RELAYED-ADDRESS attribute (0x0016)
      responseBuffer.writeUInt16BE(0x0016, 20);
      responseBuffer.writeUInt16BE(8, 22);
      responseBuffer.writeUInt8(0, 24);
      responseBuffer.writeUInt8(0x01, 25); // IPv4
      
      const xorPort = relayAddress.port ^ 0x2112;
      responseBuffer.writeUInt16BE(xorPort, 26);
      
      const addressParts = relayAddress.address.split('.').map(Number);
      const addressInt = (addressParts[0] << 24) | (addressParts[1] << 16) | 
                       (addressParts[2] << 8) | addressParts[3];
      const xorAddress = (addressInt ^ 0x2112A442) >>> 0;
      responseBuffer.writeUInt32BE(xorAddress, 28);
      
      // LIFETIME attribute (0x000D)
      responseBuffer.writeUInt16BE(0x000D, 32);
      responseBuffer.writeUInt16BE(4, 34);
      responseBuffer.writeUInt32BE(600, 36); // 10 minutes
      
      // XOR-MAPPED-ADDRESS attribute (0x0020)
      responseBuffer.writeUInt16BE(0x0020, 40);
      responseBuffer.writeUInt16BE(8, 42);
      responseBuffer.writeUInt8(0, 44);
      responseBuffer.writeUInt8(0x01, 45);
      responseBuffer.writeUInt16BE(xorPort, 46);
      responseBuffer.writeUInt32BE(xorAddress, 48);
      
      return responseBuffer.subarray(0, 52);
    } catch (error) {
      logger.error('Error creating TURN allocate response:', error);
      this.stats.errors++;
      return null;
    }
  }

  createRefreshResponse(request) {
    try {
      const responseBuffer = Buffer.alloc(32);
      
      // Message Type: Refresh Success Response (0x0104)
      responseBuffer.writeUInt16BE(0x0104, 0);
      responseBuffer.writeUInt16BE(12, 2);
      responseBuffer.writeUInt32BE(0x2112A442, 4);
      request.transactionId.copy(responseBuffer, 8);
      
      // LIFETIME attribute
      responseBuffer.writeUInt16BE(0x000D, 20);
      responseBuffer.writeUInt16BE(4, 22);
      responseBuffer.writeUInt32BE(600, 24);
      
      return responseBuffer.subarray(0, 28);
    } catch (error) {
      logger.error('Error creating TURN refresh response:', error);
      this.stats.errors++;
      return null;
    }
  }

  sendErrorResponse(request, rinfo, errorCode, reasonPhrase) {
    try {
      const reasonBuffer = Buffer.from(reasonPhrase, 'utf8');
      const responseBuffer = Buffer.alloc(32 + reasonBuffer.length);
      
      // Message Type: Error Response
      responseBuffer.writeUInt16BE(0x0111, 0);
      responseBuffer.writeUInt16BE(12 + reasonBuffer.length, 2);
      responseBuffer.writeUInt32BE(0x2112A442, 4);
      request.transactionId.copy(responseBuffer, 8);
      
      // ERROR-CODE attribute
      responseBuffer.writeUInt16BE(0x0009, 20);
      responseBuffer.writeUInt16BE(4 + reasonBuffer.length, 22);
      responseBuffer.writeUInt16BE(0, 24); // Reserved
      responseBuffer.writeUInt8(Math.floor(errorCode / 100), 26); // Class
      responseBuffer.writeUInt8(errorCode % 100, 27); // Number
      reasonBuffer.copy(responseBuffer, 28);
      
      this.socket.send(responseBuffer, rinfo.port, rinfo.address);
    } catch (error) {
      logger.error('Error sending TURN error response:', error);
      this.stats.errors++;
    }
  }

  parseXORPeerAddress(buffer) {
    try {
      if (buffer.length < 8) return null;
      
      const family = buffer.readUInt8(1);
      const port = buffer.readUInt16BE(2) ^ 0x2112;
      
      if (family === 0x01) { // IPv4
        const addressInt = buffer.readUInt32BE(4) ^ 0x2112A442;
        const address = [
          (addressInt >>> 24) & 0xFF,
          (addressInt >>> 16) & 0xFF,
          (addressInt >>> 8) & 0xFF,
          addressInt & 0xFF
        ].join('.');
        
        return { address, port };
      }
      
      return null;
    } catch (error) {
      logger.error('Error parsing XOR peer address:', error);
      return null;
    }
  }

  cleanupExpiredAllocations() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [allocationId, allocation] of this.allocations.entries()) {
      const age = now - allocation.lastRefresh;
      const lifetimeMs = allocation.lifetime * 1000;
      
      if (age > lifetimeMs) {
        this.allocations.delete(allocationId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} expired TURN allocations`);
    }
  }

  getStats() {
    return { 
      ...this.stats,
      activeAllocations: this.allocations.size
    };
  }

  stop() {
    if (this.socket) {
      logger.info('Stopping TURN server...');
      
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
      
      this.socket.close();
      this.socket = null;
      this.allocations.clear();
      this.permissions.clear();
    }
  }
}