/**
 * Custom TURN Server Implementation
 * Provides relay services for peer-to-peer connections when direct connection fails
 * Implements RFC 5766 TURN protocol for media relay
 */

import { createSocket } from 'dgram';
import { createHash, randomBytes } from 'crypto';
import STUNServer from './stun-server.js';

class TURNServer extends STUNServer {
  constructor(port = 3479) {
    super(port);
    
    // TURN-specific message types
    this.MESSAGE_TYPES = {
      ...this.MESSAGE_TYPES,
      ALLOCATE_REQUEST: 0x0003,
      ALLOCATE_RESPONSE: 0x0103,
      ALLOCATE_ERROR: 0x0113,
      REFRESH_REQUEST: 0x0004,
      REFRESH_RESPONSE: 0x0104,
      SEND_INDICATION: 0x0016,
      DATA_INDICATION: 0x0017,
      CREATE_PERMISSION_REQUEST: 0x0008,
      CREATE_PERMISSION_RESPONSE: 0x0108,
      CHANNEL_BIND_REQUEST: 0x0009,
      CHANNEL_BIND_RESPONSE: 0x0109
    };

    // TURN-specific attributes
    this.ATTRIBUTES = {
      ...this.ATTRIBUTES,
      LIFETIME: 0x000D,
      DATA: 0x0013,
      XOR_PEER_ADDRESS: 0x0012,
      XOR_RELAYED_ADDRESS: 0x0016,
      REQUESTED_TRANSPORT: 0x0019,
      REALM: 0x0014,
      NONCE: 0x0015,
      USERNAME: 0x0006,
      MESSAGE_INTEGRITY: 0x0008
    };

    // TURN allocations and permissions
    this.allocations = new Map(); // client -> allocation info
    this.relayEndpoints = new Map(); // relay port -> allocation
    this.permissions = new Map(); // allocation -> set of allowed peers
    
    // Configuration
    this.realm = 'p2p-turn-server';
    this.credentials = new Map(); // username -> password
    this.defaultLifetime = 600; // 10 minutes
    this.maxLifetime = 3600; // 1 hour
    
    // Add default credentials (in production, use proper user management)
    this.credentials.set('user', 'pass');
  }

  /**
   * Start the TURN server
   */
  async start() {
    try {
      this.socket = createSocket('udp4');
      
      this.socket.on('message', (msg, rinfo) => {
        this.handleTURNMessage(msg, rinfo);
      });

      this.socket.on('error', (error) => {
        console.error('❌ TURN server error:', error);
      });

      this.socket.bind(this.port, () => {
        console.log(`🔄 TURN server listening on UDP port ${this.port}`);
      });

      // Start cleanup timer for expired allocations
      this.startCleanupTimer();

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } catch (error) {
      console.error('❌ Failed to start TURN server:', error);
      process.exit(1);
    }
  }

  /**
   * Handle TURN messages (extends STUN message handling)
   */
  handleTURNMessage(message, remoteInfo) {
    try {
      if (message.length < 20) {
        console.warn('⚠️ Received invalid TURN message (too short)');
        return;
      }

      const turnMessage = this.parseSTUNMessage(message);
      
      if (!turnMessage) {
        console.warn('⚠️ Failed to parse TURN message');
        return;
      }

      console.log(`📨 TURN request from ${remoteInfo.address}:${remoteInfo.port}, type: ${turnMessage.type}`);

      switch (turnMessage.type) {
        case this.MESSAGE_TYPES.BINDING_REQUEST:
          this.handleBindingRequest(turnMessage, remoteInfo);
          break;
        
        case this.MESSAGE_TYPES.ALLOCATE_REQUEST:
          this.handleAllocateRequest(turnMessage, remoteInfo);
          break;
        
        case this.MESSAGE_TYPES.REFRESH_REQUEST:
          this.handleRefreshRequest(turnMessage, remoteInfo);
          break;
        
        case this.MESSAGE_TYPES.SEND_INDICATION:
          this.handleSendIndication(turnMessage, remoteInfo);
          break;
        
        case this.MESSAGE_TYPES.CREATE_PERMISSION_REQUEST:
          this.handleCreatePermissionRequest(turnMessage, remoteInfo);
          break;
        
        default:
          console.warn(`⚠️ Unsupported TURN message type: ${turnMessage.type}`);
      }

    } catch (error) {
      console.error('❌ Error handling TURN message:', error);
    }
  }

  /**
   * Handle ALLOCATE_REQUEST
   */
  handleAllocateRequest(message, remoteInfo) {
    try {
      const clientKey = `${remoteInfo.address}:${remoteInfo.port}`;
      
      // Check if client already has an allocation
      if (this.allocations.has(clientKey)) {
        this.sendErrorResponse(message.transactionId, 437, 'Allocation Already Exists', remoteInfo);
        return;
      }

      // Validate authentication (simplified for demo)
      const username = this.getAttributeValue(message.attributes, this.ATTRIBUTES.USERNAME);
      if (!username || !this.validateCredentials(username)) {
        this.sendErrorResponse(message.transactionId, 401, 'Unauthorized', remoteInfo);
        return;
      }

      // Get requested transport protocol
      const transportAttr = this.getAttributeValue(message.attributes, this.ATTRIBUTES.REQUESTED_TRANSPORT);
      if (!transportAttr || transportAttr[0] !== 17) { // UDP protocol number
        this.sendErrorResponse(message.transactionId, 442, 'Unsupported Transport Protocol', remoteInfo);
        return;
      }

      // Create relay allocation
      const relayPort = this.allocateRelayPort();
      if (!relayPort) {
        this.sendErrorResponse(message.transactionId, 508, 'Insufficient Capacity', remoteInfo);
        return;
      }

      const allocation = {
        clientAddress: remoteInfo.address,
        clientPort: remoteInfo.port,
        relayPort: relayPort,
        username: username.toString(),
        createdAt: Date.now(),
        expiresAt: Date.now() + (this.defaultLifetime * 1000),
        lifetime: this.defaultLifetime
      };

      this.allocations.set(clientKey, allocation);
      this.relayEndpoints.set(relayPort, allocation);
      this.permissions.set(clientKey, new Set());

      // Send successful response
      this.sendAllocateResponse(message.transactionId, allocation, remoteInfo);
      
      console.log(`✅ Created TURN allocation for ${clientKey}, relay port: ${relayPort}`);

    } catch (error) {
      console.error('❌ Error handling allocate request:', error);
      this.sendErrorResponse(message.transactionId, 500, 'Server Error', remoteInfo);
    }
  }

  /**
   * Handle REFRESH_REQUEST
   */
  handleRefreshRequest(message, remoteInfo) {
    try {
      const clientKey = `${remoteInfo.address}:${remoteInfo.port}`;
      const allocation = this.allocations.get(clientKey);

      if (!allocation) {
        this.sendErrorResponse(message.transactionId, 437, 'Allocation Does Not Exist', remoteInfo);
        return;
      }

      // Get requested lifetime
      const lifetimeAttr = this.getAttributeValue(message.attributes, this.ATTRIBUTES.LIFETIME);
      let requestedLifetime = this.defaultLifetime;
      
      if (lifetimeAttr && lifetimeAttr.length >= 4) {
        requestedLifetime = lifetimeAttr.readUInt32BE(0);
      }

      // Limit lifetime to maximum
      const newLifetime = Math.min(requestedLifetime, this.maxLifetime);
      
      if (newLifetime === 0) {
        // Delete allocation
        this.deleteAllocation(clientKey);
        console.log(`🗑️ Deleted TURN allocation for ${clientKey}`);
      } else {
        // Update allocation lifetime
        allocation.lifetime = newLifetime;
        allocation.expiresAt = Date.now() + (newLifetime * 1000);
      }

      // Send refresh response
      this.sendRefreshResponse(message.transactionId, newLifetime, remoteInfo);

    } catch (error) {
      console.error('❌ Error handling refresh request:', error);
      this.sendErrorResponse(message.transactionId, 500, 'Server Error', remoteInfo);
    }
  }

  /**
   * Handle SEND_INDICATION
   */
  handleSendIndication(message, remoteInfo) {
    try {
      const clientKey = `${remoteInfo.address}:${remoteInfo.port}`;
      const allocation = this.allocations.get(clientKey);

      if (!allocation) {
        console.warn(`⚠️ Send indication from non-allocated client: ${clientKey}`);
        return;
      }

      // Get peer address and data
      const peerAddressAttr = this.getAttributeValue(message.attributes, this.ATTRIBUTES.XOR_PEER_ADDRESS);
      const dataAttr = this.getAttributeValue(message.attributes, this.ATTRIBUTES.DATA);

      if (!peerAddressAttr || !dataAttr) {
        console.warn('⚠️ Send indication missing required attributes');
        return;
      }

      const peerAddress = this.parseXorAddress(peerAddressAttr, message.transactionId);
      
      // Check permissions
      const permissions = this.permissions.get(clientKey);
      const peerKey = `${peerAddress.address}:${peerAddress.port}`;
      
      if (!permissions.has(peerKey)) {
        console.warn(`⚠️ No permission for peer: ${peerKey}`);
        return;
      }

      // Relay data to peer
      this.socket.send(dataAttr, peerAddress.port, peerAddress.address, (error) => {
        if (error) {
          console.error(`❌ Failed to relay data to ${peerKey}:`, error);
        } else {
          console.log(`📤 Relayed data from ${clientKey} to ${peerKey}`);
        }
      });

    } catch (error) {
      console.error('❌ Error handling send indication:', error);
    }
  }

  /**
   * Handle CREATE_PERMISSION_REQUEST
   */
  handleCreatePermissionRequest(message, remoteInfo) {
    try {
      const clientKey = `${remoteInfo.address}:${remoteInfo.port}`;
      const allocation = this.allocations.get(clientKey);

      if (!allocation) {
        this.sendErrorResponse(message.transactionId, 437, 'Allocation Does Not Exist', remoteInfo);
        return;
      }

      // Get peer address
      const peerAddressAttr = this.getAttributeValue(message.attributes, this.ATTRIBUTES.XOR_PEER_ADDRESS);
      if (!peerAddressAttr) {
        this.sendErrorResponse(message.transactionId, 400, 'Bad Request', remoteInfo);
        return;
      }

      const peerAddress = this.parseXorAddress(peerAddressAttr, message.transactionId);
      const peerKey = `${peerAddress.address}:${peerAddress.port}`;

      // Add permission
      const permissions = this.permissions.get(clientKey);
      permissions.add(peerKey);

      // Send success response
      this.sendCreatePermissionResponse(message.transactionId, remoteInfo);
      
      console.log(`✅ Created permission for ${clientKey} -> ${peerKey}`);

    } catch (error) {
      console.error('❌ Error handling create permission request:', error);
      this.sendErrorResponse(message.transactionId, 500, 'Server Error', remoteInfo);
    }
  }

  /**
   * Send ALLOCATE_RESPONSE
   */
  sendAllocateResponse(transactionId, allocation, remoteInfo) {
    const relayedAddress = this.createXorRelayedAddress('127.0.0.1', allocation.relayPort, transactionId);
    const lifetime = this.createLifetimeAttribute(allocation.lifetime);
    const messageLength = relayedAddress.length + lifetime.length;

    const header = Buffer.allocUnsafe(20);
    header.writeUInt16BE(this.MESSAGE_TYPES.ALLOCATE_RESPONSE, 0);
    header.writeUInt16BE(messageLength, 2);
    header.writeUInt32BE(this.MAGIC_COOKIE, 4);
    transactionId.copy(header, 8);

    const response = Buffer.concat([header, relayedAddress, lifetime]);
    this.socket.send(response, remoteInfo.port, remoteInfo.address);
  }

  /**
   * Send REFRESH_RESPONSE
   */
  sendRefreshResponse(transactionId, lifetime, remoteInfo) {
    const lifetimeAttr = this.createLifetimeAttribute(lifetime);
    const messageLength = lifetimeAttr.length;

    const header = Buffer.allocUnsafe(20);
    header.writeUInt16BE(this.MESSAGE_TYPES.REFRESH_RESPONSE, 0);
    header.writeUInt16BE(messageLength, 2);
    header.writeUInt32BE(this.MAGIC_COOKIE, 4);
    transactionId.copy(header, 8);

    const response = Buffer.concat([header, lifetimeAttr]);
    this.socket.send(response, remoteInfo.port, remoteInfo.address);
  }

  /**
   * Send CREATE_PERMISSION_RESPONSE
   */
  sendCreatePermissionResponse(transactionId, remoteInfo) {
    const header = Buffer.allocUnsafe(20);
    header.writeUInt16BE(this.MESSAGE_TYPES.CREATE_PERMISSION_RESPONSE, 0);
    header.writeUInt16BE(0, 2); // No attributes
    header.writeUInt32BE(this.MAGIC_COOKIE, 4);
    transactionId.copy(header, 8);

    this.socket.send(header, remoteInfo.port, remoteInfo.address);
  }

  /**
   * Send error response
   */
  sendErrorResponse(transactionId, errorCode, reason, remoteInfo) {
    const errorAttr = this.createErrorCodeAttribute(errorCode, reason);
    const messageLength = errorAttr.length;

    const header = Buffer.allocUnsafe(20);
    header.writeUInt16BE(this.MESSAGE_TYPES.ALLOCATE_ERROR, 0);
    header.writeUInt16BE(messageLength, 2);
    header.writeUInt32BE(this.MAGIC_COOKIE, 4);
    transactionId.copy(header, 8);

    const response = Buffer.concat([header, errorAttr]);
    this.socket.send(response, remoteInfo.port, remoteInfo.address);
  }

  /**
   * Create XOR-RELAYED-ADDRESS attribute
   */
  createXorRelayedAddress(address, port, transactionId) {
    const attr = Buffer.allocUnsafe(12);
    
    attr.writeUInt16BE(this.ATTRIBUTES.XOR_RELAYED_ADDRESS, 0);
    attr.writeUInt16BE(8, 2);
    attr.writeUInt16BE(0x01, 4); // IPv4
    
    const xorPort = port ^ (this.MAGIC_COOKIE >> 16);
    attr.writeUInt16BE(xorPort, 6);
    
    const addressParts = address.split('.').map(part => parseInt(part));
    const addressInt = (addressParts[0] << 24) | (addressParts[1] << 16) | 
                      (addressParts[2] << 8) | addressParts[3];
    const xorAddress = addressInt ^ this.MAGIC_COOKIE;
    attr.writeUInt32BE(xorAddress, 8);

    return attr;
  }

  /**
   * Create LIFETIME attribute
   */
  createLifetimeAttribute(lifetime) {
    const attr = Buffer.allocUnsafe(8);
    attr.writeUInt16BE(this.ATTRIBUTES.LIFETIME, 0);
    attr.writeUInt16BE(4, 2);
    attr.writeUInt32BE(lifetime, 4);
    return attr;
  }

  /**
   * Create ERROR-CODE attribute
   */
  createErrorCodeAttribute(code, reason) {
    const reasonBuffer = Buffer.from(reason, 'utf8');
    const paddedLength = reasonBuffer.length + (4 - (reasonBuffer.length % 4)) % 4;
    
    const attr = Buffer.allocUnsafe(8 + paddedLength);
    attr.writeUInt16BE(this.ATTRIBUTES.ERROR_CODE, 0);
    attr.writeUInt16BE(4 + reasonBuffer.length, 2);
    attr.writeUInt16BE(0, 4); // Reserved
    attr.writeUInt8(Math.floor(code / 100), 6); // Class
    attr.writeUInt8(code % 100, 7); // Number
    
    reasonBuffer.copy(attr, 8);
    attr.fill(0, 8 + reasonBuffer.length);

    return attr;
  }

  /**
   * Parse XOR address
   */
  parseXorAddress(buffer, transactionId) {
    const family = buffer.readUInt16BE(0);
    const xorPort = buffer.readUInt16BE(2);
    const xorAddress = buffer.readUInt32BE(4);
    
    const port = xorPort ^ (this.MAGIC_COOKIE >> 16);
    const addressInt = xorAddress ^ this.MAGIC_COOKIE;
    
    const address = [
      (addressInt >> 24) & 0xFF,
      (addressInt >> 16) & 0xFF,
      (addressInt >> 8) & 0xFF,
      addressInt & 0xFF
    ].join('.');

    return { address, port };
  }

  /**
   * Get attribute value by type
   */
  getAttributeValue(attributes, type) {
    const attr = attributes.find(a => a.type === type);
    return attr ? attr.value : null;
  }

  /**
   * Validate credentials (simplified)
   */
  validateCredentials(username) {
    return this.credentials.has(username.toString());
  }

  /**
   * Allocate a relay port
   */
  allocateRelayPort() {
    // Simple port allocation (in production, use proper port management)
    for (let port = 49152; port <= 65535; port++) {
      if (!this.relayEndpoints.has(port)) {
        return port;
      }
    }
    return null;
  }

  /**
   * Delete allocation
   */
  deleteAllocation(clientKey) {
    const allocation = this.allocations.get(clientKey);
    if (allocation) {
      this.allocations.delete(clientKey);
      this.relayEndpoints.delete(allocation.relayPort);
      this.permissions.delete(clientKey);
    }
  }

  /**
   * Start cleanup timer for expired allocations
   */
  startCleanupTimer() {
    setInterval(() => {
      const now = Date.now();
      const expiredAllocations = [];

      for (const [clientKey, allocation] of this.allocations.entries()) {
        if (now > allocation.expiresAt) {
          expiredAllocations.push(clientKey);
        }
      }

      expiredAllocations.forEach(clientKey => {
        this.deleteAllocation(clientKey);
        console.log(`🗑️ Cleaned up expired allocation: ${clientKey}`);
      });

    }, 60000); // Check every minute
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    console.log('🛑 Shutting down TURN server...');
    
    // Clean up all allocations
    this.allocations.clear();
    this.relayEndpoints.clear();
    this.permissions.clear();
    
    if (this.socket) {
      this.socket.close(() => {
        console.log('✅ TURN server shut down gracefully');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new TURNServer(process.env.TURN_PORT || 3479);
  server.start();
}

export default TURNServer;