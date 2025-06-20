import dgram from 'dgram';

export class TURNServer {
  constructor() {
    this.socket = dgram.createSocket('udp4');
    this.allocations = new Map();
    this.permissions = new Map();
  }

  start(port) {
    this.socket.bind(port);
    
    this.socket.on('message', (msg, rinfo) => {
      this.handleTURNMessage(msg, rinfo);
    });

    this.socket.on('listening', () => {
      console.log(`🔄 TURN server listening on port ${port}`);
    });

    this.socket.on('error', (err) => {
      console.error('TURN server error:', err);
    });
  }

  handleTURNMessage(message, rinfo) {
    try {
      const turnMessage = this.parseSTUNMessage(message);
      
      switch (turnMessage.messageType) {
        case 0x0003: // Allocate Request
          this.handleAllocateRequest(turnMessage, rinfo);
          break;
        case 0x0004: // Refresh Request
          this.handleRefreshRequest(turnMessage, rinfo);
          break;
        case 0x0008: // Send Indication
          this.handleSendIndication(turnMessage, rinfo);
          break;
        case 0x0009: // Data Indication
          this.handleDataIndication(turnMessage, rinfo);
          break;
      }
    } catch (error) {
      console.error('Error handling TURN message:', error);
    }
  }

  parseSTUNMessage(buffer) {
    const messageType = buffer.readUInt16BE(0);
    const messageLength = buffer.readUInt16BE(2);
    const magicCookie = buffer.readUInt32BE(4);
    const transactionId = buffer.subarray(8, 20);

    return {
      messageType,
      messageLength,
      magicCookie,
      transactionId,
      attributes: this.parseAttributes(buffer.subarray(20))
    };
  }

  parseAttributes(buffer) {
    const attributes = [];
    let offset = 0;

    while (offset < buffer.length) {
      const type = buffer.readUInt16BE(offset);
      const length = buffer.readUInt16BE(offset + 2);
      const value = buffer.subarray(offset + 4, offset + 4 + length);
      
      attributes.push({ type, length, value });
      offset += 4 + length + (length % 4 ? 4 - (length % 4) : 0);
    }

    return attributes;
  }

  handleAllocateRequest(request, rinfo) {
    const allocationId = this.generateAllocationId();
    const relayAddress = { address: '127.0.0.1', port: 50000 + Math.floor(Math.random() * 10000) };
    
    this.allocations.set(allocationId, {
      clientAddress: rinfo,
      relayAddress,
      lifetime: 600, // 10 minutes
      createdAt: Date.now()
    });

    const response = this.createAllocateResponse(request, relayAddress);
    this.socket.send(response, rinfo.port, rinfo.address);
  }

  handleRefreshRequest(request, rinfo) {
    // Find allocation for this client
    const allocation = Array.from(this.allocations.values())
      .find(alloc => alloc.clientAddress.address === rinfo.address && 
                    alloc.clientAddress.port === rinfo.port);
    
    if (allocation) {
      allocation.lifetime = 600; // Refresh lifetime
      allocation.createdAt = Date.now();
    }

    const response = this.createRefreshResponse(request);
    this.socket.send(response, rinfo.port, rinfo.address);
  }

  handleSendIndication(indication, rinfo) {
    // Handle data forwarding through TURN relay
    const dataAttr = indication.attributes.find(attr => attr.type === 0x0013);
    const peerAddrAttr = indication.attributes.find(attr => attr.type === 0x0012);
    
    if (dataAttr && peerAddrAttr) {
      const peerAddress = this.parseXORPeerAddress(peerAddrAttr.value);
      // Forward data to peer (simplified implementation)
      console.log(`Relaying data from ${rinfo.address}:${rinfo.port} to ${peerAddress.address}:${peerAddress.port}`);
    }
  }

  handleDataIndication(indication, rinfo) {
    // Handle incoming data from peers
    console.log(`Received data indication from ${rinfo.address}:${rinfo.port}`);
  }

  generateAllocationId() {
    return Math.random().toString(36).substring(2, 15);
  }

  createAllocateResponse(request, relayAddress) {
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
    const xorAddress = addressInt ^ 0x2112A442;
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
  }

  createRefreshResponse(request) {
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
  }

  parseXORPeerAddress(buffer) {
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
  }

  stop() {
    this.socket.close();
  }
}