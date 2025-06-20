export class TorrentCrypto {
  static async sha1(data: Uint8Array): Promise<Uint8Array> {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-1', data);
      return new Uint8Array(hashBuffer);
    } catch (error) {
      throw new Error(`SHA-1 hashing failed: ${error.message}`);
    }
  }

  static async sha256(data: Uint8Array): Promise<Uint8Array> {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      return new Uint8Array(hashBuffer);
    } catch (error) {
      throw new Error(`SHA-256 hashing failed: ${error.message}`);
    }
  }

  static generatePeerId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '-BT1000-'; // BitTorrent client identifier
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static generateRandomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  static hexToBytes(hex: string): Uint8Array {
    if (hex.length % 2 !== 0) {
      throw new Error('Invalid hex string length');
    }
    
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      const byte = parseInt(hex.substr(i, 2), 16);
      if (isNaN(byte)) {
        throw new Error(`Invalid hex character at position ${i}`);
      }
      bytes[i / 2] = byte;
    }
    return bytes;
  }

  static urlEncode(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => {
        // Unreserved characters in URLs
        if ((b >= 48 && b <= 57) || // 0-9
            (b >= 65 && b <= 90) || // A-Z
            (b >= 97 && b <= 122) || // a-z
            b === 45 || b === 46 || b === 95 || b === 126) { // -._~
          return String.fromCharCode(b);
        }
        return '%' + b.toString(16).padStart(2, '0').toUpperCase();
      })
      .join('');
  }

  static urlDecode(encoded: string): Uint8Array {
    const bytes: number[] = [];
    let i = 0;
    
    while (i < encoded.length) {
      if (encoded[i] === '%') {
        if (i + 2 >= encoded.length) {
          throw new Error('Invalid URL encoding');
        }
        const hex = encoded.substr(i + 1, 2);
        const byte = parseInt(hex, 16);
        if (isNaN(byte)) {
          throw new Error('Invalid hex in URL encoding');
        }
        bytes.push(byte);
        i += 3;
      } else {
        bytes.push(encoded.charCodeAt(i));
        i++;
      }
    }
    
    return new Uint8Array(bytes);
  }

  static async verifyPieceHash(pieceData: Uint8Array, expectedHash: Uint8Array): Promise<boolean> {
    try {
      const actualHash = await this.sha1(pieceData);
      return this.compareHashes(actualHash, expectedHash);
    } catch (error) {
      console.error('Hash verification failed:', error);
      return false;
    }
  }

  static compareHashes(hash1: Uint8Array, hash2: Uint8Array): boolean {
    if (hash1.length !== hash2.length) return false;
    
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) return false;
    }
    
    return true;
  }

  static generateInfoHash(infoDict: any): Promise<string> {
    // This would be used with the Bencode encoder
    // For now, return a placeholder
    return Promise.resolve(this.bytesToHex(this.generateRandomBytes(20)));
  }

  static createMagnetLink(infoHash: string, name?: string, trackers?: string[]): string {
    let magnet = `magnet:?xt=urn:btih:${infoHash}`;
    
    if (name) {
      magnet += `&dn=${encodeURIComponent(name)}`;
    }
    
    if (trackers && trackers.length > 0) {
      for (const tracker of trackers) {
        magnet += `&tr=${encodeURIComponent(tracker)}`;
      }
    }
    
    return magnet;
  }

  static parseMagnetLink(magnetUri: string): { infoHash?: string; name?: string; trackers: string[] } {
    const result = { trackers: [] as string[] };
    
    try {
      const url = new URL(magnetUri);
      
      // Extract info hash
      const xt = url.searchParams.get('xt');
      if (xt && xt.startsWith('urn:btih:')) {
        result.infoHash = xt.substring(9);
      }
      
      // Extract display name
      const dn = url.searchParams.get('dn');
      if (dn) {
        result.name = decodeURIComponent(dn);
      }
      
      // Extract trackers
      const trackers = url.searchParams.getAll('tr');
      result.trackers = trackers.map(tr => decodeURIComponent(tr));
      
    } catch (error) {
      console.error('Failed to parse magnet link:', error);
    }
    
    return result;
  }

  static validateInfoHash(infoHash: string): boolean {
    return /^[a-fA-F0-9]{40}$/.test(infoHash);
  }

  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static calculateDownloadTime(bytesRemaining: number, speedBytesPerSecond: number): number {
    if (speedBytesPerSecond <= 0) return Infinity;
    return bytesRemaining / speedBytesPerSecond;
  }

  static formatTime(seconds: number): string {
    if (seconds === Infinity || isNaN(seconds)) return '∞';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
}