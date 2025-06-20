import { logger } from './logger';

export class CryptoUtils {
  static async calculateFileHash(buffer: ArrayBuffer): Promise<string> {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      logger.error('Failed to calculate file hash:', error);
      throw new Error('Failed to calculate file hash');
    }
  }

  static async calculateChunkChecksum(chunk: ArrayBuffer): Promise<string> {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-1', chunk);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      logger.error('Failed to calculate chunk checksum:', error);
      throw new Error('Failed to calculate chunk checksum');
    }
  }

  static async verifyChunkIntegrity(chunk: ArrayBuffer, expectedChecksum: string): Promise<boolean> {
    try {
      const actualChecksum = await this.calculateChunkChecksum(chunk);
      return actualChecksum === expectedChecksum;
    } catch (error) {
      logger.error('Failed to verify chunk integrity:', error);
      return false;
    }
  }

  static generateSecureId(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  static async generateKeyPair(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,
      ['sign', 'verify']
    );
  }
}