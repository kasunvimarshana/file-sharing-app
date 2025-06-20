import dgram from 'dgram';

export class STUNServer {
  constructor() {
    this.socket = dgram.createSocket('udp4');
    this.bindingResponses = new Map();
  }

  start(port) {
    this.socket.bind(port);
    
    this.socket.on('message', (msg, rinfo) => {
      this.handleSTUNMessage(msg, rinfo);
    });

    this.socket.on('listening', () => {
      console.log(`📡 STUN server listening on port ${port}`);
    });

    this.socket.on('error', (err) => {
      console.error('STUN server error:', err);
    });
  }

  handleSTUNMessage(message, rinfo) {
    try {
      const stunMessage = this.parseSTUNMessage(message);
      
      if (stunMessage.messageType === 0x0001) { // Binding Request
        const response = this.createBindingResponse(stunMessage, rinfo);
        this.socket.send(response, rinfo.port, rinfo.address);
      }
    } catch (error) {
      console.error('Error handling STUN message:', error);
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
      offset += 4 + length + (length % 4 ? 4 - (length % 4) : 0); // Padding
    }

    return attributes;
  }

  createBindingResponse(request, rinfo) {
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
    const addressInt = (addressParts[0] << 24) | (addressParts[1] << 16) | 
                     (addressParts[2] << 8) | addressParts[3];
    const xorAddress = addressInt ^ 0x2112A442;
    responseBuffer.writeUInt32BE(xorAddress, 28);
    
    return responseBuffer;
  }

  stop() {
    this.socket.close();
  }
}