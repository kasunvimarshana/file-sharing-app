/**
 * Cryptographic Utilities
 * Provides secure hash functions, encryption, and verification for P2P operations
 */

import { createHash, createHmac, randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv } from 'crypto';

export class CryptoUtils {
  /**
   * Generate SHA-256 hash of data
   */
  static sha256(data) {
    return createHash('sha256').update(data).digest();
  }

  /**
   * Generate SHA-256 hash as hex string
   */
  static sha256Hex(data) {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate SHA-1 hash (for BitTorrent compatibility)
   */
  static sha1(data) {
    return createHash('sha1').update(data).digest();
  }

  /**
   * Generate SHA-1 hash as hex string
   */
  static sha1Hex(data) {
    return createHash('sha1').update(data).digest('hex');
  }

  /**
   * Generate HMAC-SHA256
   */
  static hmacSha256(key, data) {
    return createHmac('sha256', key).update(data).digest();
  }

  /**
   * Generate HMAC-SHA256 as hex string
   */
  static hmacSha256Hex(key, data) {
    return createHmac('sha256', key).update(data).digest('hex');
  }

  /**
   * Generate cryptographically secure random bytes
   */
  static randomBytes(length) {
    return randomBytes(length);
  }

  /**
   * Generate random hex string
   */
  static randomHex(length) {
    return randomBytes(length).toString('hex');
  }

  /**
   * Generate peer ID for BitTorrent protocol
   */
  static generatePeerId(clientId = 'P2P1') {
    const version = '0001';
    const random = randomBytes(12).toString('hex');
    return `-${clientId}${version}-${random}`;
  }

  /**
   * Generate info hash for torrent
   */
  static generateInfoHash(fileData) {
    return this.sha1(fileData);
  }

  /**
   * Generate piece hashes for file chunks
   */
  static generatePieceHashes(fileBuffer, pieceLength = 262144) { // 256KB pieces
    const pieces = [];
    const hashes = [];

    for (let offset = 0; offset < fileBuffer.length; offset += pieceLength) {
      const end = Math.min(offset + pieceLength, fileBuffer.length);
      const piece = fileBuffer.subarray(offset, end);
      pieces.push(piece);
      hashes.push(this.sha1(piece));
    }

    return { pieces, hashes };
  }

  /**
   * Verify piece integrity
   */
  static verifyPiece(pieceData, expectedHash) {
    const actualHash = this.sha1(pieceData);
    return actualHash.equals(expectedHash);
  }

  /**
   * Key derivation using PBKDF2
   */
  static deriveKey(password, salt, iterations = 100000, keyLength = 32) {
    return pbkdf2Sync(password, salt, iterations, keyLength, 'sha256');
  }

  /**
   * AES-256-GCM encryption
   */
  static encrypt(data, key) {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv,
      authTag
    };
  }

  /**
   * AES-256-GCM decryption
   */
  static decrypt(encryptedData, key, iv, authTag) {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    return Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);
  }

  /**
   * Generate secure challenge for authentication
   */
  static generateChallenge() {
    return {
      challenge: randomBytes(32).toString('hex'),
      timestamp: Date.now(),
      nonce: randomBytes(16).toString('hex')
    };
  }

  /**
   * Verify challenge response
   */
  static verifyChallenge(challenge, response, secret) {
    const expectedResponse = this.hmacSha256Hex(secret, challenge.challenge + challenge.nonce);
    return response === expectedResponse;
  }

  /**
   * Generate digital signature
   */
  static sign(data, privateKey) {
    // Simplified signing (in production, use proper digital signatures)
    return this.hmacSha256(privateKey, data);
  }

  /**
   * Verify digital signature
   */
  static verify(data, signature, publicKey) {
    // Simplified verification (in production, use proper digital signatures)
    const expectedSignature = this.hmacSha256(publicKey, data);
    return signature.equals(expectedSignature);
  }

  /**
   * Generate Merkle tree root for file verification
   */
  static generateMerkleRoot(hashes) {
    if (hashes.length === 0) return Buffer.alloc(32);
    if (hashes.length === 1) return hashes[0];

    const tree = [...hashes];
    
    while (tree.length > 1) {
      const nextLevel = [];
      
      for (let i = 0; i < tree.length; i += 2) {
        const left = tree[i];
        const right = tree[i + 1] || left; // Duplicate last hash if odd number
        const combined = Buffer.concat([left, right]);
        nextLevel.push(this.sha256(combined));
      }
      
      tree.splice(0, tree.length, ...nextLevel);
    }

    return tree[0];
  }

  /**
   * Create torrent-style bencode hash
   */
  static createTorrentHash(fileInfo) {
    // Simplified torrent hash creation
    const info = JSON.stringify({
      name: fileInfo.name,
      length: fileInfo.size,
      'piece length': fileInfo.pieceLength,
      pieces: fileInfo.pieces
    });
    
    return this.sha1(info);
  }

  /**
   * Generate secure room ID for file sharing
   */
  static generateRoomId(fileHash, timestamp) {
    const data = Buffer.concat([
      Buffer.from(fileHash, 'hex'),
      Buffer.from(timestamp.toString())
    ]);
    return this.sha256Hex(data);
  }

  /**
   * Time-safe string comparison to prevent timing attacks
   */
  static timeSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }
}

export default CryptoUtils;