import { Bencode } from './bencode';
import { TorrentCrypto } from './crypto';
import type { TorrentFile, Piece } from '../types/torrent';

export class TorrentParser {
  static async parseTorrentFile(file: File): Promise<TorrentFile> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      
      if (data.length === 0) {
        throw new Error('Empty torrent file');
      }

      const decoded = Bencode.decode(data);
      
      // Validate required fields
      if (!decoded || typeof decoded !== 'object') {
        throw new Error('Invalid torrent file format');
      }

      if (!decoded.info || !decoded.announce) {
        throw new Error('Invalid torrent file: missing required fields');
      }
      
      const info = decoded.info;
      
      // Validate info dictionary
      if (!info.name || !info['piece length'] || !info.pieces) {
        throw new Error('Invalid torrent file: missing info fields');
      }

      // Validate piece length
      if (typeof info['piece length'] !== 'number' || info['piece length'] <= 0) {
        throw new Error('Invalid piece length');
      }

      // Validate pieces
      if (!(info.pieces instanceof Uint8Array) || info.pieces.length % 20 !== 0) {
        throw new Error('Invalid piece hashes');
      }
      
      const torrent: TorrentFile = {
        announce: Bencode.decodeString(decoded.announce),
        info: {
          name: Bencode.decodeString(info.name),
          pieceLength: info['piece length'],
          pieces: info.pieces,
          length: info.length,
          files: info.files?.map((f: any) => ({
            length: f.length,
            path: f.path.map((p: Uint8Array) => Bencode.decodeString(p))
          }))
        },
        infoHash: '',
        creationDate: decoded['creation date'],
        comment: decoded.comment ? Bencode.decodeString(decoded.comment) : undefined,
        createdBy: decoded['created by'] ? Bencode.decodeString(decoded['created by']) : undefined
      };

      // Handle announce-list
      if (decoded['announce-list'] && Array.isArray(decoded['announce-list'])) {
        torrent.announceList = decoded['announce-list']
          .filter(tier => Array.isArray(tier))
          .map((tier: Uint8Array[]) =>
            tier
              .filter(url => url instanceof Uint8Array)
              .map((url: Uint8Array) => Bencode.decodeString(url))
              .filter(url => this.isValidUrl(url))
          )
          .filter(tier => tier.length > 0);
      }

      // Validate announce URL
      if (!this.isValidUrl(torrent.announce)) {
        throw new Error('Invalid announce URL');
      }

      // Calculate info hash
      const infoEncoded = Bencode.encode(decoded.info);
      const infoHashBytes = await TorrentCrypto.sha1(infoEncoded);
      torrent.infoHash = TorrentCrypto.bytesToHex(infoHashBytes);

      // Validate file structure
      if (torrent.info.files) {
        // Multi-file torrent
        if (!Array.isArray(torrent.info.files) || torrent.info.files.length === 0) {
          throw new Error('Invalid files list');
        }
        
        for (const file of torrent.info.files) {
          if (!file.length || !Array.isArray(file.path) || file.path.length === 0) {
            throw new Error('Invalid file entry');
          }
        }
      } else if (!torrent.info.length || torrent.info.length <= 0) {
        // Single-file torrent
        throw new Error('Invalid file length');
      }

      return torrent;
    } catch (error) {
      console.error('Error parsing torrent file:', error);
      throw new Error(`Failed to parse torrent file: ${error.message}`);
    }
  }

  static createPieces(torrent: TorrentFile): Piece[] {
    const pieces: Piece[] = [];
    const pieceHashes = torrent.info.pieces;
    const pieceLength = torrent.info.pieceLength;
    const totalLength = torrent.info.length || 
      torrent.info.files?.reduce((sum, file) => sum + file.length, 0) || 0;

    if (totalLength <= 0) {
      throw new Error('Invalid total length');
    }

    const numPieces = Math.floor(pieceHashes.length / 20);

    for (let i = 0; i < numPieces; i++) {
      const pieceIndex = i;
      const isLastPiece = pieceIndex === numPieces - 1;
      const currentPieceLength = isLastPiece ? 
        totalLength - (pieceIndex * pieceLength) : pieceLength;

      if (currentPieceLength <= 0) {
        console.warn(`Skipping piece ${i} with invalid length: ${currentPieceLength}`);
        continue;
      }

      const piece: Piece = {
        index: pieceIndex,
        length: currentPieceLength,
        hash: pieceHashes.slice(i * 20, (i * 20) + 20),
        downloaded: false,
        verified: false,
        blocks: this.createBlocks(currentPieceLength)
      };

      pieces.push(piece);
    }

    return pieces;
  }

  private static createBlocks(pieceLength: number): any[] {
    const blocks = [];
    const blockSize = 16384; // 16KB blocks (standard BitTorrent block size)
    
    for (let offset = 0; offset < pieceLength; offset += blockSize) {
      const blockLength = Math.min(blockSize, pieceLength - offset);
      blocks.push({
        offset,
        length: blockLength,
        downloaded: false,
        requested: false,
        data: undefined
      });
    }

    return blocks;
  }

  static async createTorrentFile(
    files: File[],
    announce: string,
    comment?: string
  ): Promise<Uint8Array> {
    if (!files.length) {
      throw new Error('No files provided');
    }

    if (!announce || !this.isValidUrl(announce)) {
      throw new Error('Invalid announce URL');
    }

    const fileList = [];
    let totalLength = 0;

    // Process files and validate
    for (const file of files) {
      if (file.size === 0) {
        console.warn(`Skipping empty file: ${file.name}`);
        continue;
      }

      if (file.size > 100 * 1024 * 1024 * 1024) { // 100GB limit
        throw new Error(`File too large: ${file.name} (${file.size} bytes)`);
      }

      const data = new Uint8Array(await file.arrayBuffer());
      fileList.push({
        path: [this.sanitizeFilename(file.name)],
        length: data.length,
        data
      });
      totalLength += data.length;
    }

    if (fileList.length === 0) {
      throw new Error('No valid files to include in torrent');
    }

    if (totalLength > 1024 * 1024 * 1024 * 1024) { // 1TB limit
      throw new Error('Total torrent size too large');
    }

    const pieceLength = this.calculateOptimalPieceLength(totalLength);
    const pieces: number[] = [];

    // Calculate piece hashes with progress tracking
    let currentPos = 0;
    let currentPiece: number[] = [];

    for (const file of fileList) {
      const fileData = file.data;
      let filePos = 0;

      while (filePos < fileData.length) {
        const remainingInPiece = pieceLength - currentPiece.length;
        const remainingInFile = fileData.length - filePos;
        const bytesToTake = Math.min(remainingInPiece, remainingInFile);

        currentPiece.push(...Array.from(fileData.slice(filePos, filePos + bytesToTake)));
        filePos += bytesToTake;

        if (currentPiece.length === pieceLength || 
            (currentPos + currentPiece.length >= totalLength)) {
          const pieceHash = await TorrentCrypto.sha1(new Uint8Array(currentPiece));
          pieces.push(...Array.from(pieceHash));
          currentPiece = [];
          currentPos += pieceLength;
        }
      }
    }

    // Build torrent data structure
    const torrentData = {
      announce,
      ...(comment && { comment }),
      'creation date': Math.floor(Date.now() / 1000),
      'created by': 'P2P Torrent System v1.0',
      info: {
        name: fileList.length === 1 ? fileList[0].path[0] : 'MultiFile',
        'piece length': pieceLength,
        pieces: new Uint8Array(pieces),
        ...(fileList.length === 1 
          ? { length: fileList[0].length }
          : { 
              files: fileList.map(f => ({
                length: f.length,
                path: f.path
              }))
            }
        )
      }
    };

    return Bencode.encode(torrentData);
  }

  private static calculateOptimalPieceLength(totalSize: number): number {
    // Calculate optimal piece length based on total size
    // Aim for 1000-2000 pieces total for optimal performance
    if (totalSize < 1024 * 1024) return 16384; // 16KB for very small files
    if (totalSize < 10 * 1024 * 1024) return 32768; // 32KB for small files
    if (totalSize < 100 * 1024 * 1024) return 65536; // 64KB for medium files
    if (totalSize < 1024 * 1024 * 1024) return 131072; // 128KB for large files
    if (totalSize < 4 * 1024 * 1024 * 1024) return 262144; // 256KB for very large files
    return 524288; // 512KB for huge files
  }

  private static isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:', 'udp:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  private static sanitizeFilename(filename: string): string {
    // Remove dangerous characters and limit length
    return filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\.\./g, '_')
      .trim()
      .substring(0, 255) || 'unnamed_file';
  }

  static async validateTorrent(torrent: TorrentFile): Promise<boolean> {
    try {
      // Validate basic structure
      if (!torrent.infoHash || !torrent.info || !torrent.announce) {
        return false;
      }

      // Validate info hash format
      if (!/^[a-fA-F0-9]{40}$/.test(torrent.infoHash)) {
        return false;
      }

      // Validate piece hashes
      if (torrent.info.pieces.length % 20 !== 0 || torrent.info.pieces.length === 0) {
        return false;
      }

      // Validate piece length
      if (torrent.info.pieceLength <= 0 || torrent.info.pieceLength > 32 * 1024 * 1024) {
        return false;
      }

      // Validate announce URL
      if (!this.isValidUrl(torrent.announce)) {
        return false;
      }

      // Calculate expected total length
      const expectedLength = torrent.info.length || 
        torrent.info.files?.reduce((sum, file) => sum + file.length, 0) || 0;
      
      if (expectedLength <= 0) {
        return false;
      }

      // Validate piece count matches total length
      const numPieces = Math.floor(torrent.info.pieces.length / 20);
      const expectedPieces = Math.ceil(expectedLength / torrent.info.pieceLength);
      
      if (numPieces !== expectedPieces) {
        return false;
      }

      // Validate file structure
      if (torrent.info.files) {
        // Multi-file torrent
        for (const file of torrent.info.files) {
          if (!file.length || file.length <= 0 || !Array.isArray(file.path) || file.path.length === 0) {
            return false;
          }
        }
      } else if (!torrent.info.length || torrent.info.length <= 0) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Torrent validation error:', error);
      return false;
    }
  }

  static getTorrentStats(torrent: TorrentFile) {
    const totalLength = torrent.info.length || 
      torrent.info.files?.reduce((sum, file) => sum + file.length, 0) || 0;
    
    const numPieces = Math.floor(torrent.info.pieces.length / 20);
    const numFiles = torrent.info.files?.length || 1;

    return {
      name: torrent.info.name,
      size: totalLength,
      pieceLength: torrent.info.pieceLength,
      numPieces,
      numFiles,
      infoHash: torrent.infoHash,
      announce: torrent.announce,
      announceList: torrent.announceList?.length || 0,
      creationDate: torrent.creationDate,
      comment: torrent.comment,
      createdBy: torrent.createdBy
    };
  }
}