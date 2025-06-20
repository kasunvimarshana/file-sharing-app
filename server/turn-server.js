import dgram from 'dgram';
import crypto from 'crypto';

export class TURNServer {
  constructor() {
    this.socket = null;
    this.allocations = new Map();
    this.TURN_MAGIC_COOKIE = 0x2112A442;
    this.TURN_MESSAGE_TYPES = {
      ALLOCATE_REQUEST: 0x0003,
      ALLOCATE_RESPONSE: 0x0103,
      ALLOCATE_ERROR_RESPONSE: 0x0113,
      REFRESH_REQUEST: 0x0004,
      REFRESH_RESPONSE: 0x0104,
      SEND_INDICATION: 0x0016,
      DATA_INDICATION: 0x0017,
      CREATE_PERMISSION_REQUEST: 0x0008,
      CREATE_PERMISSION_RESPONSE: 0x0108
    };
    this.TURN_ATTRIBUTES = {
      MAPPED_ADDRESS: 0x0001,
      USERNAME: 0x0006,
      MESSAGE_INTEGRITY: 0x0008,
      ERROR_CODE: 0x0009,
      REALM: 0x0014,
      NONCE: 0x0015,
      XOR_RELAYED_ADDRESS: 0x0016,
      REQUESTED_TRANSPORT: 0x0019,
      XOR_MAPPED_ADDRESS: 0x0020,
      LIFETIME: 0x000D,
      DATA: 0x0013,
      XOR_PEER_ADDRESS: 0x0012
    };
    this.credentials = new Map([
      ['user', 'pass']
    ]);
  }

  start(port = 3479) {
    this.socket = dgram.createSocket('udp4');

    this.socket.on('message', (msg, rinfo) => {
      this.handleMessage(msg, rinfo);
    });

    this.socket.on('error', (err) => {
      console.error('TURN server error:', err);
    });

    this.socket.bind(port, () => {
      console.log(`TURN server listening on port ${port}`);
    });
  }

  handleMessage(msg, rinfo) {
    try {
      const turnMessage = this.parseTURNMessage(msg);
      
      switch (turnMessage.type) {
        case this.TURN_MESSAGE_TYPES.ALLOCATE_REQUEST:
          this.handleAllocateRequest(turnMessage, rinfo);
          break;
        case this.TURN_MESSAGE_TYPES.REFRESH_REQUEST:
          this.handleRefreshRequest(turnMessage, rinfo);
          break;
        case this.TURN_MESSAGE_TYPES.CREATE_PERMISSION_REQUEST:
          this.handleCreatePermissionRequest(turnMessage, rinfo);
          break;
        case this.TURN_MESSAGE_TYPES.SEND_INDICATION:
          this.handleSendIndication(turnMessage, rinfo);
          break;
        default:
          console.log(`Unhandled TURN message type: ${turnMessage.type}`);
      }
    } catch (error) {
      console.error('Failed to handle TURN message:', error);
    }
  }

  parseTURNMessage(buffer) {
    if (buffer.length < 20) {
      throw new Error('Invalid TURN message length');
    }

    const type = buffer.readUInt16BE(0);
    const length = buffer.readUInt16BE(2);
    const magicCookie = buffer.readUInt32BE(4);
    const transactionId = buffer.slice(8, 20);

    return {
      type,
      length,
      magicCookie,
      transactionId,
      attributes: this.parseAttributes(buffer.slice(20))
    };
  }

  parseAttributes(buffer) {
    const attributes = new Map();
    let offset = 0;

    while (offset < buffer.length) {
      if (offset + 4 > buffer.length) break;

      const type = buffer.readUInt16BE(offset);
      const length = buffer.readUInt16BE(offset + 2);
      const value = buffer.slice(offset + 4, offset + 4 + length);

      attributes.set(type, value);
      offset += 4 + length + (length % 4 === 0 ? 0 : 4 - (length % 4)); // Padding
    }

    return attributes;
  }

  handleAllocateRequest(request, rinfo) {
    // Simple authentication check
    const username = request.attributes.get(this.TURN_ATTRIBUTES.USERNAME);
    if (!username || !this.credentials.has(username.toString())) {
      this.sendErrorResponse(request, rinfo, 401, 'Unauthorized');
      return;
    }

    // Create allocation
    const allocationKey = `${rinfo.address}:${rinfo.port}`;
    const relayPort = 50000 + Math.floor(Math.random() * 10000);
    
    const allocation = {
      client: rinfo,
      relayPort: relayPort,
      lifetime: 600, // 10 minutes
      permissions: new Set(),
      created: Date.now()
    };

    this.allocations.set(allocationKey, allocation);

    // Send success response
    const response = this.createAllocateResponse(request, allocation);
    this.socket.send(response, rinfo.port, rinfo.address);
  }

  handleRefreshRequest(request, rinfo) {
    const allocationKey = `${rinfo.address}:${rinfo.port}`;
    const allocation = this.allocations.get(allocationKey);

    if (!allocation) {
      this.sendErrorResponse(request, rinfo, 437, 'Allocation Mismatch');
      return;
    }

    // Update lifetime
    allocation.lifetime = 600;
    allocation.created = Date.now();

    const response = this.createRefreshResponse(request);
    this.socket.send(response, rinfo.port, rinfo.address);
  }

  handleCreatePermissionRequest(request, rinfo) {
    const allocationKey = `${rinfo.address}:${rinfo.port}`;
    const allocation = this.allocations.get(allocationKey);

    if (!allocation) {
      this.sendErrorResponse(request, rinfo, 437, 'Allocation Mismatch');
      return;
    }

    const peerAddress = request.attributes.get(this.TURN_ATTRIBUTES.XOR_PEER_ADDRESS);
    if (peerAddress) {
      // Parse XOR peer address and add to permissions
      allocation.permissions.add(peerAddress.toString());
    }

    const response = this.createCreatePermissionResponse(request);
    this.socket.send(response, rinfo.port, rinfo.address);
  }

  handleSendIndication(request, rinfo) {
    const allocationKey = `${rinfo.address}:${rinfo.port}`;
    const allocation = this.allocations.get(allocationKey);

    if (!allocation) {
      return; // Silently ignore
    }

    const data = request.attributes.get(this.TURN_ATTRIBUTES.DATA);
    const peerAddress = request.attributes.get(this.TURN_ATTRIBUTES.XOR_PEER_ADDRESS);

    if (data && peerAddress) {
      // Forward data to peer (simplified implementation)
      console.log('Forwarding data via TURN relay');
    }
  }

  createAllocateResponse(request, allocation) {
    const response = Buffer.alloc(1024);
    let offset = 0;

    // TURN header
    response.writeUInt16BE(this.TURN_MESSAGE_TYPES.ALLOCATE_RESPONSE, offset);
    offset += 2;
    
    const lengthOffset = offset;
    offset += 2;
    
    response.writeUInt32BE(this.TURN_MAGIC_COOKIE, offset);
    offset += 4;
    
    request.transactionId.copy(response, offset);
    offset += 12;

    // XOR-RELAYED-ADDRESS attribute
    response.writeUInt16BE(this.TURN_ATTRIBUTES.XOR_RELAYED_ADDRESS, offset);
    offset += 2;
    response.writeUInt16BE(8, offset);
    offset += 2;
    response.writeUInt8(0, offset);
    offset += 1;
    response.writeUInt8(0x01, offset); // IPv4
    offset += 1;

    const xorPort = allocation.relayPort ^ (this.TURN_MAGIC_COOKIE >> 16);
    response.writeUInt16BE(xorPort, offset);
    offset += 2;

    // Use server's address for relay
    const serverAddress = 0x7F000001; // 127.0.0.1
    const xorAddress = serverAddress ^ this.TURN_MAGIC_COOKIE;
    response.writeUInt32BE(xorAddress, offset);
    offset += 4;

    // LIFETIME attribute
    response.writeUInt16BE(this.TURN_ATTRIBUTES.LIFETIME, offset);
    offset += 2;
    response.writeUInt16BE(4, offset);
    offset += 2;
    response.writeUInt32BE(allocation.lifetime, offset);
    offset += 4;

    const messageLength = offset - 20;
    response.writeUInt16BE(messageLength, lengthOffset);

    return response.slice(0, offset);
  }

  createRefreshResponse(request) {
    const response = Buffer.alloc(256);
    let offset = 0;

    response.writeUInt16BE(this.TURN_MESSAGE_TYPES.REFRESH_RESPONSE, offset);
    offset += 2;
    
    const lengthOffset = offset;
    offset += 2;
    
    response.writeUInt32BE(this.TURN_MAGIC_COOKIE, offset);
    offset += 4;
    
    request.transactionId.copy(response, offset);
    offset += 12;

    // LIFETIME attribute
    response.writeUInt16BE(this.TURN_ATTRIBUTES.LIFETIME, offset);
    offset += 2;
    response.writeUInt16BE(4, offset);
    offset += 2;
    response.writeUInt32BE(600, offset); // 10 minutes
    offset += 4;

    const messageLength = offset - 20;
    response.writeUInt16BE(messageLength, lengthOffset);

    return response.slice(0, offset);
  }

  createCreatePermissionResponse(request) {
    const response = Buffer.alloc(128);
    let offset = 0;

    response.writeUInt16BE(this.TURN_MESSAGE_TYPES.CREATE_PERMISSION_RESPONSE, offset);
    offset += 2;
    
    const lengthOffset = offset;
    offset += 2;
    
    response.writeUInt32BE(this.TURN_MAGIC_COOKIE, offset);
    offset += 4;
    
    request.transactionId.copy(response, offset);
    offset += 12;

    const messageLength = offset - 20;
    response.writeUInt16BE(messageLength, lengthOffset);

    return response.slice(0, offset);
  }

  sendErrorResponse(request, rinfo, errorCode, errorPhrase) {
    const response = Buffer.alloc(256);
    let offset = 0;

    response.writeUInt16BE(this.TURN_MESSAGE_TYPES.ALLOCATE_ERROR_RESPONSE, offset);
    offset += 2;
    
    const lengthOffset = offset;
    offset += 2;
    
    response.writeUInt32BE(this.TURN_MAGIC_COOKIE, offset);
    offset += 4;
    
    request.transactionId.copy(response, offset);
    offset += 12;

    // ERROR-CODE attribute
    response.writeUInt16BE(this.TURN_ATTRIBUTES.ERROR_CODE, offset);
    offset += 2;
    const errorLength = 4 + errorPhrase.length;
    response.writeUInt16BE(errorLength, offset);
    offset += 2;
    response.writeUInt16BE(0, offset); // Reserved
    offset += 2;
    response.writeUInt8(Math.floor(errorCode / 100), offset); // Class
    offset += 1;
    response.writeUInt8(errorCode % 100, offset); // Number
    offset += 1;
    Buffer.from(errorPhrase).copy(response, offset);
    offset += errorPhrase.length;

    const messageLength = offset - 20;
    response.writeUInt16BE(messageLength, lengthOffset);

    this.socket.send(response.slice(0, offset), rinfo.port, rinfo.address);
  }

  stop() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}