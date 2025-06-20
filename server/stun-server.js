import dgram from 'dgram';
import crypto from 'crypto';

export class STUNServer {
  constructor() {
    this.socket = null;
    this.STUN_MAGIC_COOKIE = 0x2112A442;
    this.STUN_MESSAGE_TYPES = {
      BINDING_REQUEST: 0x0001,
      BINDING_RESPONSE: 0x0101,
      BINDING_ERROR_RESPONSE: 0x0111
    };
    this.STUN_ATTRIBUTES = {
      MAPPED_ADDRESS: 0x0001,
      XOR_MAPPED_ADDRESS: 0x0020,
      SOFTWARE: 0x8022,
      FINGERPRINT: 0x8028
    };
  }

  start(port = 3478) {
    this.socket = dgram.createSocket('udp4');

    this.socket.on('message', (msg, rinfo) => {
      this.handleMessage(msg, rinfo);
    });

    this.socket.on('error', (err) => {
      console.error('STUN server error:', err);
    });

    this.socket.bind(port, () => {
      console.log(`STUN server listening on port ${port}`);
    });
  }

  handleMessage(msg, rinfo) {
    try {
      const stunMessage = this.parseSTUNMessage(msg);
      
      if (stunMessage.type === this.STUN_MESSAGE_TYPES.BINDING_REQUEST) {
        const response = this.createBindingResponse(stunMessage, rinfo);
        this.socket.send(response, rinfo.port, rinfo.address);
      }
    } catch (error) {
      console.error('Failed to handle STUN message:', error);
    }
  }

  parseSTUNMessage(buffer) {
    if (buffer.length < 20) {
      throw new Error('Invalid STUN message length');
    }

    const type = buffer.readUInt16BE(0);
    const length = buffer.readUInt16BE(2);
    const magicCookie = buffer.readUInt32BE(4);
    const transactionId = buffer.slice(8, 20);

    if (magicCookie !== this.STUN_MAGIC_COOKIE) {
      throw new Error('Invalid STUN magic cookie');
    }

    return {
      type,
      length,
      magicCookie,
      transactionId,
      attributes: this.parseAttributes(buffer.slice(20))
    };
  }

  parseAttributes(buffer) {
    const attributes = [];
    let offset = 0;

    while (offset < buffer.length) {
      if (offset + 4 > buffer.length) break;

      const type = buffer.readUInt16BE(offset);
      const length = buffer.readUInt16BE(offset + 2);
      const value = buffer.slice(offset + 4, offset + 4 + length);

      attributes.push({ type, length, value });
      offset += 4 + length + (length % 4 === 0 ? 0 : 4 - (length % 4)); // Padding
    }

    return attributes;
  }

  createBindingResponse(request, rinfo) {
    const response = Buffer.alloc(1024);
    let offset = 0;

    // STUN header
    response.writeUInt16BE(this.STUN_MESSAGE_TYPES.BINDING_RESPONSE, offset); // Message type
    offset += 2;
    
    // Message length (will be updated later)
    const lengthOffset = offset;
    offset += 2;
    
    response.writeUInt32BE(this.STUN_MAGIC_COOKIE, offset); // Magic cookie
    offset += 4;
    
    request.transactionId.copy(response, offset); // Transaction ID
    offset += 12;

    // XOR-MAPPED-ADDRESS attribute
    const xorMappedAddrStart = offset;
    response.writeUInt16BE(this.STUN_ATTRIBUTES.XOR_MAPPED_ADDRESS, offset);
    offset += 2;
    response.writeUInt16BE(8, offset); // Length
    offset += 2;
    response.writeUInt8(0, offset); // Reserved
    offset += 1;
    response.writeUInt8(0x01, offset); // Family (IPv4)
    offset += 1;

    // XOR port with magic cookie
    const xorPort = rinfo.port ^ (this.STUN_MAGIC_COOKIE >> 16);
    response.writeUInt16BE(xorPort, offset);
    offset += 2;

    // XOR address with magic cookie
    const addressParts = rinfo.address.split('.').map(Number);
    const addressInt = (addressParts[0] << 24) | (addressParts[1] << 16) | (addressParts[2] << 8) | addressParts[3];
    const xorAddress = addressInt ^ this.STUN_MAGIC_COOKIE;
    response.writeUInt32BE(xorAddress, offset);
    offset += 4;

    // SOFTWARE attribute
    const software = 'P2P-Torrent-STUN/1.0';
    const softwareBuffer = Buffer.from(software, 'utf8');
    response.writeUInt16BE(this.STUN_ATTRIBUTES.SOFTWARE, offset);
    offset += 2;
    response.writeUInt16BE(softwareBuffer.length, offset);
    offset += 2;
    softwareBuffer.copy(response, offset);
    offset += softwareBuffer.length;
    
    // Add padding
    const padding = 4 - (softwareBuffer.length % 4);
    if (padding !== 4) {
      response.fill(0, offset, offset + padding);
      offset += padding;
    }

    // Update message length
    const messageLength = offset - 20;
    response.writeUInt16BE(messageLength, lengthOffset);

    return response.slice(0, offset);
  }

  stop() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
