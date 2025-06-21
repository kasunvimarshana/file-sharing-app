/**
 * P2P Protocol Definitions
 * Defines message types, packet structures, and communication protocols
 * Implements BitTorrent-inspired peer-to-peer communication
 */

export class P2PProtocol {
  static MESSAGE_TYPES = {
    // Handshake and connection
    HANDSHAKE: 0x00,
    HANDSHAKE_ACK: 0x01,
    KEEP_ALIVE: 0x02,
    
    // Peer status
    CHOKE: 0x10,
    UNCHOKE: 0x11,
    INTERESTED: 0x12,
    NOT_INTERESTED: 0x13,
    
    // Piece exchange
    HAVE: 0x20,
    BITFIELD: 0x21,
    REQUEST: 0x22,
    PIECE: 0x23,
    CANCEL: 0x24,
    
    // File management
    FILE_INFO: 0x30,
    FILE_REQUEST: 0x31,
    FILE_RESPONSE: 0x32,
    
    // Extended messages
    EXTENDED: 0x40,
    PORT: 0x41,
    
    // Error handling
    ERROR: 0xFF
  };

  static PROTOCOL_VERSION = '1.0';
  static PROTOCOL_ID = 'P2P-BitTorrent';
  static MAX_MESSAGE_SIZE = 32768; // 32KB
  static PIECE_SIZE = 16384; // 16KB blocks
  static DEFAULT_PIECE_LENGTH = 262144; // 256KB pieces

  /**
   * Create handshake message
   */
  static createHandshake(infoHash, peerId, extensions = {}) {
    const protocolName = Buffer.from(this.PROTOCOL_ID);
    const protocolNameLength = Buffer.from([protocolName.length]);
    const reserved = Buffer.alloc(8); // Reserved bytes for extensions
    const infoHashBuffer = Buffer.from(infoHash, 'hex');
    const peerIdBuffer = Buffer.from(peerId);

    // Set extension bits in reserved bytes
    if (extensions.fast) reserved[7] |= 0x04;
    if (extensions.extended) reserved[5] |= 0x10;
    if (extensions.dht) reserved[7] |= 0x01;

    return Buffer.concat([
      protocolNameLength,
      protocolName,
      reserved,
      infoHashBuffer,
      peerIdBuffer
    ]);
  }

  /**
   * Parse handshake message
   */
  static parseHandshake(buffer) {
    if (buffer.length < 68) return null;

    try {
      const protocolNameLength = buffer[0];
      const protocolName = buffer.subarray(1, 1 + protocolNameLength).toString();
      const reserved = buffer.subarray(1 + protocolNameLength, 9 + protocolNameLength);
      const infoHash = buffer.subarray(9 + protocolNameLength, 29 + protocolNameLength);
      const peerId = buffer.subarray(29 + protocolNameLength, 49 + protocolNameLength);

      return {
        protocolName,
        reserved,
        infoHash: infoHash.toString('hex'),
        peerId: peerId.toString(),
        extensions: {
          fast: (reserved[7] & 0x04) !== 0,
          extended: (reserved[5] & 0x10) !== 0,
          dht: (reserved[7] & 0x01) !== 0
        }
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Create message with header
   */
  static createMessage(type, payload = Buffer.alloc(0)) {
    if (type === this.MESSAGE_TYPES.KEEP_ALIVE) {
      return Buffer.from([0, 0, 0, 0]); // 4-byte zero for keep-alive
    }

    const length = payload.length + 1;
    const header = Buffer.allocUnsafe(5);
    
    header.writeUInt32BE(length, 0);
    header.writeUInt8(type, 4);

    return Buffer.concat([header, payload]);
  }

  /**
   * Parse message from buffer
   */
  static parseMessage(buffer) {
    if (buffer.length < 4) return null;

    const length = buffer.readUInt32BE(0);
    
    if (length === 0) {
      return { type: this.MESSAGE_TYPES.KEEP_ALIVE, payload: null };
    }

    if (buffer.length < 4 + length) return null;

    const type = buffer.readUInt8(4);
    const payload = buffer.subarray(5, 4 + length);

    return { type, payload };
  }

  /**
   * Create HAVE message
   */
  static createHaveMessage(pieceIndex) {
    const payload = Buffer.allocUnsafe(4);
    payload.writeUInt32BE(pieceIndex, 0);
    return this.createMessage(this.MESSAGE_TYPES.HAVE, payload);
  }

  /**
   * Create BITFIELD message
   */
  static createBitfieldMessage(bitfield) {
    return this.createMessage(this.MESSAGE_TYPES.BITFIELD, bitfield);
  }

  /**
   * Create REQUEST message
   */
  static createRequestMessage(pieceIndex, begin, length) {
    const payload = Buffer.allocUnsafe(12);
    payload.writeUInt32BE(pieceIndex, 0);
    payload.writeUInt32BE(begin, 4);
    payload.writeUInt32BE(length, 8);
    return this.createMessage(this.MESSAGE_TYPES.REQUEST, payload);
  }

  /**
   * Parse REQUEST message
   */
  static parseRequestMessage(payload) {
    if (payload.length !== 12) return null;
    
    return {
      pieceIndex: payload.readUInt32BE(0),
      begin: payload.readUInt32BE(4),
      length: payload.readUInt32BE(8)
    };
  }

  /**
   * Create PIECE message
   */
  static createPieceMessage(pieceIndex, begin, data) {
    const payload = Buffer.allocUnsafe(8 + data.length);
    payload.writeUInt32BE(pieceIndex, 0);
    payload.writeUInt32BE(begin, 4);
    data.copy(payload, 8);
    return this.createMessage(this.MESSAGE_TYPES.PIECE, payload);
  }

  /**
   * Parse PIECE message
   */
  static parsePieceMessage(payload) {
    if (payload.length < 8) return null;
    
    return {
      pieceIndex: payload.readUInt32BE(0),
      begin: payload.readUInt32BE(4),
      data: payload.subarray(8)
    };
  }

  /**
   * Create FILE_INFO message
   */
  static createFileInfoMessage(fileInfo) {
    const info = JSON.stringify({
      name: fileInfo.name,
      size: fileInfo.size,
      hash: fileInfo.hash,
      pieceLength: fileInfo.pieceLength,
      pieceHashes: fileInfo.pieceHashes,
      timestamp: Date.now()
    });
    
    const payload = Buffer.from(info, 'utf8');
    return this.createMessage(this.MESSAGE_TYPES.FILE_INFO, payload);
  }

  /**
   * Parse FILE_INFO message
   */
  static parseFileInfoMessage(payload) {
    try {
      const info = JSON.parse(payload.toString('utf8'));
      return {
        name: info.name,
        size: info.size,
        hash: info.hash,
        pieceLength: info.pieceLength,
        pieceHashes: info.pieceHashes,
        timestamp: info.timestamp
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Create ERROR message
   */
  static createErrorMessage(errorCode, errorMessage) {
    const payload = Buffer.allocUnsafe(4 + errorMessage.length);
    payload.writeUInt32BE(errorCode, 0);
    Buffer.from(errorMessage, 'utf8').copy(payload, 4);
    return this.createMessage(this.MESSAGE_TYPES.ERROR, payload);
  }

  /**
   * Parse ERROR message
   */
  static parseErrorMessage(payload) {
    if (payload.length < 4) return null;
    
    return {
      code: payload.readUInt32BE(0),
      message: payload.subarray(4).toString('utf8')
    };
  }

  /**
   * Create bitfield from piece availability
   */
  static createBitfield(totalPieces, availablePieces) {
    const byteCount = Math.ceil(totalPieces / 8);
    const bitfield = Buffer.alloc(byteCount);

    for (const pieceIndex of availablePieces) {
      if (pieceIndex < totalPieces) {
        const byteIndex = Math.floor(pieceIndex / 8);
        const bitIndex = pieceIndex % 8;
        bitfield[byteIndex] |= (1 << (7 - bitIndex));
      }
    }

    return bitfield;
  }

  /**
   * Parse bitfield to get available pieces
   */
  static parseBitfield(bitfield, totalPieces) {
    const availablePieces = [];

    for (let pieceIndex = 0; pieceIndex < totalPieces; pieceIndex++) {
      const byteIndex = Math.floor(pieceIndex / 8);
      const bitIndex = pieceIndex % 8;
      
      if (byteIndex < bitfield.length) {
        const bit = (bitfield[byteIndex] >> (7 - bitIndex)) & 1;
        if (bit === 1) {
          availablePieces.push(pieceIndex);
        }
      }
    }

    return availablePieces;
  }

  /**
   * Calculate piece ranges for file
   */
  static calculatePieceRanges(fileSize, pieceLength = this.DEFAULT_PIECE_LENGTH) {
    const totalPieces = Math.ceil(fileSize / pieceLength);
    const ranges = [];

    for (let i = 0; i < totalPieces; i++) {
      const start = i * pieceLength;
      const end = Math.min(start + pieceLength, fileSize);
      ranges.push({ pieceIndex: i, start, end, length: end - start });
    }

    return ranges;
  }

  /**
   * Validate message format
   */
  static validateMessage(buffer) {
    if (buffer.length < 4) return false;

    const length = buffer.readUInt32BE(0);
    
    if (length === 0) return true; // Keep-alive
    if (length > this.MAX_MESSAGE_SIZE) return false;
    if (buffer.length !== 4 + length) return false;

    const type = buffer.readUInt8(4);
    return Object.values(this.MESSAGE_TYPES).includes(type);
  }

  /**
   * Create extended handshake for additional features
   */
  static createExtendedHandshake(clientInfo) {
    const handshake = {
      m: {
        ut_metadata: 1,
        ut_pex: 2
      },
      p: clientInfo.port || 6881,
      v: clientInfo.version || 'P2P Client 1.0',
      yourip: clientInfo.externalIp,
      reqq: 250 // Request queue depth
    };

    const payload = Buffer.from(JSON.stringify(handshake), 'utf8');
    return this.createMessage(this.MESSAGE_TYPES.EXTENDED, Buffer.concat([
      Buffer.from([0]), // Extended message ID 0 for handshake
      payload
    ]));
  }

  /**
   * Parse extended handshake
   */
  static parseExtendedHandshake(payload) {
    if (payload.length < 1) return null;
    
    const messageId = payload.readUInt8(0);
    if (messageId !== 0) return null; // Not a handshake

    try {
      const handshake = JSON.parse(payload.subarray(1).toString('utf8'));
      return handshake;
    } catch (error) {
      return null;
    }
  }
}

export default P2PProtocol;