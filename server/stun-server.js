import dgram from 'dgram';
import { logger } from './logger.js';
import { config } from './config.js';

export class STUNServer {
  constructor() {
    this.socket = null;
    this.bindingResponses = new Map();
    this.stats = {
      requestsReceived: 0,
      responsesSet: 0,
      errors: 0
    };
  }

  start(port) {
    try {
      this.socket = dgram.createSocket('udp4');
      
      this.socket.bind(port);
      
      this.socket.on('message', (msg, rinfo) => {
        this.handleSTUNMessage(msg, rinfo);
      });

      this.socket.on('listening', () => {
        const address = this.socket.address();
        logger.info(`STUN server listening on ${address.address}:${address.port}`);
      });

      this.socket.on('error', (err) => {
        logger.error('STUN server error:', err);
        this.stats.errors++;
      });

      this.socket.on('close', () => {
        logger.info('STUN server closed');
      });

      // Periodic stats logging
      setInterval(() => {
        if (this.stats.requestsReceived > 0) {
          logger.debug('STUN server stats:', this.stats);
        }
      }, 60000); // Every minute

    } catch (error) {
      logger.error('Failed to start STUN server:', error);
      throw error;
    }
  }

  handleSTUNMessage(message, rinfo) {
    try {
      this.stats.requestsReceived++;
      
      if (message.length < 20) {
        logger.warn(`STUN message too short: ${message.length} bytes from ${rinfo.address}:${rinfo.port}`);
        return;
      }

      const stunMessage = this.parseSTUNMessage(message);
      
      if (stunMessage.messageType === 0x0001) { // Binding Request
        const response = this.createBindingResponse(stunMessage, rinfo);
        if (response) {
          this.socket.send(response, rinfo.port, rinfo.address, (err) => {
            if (err) {
              logger.error(`Failed to send STUN response to ${rinfo.address}:${rinfo.port}:`, err);
              this.stats.errors++;
            } else {
              this.stats.responsesSet++;
              logger.debug(`STUN binding response sent to ${rinfo.address}:${rinfo.port}`);
            }
          });
        }
      } else {
        logger.debug(`Unsupported STUN message type: 0x${stunMessage.messageType.toString(16)} from ${rinfo.address}:${rinfo.port}`);
      }
    } catch (error) {
      logger.error(`Error handling STUN message from ${rinfo.address}:${rinfo.port}:`, error);
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

      // Validate message length
      if (messageLength !== buffer.length - 20) {
        throw new Error(`Message length mismatch: expected ${messageLength}, got ${buffer.length - 20}`);
      }

      return {
        messageType,
        messageLength,
        magicCookie,
        transactionId,
        attributes: this.parseAttributes(buffer.subarray(20))
      };
    } catch (error) {
      logger.error('Error parsing STUN message:', error);
      throw error;
    }
  }

  parseAttributes(buffer) {
    const attributes = [];
    let offset = 0;

    while (offset < buffer.length) {
      if (offset + 4 > buffer.length) {
        logger.warn('Incomplete attribute header');
        break;
      }

      const type = buffer.readUInt16BE(offset);
      const length = buffer.readUInt16BE(offset + 2);
      
      if (offset + 4 + length > buffer.length) {
        logger.warn(`Incomplete attribute: type=${type}, length=${length}`);
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

  createBindingResponse(request, rinfo) {
    try {
      const responseBuffer = Buffer.alloc(32); // Basic response size
      
      // Message Type: Binding Success Response (0x0101)
      responseBuffer.writeUInt16BE(0x0101, 0);
      
      // Message Length: 12 bytes (XOR-MAPPED-ADDRESS attribute)
      responseBuffer.writeUInt16BE(12, 2);
      
      // Magic Cookie
      responseBuffer.writeUInt32BE(0x2112A442, 4);
      
      // Transaction ID (copy from request)
      request.transactionId.copy(responseBuffer, 8);
      
      // XOR-MAPPED-ADDRESS attribute
      responseBuffer.writeUInt16BE(0x0020, 20); // Attribute type
      responseBuffer.writeUInt16BE(8, 22); // Attribute length
      responseBuffer.writeUInt8(0, 24); // Reserved
      responseBuffer.writeUInt8(0x01, 25); // Address family (IPv4)
      
      // XOR port
      const xorPort = rinfo.port ^ 0x2112;
      responseBuffer.writeUInt16BE(xorPort, 26);
      
      // XOR address
      const addressParts = rinfo.address.split('.').map(Number);
      if (addressParts.length !== 4 || addressParts.some(part => isNaN(part) || part < 0 || part > 255)) {
        throw new Error(`Invalid IP address: ${rinfo.address}`);
      }
      
      const addressInt = (addressParts[0] << 24) | (addressParts[1] << 16) | 
                       (addressParts[2] << 8) | addressParts[3];
      const xorAddress = (addressInt ^ 0x2112A442) >>> 0; // Unsigned right shift
      responseBuffer.writeUInt32BE(xorAddress, 28);
      
      return responseBuffer;
    } catch (error) {
      logger.error('Error creating STUN binding response:', error);
      this.stats.errors++;
      return null;
    }
  }

  getStats() {
    return { ...this.stats };
  }

  stop() {
    if (this.socket) {
      logger.info('Stopping STUN server...');
      this.socket.close();
      this.socket = null;
    }
  }
}