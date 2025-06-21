/**
 * Custom STUN Server Implementation
 * Provides Network Address Translation (NAT) traversal services
 * Implements RFC 5389 STUN protocol for discovering public IP addresses
 */

import { createSocket } from 'dgram';
import { randomBytes } from 'crypto';

class STUNServer {
  constructor(port = 3478) {
    this.port = port;
    this.socket = null;
    
    // STUN message types
    this.MESSAGE_TYPES = {
      BINDING_REQUEST: 0x0001,
      BINDING_RESPONSE: 0x0101,
      BINDING_ERROR: 0x0111
    };

    // STUN attributes
    this.ATTRIBUTES = {
      MAPPED_ADDRESS: 0x0001,
      XOR_MAPPED_ADDRESS: 0x0020,
      ERROR_CODE: 0x0009,
      SOFTWARE: 0x8022
    };

    // Magic cookie for STUN messages
    this.MAGIC_COOKIE = 0x2112A442;
  }

  /**
   * Start the STUN server
   */
  async start() {
    try {
      this.socket = createSocket('udp4');
      
      this.socket.on('message', (msg, rinfo) => {
        this.handleMessage(msg, rinfo);
      });

      this.socket.on('error', (error) => {
        console.error('❌ STUN server error:', error);
      });

      this.socket.bind(this.port, () => {
        console.log(`🌐 STUN server listening on UDP port ${this.port}`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } catch (error) {
      console.error('❌ Failed to start STUN server:', error);
      process.exit(1);
    }
  }

  /**
   * Handle incoming STUN messages
   */
  handleMessage(message, remoteInfo) {
    try {
      if (message.length < 20) {
        console.warn('⚠️ Received invalid STUN message (too short)');
        return;
      }

      const stunMessage = this.parseSTUNMessage(message);
      
      if (!stunMessage) {
        console.warn('⚠️ Failed to parse STUN message');
        return;
      }

      console.log(`📨 STUN request from ${remoteInfo.address}:${remoteInfo.port}`);

      switch (stunMessage.type) {
        case this.MESSAGE_TYPES.BINDING_REQUEST:
          this.handleBindingRequest(stunMessage, remoteInfo);
          break;
        
        default:
          console.warn(`⚠️ Unsupported STUN message type: ${stunMessage.type}`);
      }

    } catch (error) {
      console.error('❌ Error handling STUN message:', error);
    }
  }

  /**
   * Parse STUN message from buffer
   */
  parseSTUNMessage(buffer) {
    try {
      // STUN header format:
      // 0-1: Message Type
      // 2-3: Message Length
      // 4-7: Magic Cookie
      // 8-19: Transaction ID

      const type = buffer.readUInt16BE(0);
      const length = buffer.readUInt16BE(2);
      const magicCookie = buffer.readUInt32BE(4);
      const transactionId = buffer.subarray(8, 20);

      // Verify magic cookie
      if (magicCookie !== this.MAGIC_COOKIE) {
        console.warn('⚠️ Invalid magic cookie in STUN message');
        return null;
      }

      // Parse attributes
      const attributes = this.parseAttributes(buffer.subarray(20, 20 + length));

      return {
        type,
        length,
        transactionId,
        attributes
      };

    } catch (error) {
      console.error('❌ Error parsing STUN message:', error);
      return null;
    }
  }

  /**
   * Parse STUN attributes
   */
  parseAttributes(buffer) {
    const attributes = [];
    let offset = 0;

    while (offset < buffer.length) {
      if (offset + 4 > buffer.length) break;

      const type = buffer.readUInt16BE(offset);
      const length = buffer.readUInt16BE(offset + 2);
      
      if (offset + 4 + length > buffer.length) break;

      const value = buffer.subarray(offset + 4, offset + 4 + length);
      
      attributes.push({ type, length, value });
      
      // Attributes are padded to 4-byte boundaries
      offset += 4 + length + (4 - (length % 4)) % 4;
    }

    return attributes;
  }

  /**
   * Handle BINDING_REQUEST
   */
  handleBindingRequest(stunMessage, remoteInfo) {
    try {
      // Create binding response
      const response = this.createBindingResponse(
        stunMessage.transactionId,
        remoteInfo.address,
        remoteInfo.port
      );

      // Send response
      this.socket.send(response, remoteInfo.port, remoteInfo.address, (error) => {
        if (error) {
          console.error('❌ Failed to send STUN response:', error);
        } else {
          console.log(`📤 STUN response sent to ${remoteInfo.address}:${remoteInfo.port}`);
        }
      });

    } catch (error) {
      console.error('❌ Error handling binding request:', error);
    }
  }

  /**
   * Create BINDING_RESPONSE message
   */
  createBindingResponse(transactionId, address, port) {
    // Calculate XOR-MAPPED-ADDRESS
    const xorAddress = this.createXorMappedAddress(address, port, transactionId);
    const softwareAttr = this.createSoftwareAttribute();

    // Calculate total message length
    const messageLength = xorAddress.length + softwareAttr.length;

    // Create STUN header
    const header = Buffer.allocUnsafe(20);
    header.writeUInt16BE(this.MESSAGE_TYPES.BINDING_RESPONSE, 0); // Message Type
    header.writeUInt16BE(messageLength, 2); // Message Length
    header.writeUInt32BE(this.MAGIC_COOKIE, 4); // Magic Cookie
    transactionId.copy(header, 8); // Transaction ID

    // Combine header and attributes
    return Buffer.concat([header, xorAddress, softwareAttr]);
  }

  /**
   * Create XOR-MAPPED-ADDRESS attribute
   */
  createXorMappedAddress(address, port, transactionId) {
    const attr = Buffer.allocUnsafe(12);
    
    // Attribute header
    attr.writeUInt16BE(this.ATTRIBUTES.XOR_MAPPED_ADDRESS, 0); // Type
    attr.writeUInt16BE(8, 2); // Length
    
    // Address family (IPv4)
    attr.writeUInt16BE(0x01, 4);
    
    // XOR port with first 16 bits of magic cookie
    const xorPort = port ^ (this.MAGIC_COOKIE >> 16);
    attr.writeUInt16BE(xorPort, 6);
    
    // XOR IPv4 address with magic cookie
    const addressParts = address.split('.').map(part => parseInt(part));
    const addressInt = (addressParts[0] << 24) | (addressParts[1] << 16) | 
                      (addressParts[2] << 8) | addressParts[3];
    const xorAddress = addressInt ^ this.MAGIC_COOKIE;
    attr.writeUInt32BE(xorAddress, 8);

    return attr;
  }

  /**
   * Create SOFTWARE attribute
   */
  createSoftwareAttribute() {
    const software = 'P2P-STUN-Server-v1.0';
    const softwareBuffer = Buffer.from(software, 'utf8');
    const paddedLength = softwareBuffer.length + (4 - (softwareBuffer.length % 4)) % 4;
    
    const attr = Buffer.allocUnsafe(4 + paddedLength);
    
    // Attribute header
    attr.writeUInt16BE(this.ATTRIBUTES.SOFTWARE, 0); // Type
    attr.writeUInt16BE(software.length, 2); // Length
    
    // Software string
    softwareBuffer.copy(attr, 4);
    
    // Padding with zeros
    attr.fill(0, 4 + softwareBuffer.length);

    return attr;
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    console.log('🛑 Shutting down STUN server...');
    
    if (this.socket) {
      this.socket.close(() => {
        console.log('✅ STUN server shut down gracefully');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new STUNServer(process.env.STUN_PORT || 3478);
  server.start();
}

export default STUNServer;