/**
 * File Management System
 * Handles file chunking, piece management, and hash verification
 * Implements BitTorrent-like piece exchange protocol
 */

export class FileManager {
  constructor() {
    this.files = new Map(); // fileHash -> file info
    this.pieces = new Map(); // pieceHash -> piece data
    this.downloads = new Map(); // fileHash -> download state
    this.uploads = new Map(); // fileHash -> upload state
    
    // Configuration
    this.PIECE_SIZE = 262144; // 256KB pieces
    this.BLOCK_SIZE = 16384; // 16KB blocks within pieces
    this.MAX_CONCURRENT_DOWNLOADS = 5;
    this.MAX_CONCURRENT_UPLOADS = 10;
    
    // Event callbacks
    this.onFileAdded = null;
    this.onFileRemoved = null;
    this.onDownloadProgress = null;
    this.onDownloadComplete = null;
    this.onUploadProgress = null;
    this.onError = null;
  }

  /**
   * Add file to library
   */
  async addFile(file) {
    try {
      const fileBuffer = await this.readFileAsArrayBuffer(file);
      const fileHash = await this.calculateFileHash(fileBuffer);
      const pieces = await this.createFilePieces(fileBuffer);
      
      const fileInfo = {
        id: fileHash.substring(0, 16),
        hash: fileHash,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        pieces: pieces,
        pieceCount: pieces.length,
        addedAt: Date.now(),
        available: true
      };

      this.files.set(fileHash, fileInfo);
      
      // Store pieces in memory (in production, use IndexedDB or similar)
      for (const piece of pieces) {
        this.pieces.set(piece.hash, piece.data);
      }

      this.emitFileAdded(fileInfo);
      return fileInfo;
    } catch (error) {
      this.emitError('Failed to add file', error);
      return null;
    }
  }

  /**
   * Remove file from library
   */
  removeFile(fileHash) {
    try {
      const fileInfo = this.files.get(fileHash);
      if (!fileInfo) return false;

      // Remove pieces from storage
      for (const piece of fileInfo.pieces) {
        this.pieces.delete(piece.hash);
      }

      // Cancel any active downloads/uploads
      this.cancelDownload(fileHash);
      this.cancelUpload(fileHash);

      this.files.delete(fileHash);
      this.emitFileRemoved(fileHash);
      
      return true;
    } catch (error) {
      this.emitError('Failed to remove file', error);
      return false;
    }
  }

  /**
   * Start downloading file from peers
   */
  async startDownload(fileInfo, peers) {
    try {
      if (this.downloads.has(fileInfo.hash)) {
        console.warn(`Download already in progress for ${fileInfo.name}`);
        return false;
      }

      const downloadState = {
        fileInfo: fileInfo,
        peers: new Set(peers),
        pieces: new Map(), // pieceIndex -> piece data
        pieceStates: new Map(), // pieceIndex -> 'pending'|'downloading'|'complete'
        blocksReceived: new Map(), // pieceIndex -> Set of block indices
        totalPieces: fileInfo.pieceCount,
        completedPieces: 0,
        startTime: Date.now(),
        bytesDownloaded: 0,
        downloadSpeed: 0,
        status: 'downloading'
      };

      // Initialize piece states
      for (let i = 0; i < fileInfo.pieceCount; i++) {
        downloadState.pieceStates.set(i, 'pending');
        downloadState.blocksReceived.set(i, new Set());
      }

      this.downloads.set(fileInfo.hash, downloadState);
      
      // Start downloading pieces
      this.scheduleDownloads(fileInfo.hash);
      
      return true;
    } catch (error) {
      this.emitError('Failed to start download', error);
      return false;
    }
  }

  /**
   * Schedule piece downloads
   */
  scheduleDownloads(fileHash) {
    const downloadState = this.downloads.get(fileHash);
    if (!downloadState || downloadState.status !== 'downloading') return;

    let activeDownloads = 0;
    
    // Count active downloads
    for (const state of downloadState.pieceStates.values()) {
      if (state === 'downloading') activeDownloads++;
    }

    // Start new downloads up to the limit
    const availableSlots = this.MAX_CONCURRENT_DOWNLOADS - activeDownloads;
    let started = 0;

    for (const [pieceIndex, state] of downloadState.pieceStates.entries()) {
      if (state === 'pending' && started < availableSlots) {
        this.downloadPiece(fileHash, pieceIndex);
        started++;
      }
    }
  }

  /**
   * Download specific piece
   */
  async downloadPiece(fileHash, pieceIndex) {
    try {
      const downloadState = this.downloads.get(fileHash);
      if (!downloadState) return;

      downloadState.pieceStates.set(pieceIndex, 'downloading');
      
      const pieceSize = this.calculatePieceSize(downloadState.fileInfo, pieceIndex);
      const blocksPerPiece = Math.ceil(pieceSize / this.BLOCK_SIZE);
      
      // Request blocks from available peers
      for (let blockIndex = 0; blockIndex < blocksPerPiece; blockIndex++) {
        const blockOffset = blockIndex * this.BLOCK_SIZE;
        const blockSize = Math.min(this.BLOCK_SIZE, pieceSize - blockOffset);
        
        // Find peer with this piece (simplified peer selection)
        const peer = Array.from(downloadState.peers)[0];
        if (peer) {
          this.requestBlock(fileHash, pieceIndex, blockOffset, blockSize, peer);
        }
      }
    } catch (error) {
      this.emitError(`Failed to download piece ${pieceIndex}`, error);
    }
  }

  /**
   * Request block from peer
   */
  requestBlock(fileHash, pieceIndex, blockOffset, blockSize, peer) {
    // This would send a request to the peer via WebRTC data channel
    // For now, we'll simulate the request
    const request = {
      type: 'block-request',
      fileHash: fileHash,
      pieceIndex: pieceIndex,
      blockOffset: blockOffset,
      blockSize: blockSize
    };

    // In a real implementation, this would be sent via peer connection
    console.log(`Requesting block from peer:`, request);
  }

  /**
   * Handle received block data
   */
  async handleReceivedBlock(fileHash, pieceIndex, blockOffset, blockData) {
    try {
      const downloadState = this.downloads.get(fileHash);
      if (!downloadState) return;

      const blockIndex = Math.floor(blockOffset / this.BLOCK_SIZE);
      const blocksReceived = downloadState.blocksReceived.get(pieceIndex);
      
      if (blocksReceived.has(blockIndex)) {
        console.warn(`Block ${blockIndex} already received for piece ${pieceIndex}`);
        return;
      }

      // Store block data
      if (!downloadState.pieces.has(pieceIndex)) {
        const pieceSize = this.calculatePieceSize(downloadState.fileInfo, pieceIndex);
        downloadState.pieces.set(pieceIndex, new Uint8Array(pieceSize));
      }

      const pieceData = downloadState.pieces.get(pieceIndex);
      const blockArray = new Uint8Array(blockData);
      pieceData.set(blockArray, blockOffset);
      
      blocksReceived.add(blockIndex);
      downloadState.bytesDownloaded += blockArray.length;

      // Check if piece is complete
      const pieceSize = this.calculatePieceSize(downloadState.fileInfo, pieceIndex);
      const expectedBlocks = Math.ceil(pieceSize / this.BLOCK_SIZE);
      
      if (blocksReceived.size === expectedBlocks) {
        await this.completePiece(fileHash, pieceIndex);
      }

      // Update progress
      this.updateDownloadProgress(fileHash);
      
    } catch (error) {
      this.emitError('Failed to handle received block', error);
    }
  }

  /**
   * Complete piece download and verify hash
   */
  async completePiece(fileHash, pieceIndex) {
    try {
      const downloadState = this.downloads.get(fileHash);
      if (!downloadState) return;

      const pieceData = downloadState.pieces.get(pieceIndex);
      const expectedHash = downloadState.fileInfo.pieces[pieceIndex].hash;
      const actualHash = await this.calculatePieceHash(pieceData);

      if (actualHash === expectedHash) {
        // Hash verification successful
        downloadState.pieceStates.set(pieceIndex, 'complete');
        downloadState.completedPieces++;
        
        // Store verified piece
        this.pieces.set(expectedHash, pieceData);
        
        console.log(`Piece ${pieceIndex} completed and verified`);
        
        // Check if download is complete
        if (downloadState.completedPieces === downloadState.totalPieces) {
          await this.completeDownload(fileHash);
        } else {
          // Schedule more downloads
          this.scheduleDownloads(fileHash);
        }
      } else {
        // Hash verification failed, retry piece
        console.warn(`Hash verification failed for piece ${pieceIndex}`);
        downloadState.pieceStates.set(pieceIndex, 'pending');
        downloadState.pieces.delete(pieceIndex);
        downloadState.blocksReceived.set(pieceIndex, new Set());
        
        // Retry after a delay
        setTimeout(() => this.scheduleDownloads(fileHash), 1000);
      }
    } catch (error) {
      this.emitError(`Failed to complete piece ${pieceIndex}`, error);
    }
  }

  /**
   * Complete file download
   */
  async completeDownload(fileHash) {
    try {
      const downloadState = this.downloads.get(fileHash);
      if (!downloadState) return;

      // Reconstruct file from pieces
      const fileData = await this.reconstructFile(downloadState);
      
      // Add to file library
      const fileInfo = {
        ...downloadState.fileInfo,
        addedAt: Date.now(),
        available: true
      };

      this.files.set(fileHash, fileInfo);
      
      // Clean up download state
      this.downloads.delete(fileHash);
      
      // Create download blob for user
      const blob = new Blob([fileData], { type: fileInfo.mimeType });
      const url = URL.createObjectURL(blob);
      
      this.emitDownloadComplete(fileInfo, url);
      
      console.log(`Download completed: ${fileInfo.name}`);
    } catch (error) {
      this.emitError('Failed to complete download', error);
    }
  }

  /**
   * Reconstruct file from pieces
   */
  async reconstructFile(downloadState) {
    const totalSize = downloadState.fileInfo.size;
    const fileData = new Uint8Array(totalSize);
    let offset = 0;

    for (let i = 0; i < downloadState.totalPieces; i++) {
      const pieceData = downloadState.pieces.get(i);
      if (pieceData) {
        fileData.set(pieceData, offset);
        offset += pieceData.length;
      }
    }

    return fileData;
  }

  /**
   * Handle piece request from peer
   */
  handlePieceRequest(peerId, fileHash, pieceIndex, blockOffset, blockSize) {
    try {
      const fileInfo = this.files.get(fileHash);
      if (!fileInfo || !fileInfo.available) {
        console.warn(`File not available: ${fileHash}`);
        return;
      }

      const piece = fileInfo.pieces[pieceIndex];
      if (!piece) {
        console.warn(`Piece not found: ${pieceIndex}`);
        return;
      }

      const pieceData = this.pieces.get(piece.hash);
      if (!pieceData) {
        console.warn(`Piece data not found: ${piece.hash}`);
        return;
      }

      // Extract requested block
      const blockData = pieceData.slice(blockOffset, blockOffset + blockSize);
      
      // Send block to peer (this would use WebRTC data channel)
      const response = {
        type: 'block-response',
        fileHash: fileHash,
        pieceIndex: pieceIndex,
        blockOffset: blockOffset,
        blockData: blockData
      };

      console.log(`Sending block to peer ${peerId}:`, {
        fileHash: fileHash.substring(0, 8),
        pieceIndex,
        blockOffset,
        blockSize: blockData.length
      });

      // In a real implementation, this would be sent via peer connection
      // peerConnection.sendToPeer(peerId, response);
      
    } catch (error) {
      this.emitError('Failed to handle piece request', error);
    }
  }

  /**
   * Cancel download
   */
  cancelDownload(fileHash) {
    if (this.downloads.has(fileHash)) {
      this.downloads.delete(fileHash);
      console.log(`Download cancelled: ${fileHash}`);
    }
  }

  /**
   * Cancel upload
   */
  cancelUpload(fileHash) {
    if (this.uploads.has(fileHash)) {
      this.uploads.delete(fileHash);
      console.log(`Upload cancelled: ${fileHash}`);
    }
  }

  /**
   * Update download progress
   */
  updateDownloadProgress(fileHash) {
    const downloadState = this.downloads.get(fileHash);
    if (!downloadState) return;

    const progress = {
      fileHash: fileHash,
      fileName: downloadState.fileInfo.name,
      totalSize: downloadState.fileInfo.size,
      downloadedBytes: downloadState.bytesDownloaded,
      completedPieces: downloadState.completedPieces,
      totalPieces: downloadState.totalPieces,
      progress: (downloadState.completedPieces / downloadState.totalPieces) * 100,
      speed: this.calculateDownloadSpeed(downloadState),
      peers: downloadState.peers.size,
      status: downloadState.status
    };

    this.emitDownloadProgress(progress);
  }

  /**
   * Calculate download speed
   */
  calculateDownloadSpeed(downloadState) {
    const elapsed = Date.now() - downloadState.startTime;
    if (elapsed === 0) return 0;
    
    return (downloadState.bytesDownloaded / elapsed) * 1000; // bytes per second
  }

  /**
   * Calculate piece size
   */
  calculatePieceSize(fileInfo, pieceIndex) {
    if (pieceIndex < fileInfo.pieceCount - 1) {
      return this.PIECE_SIZE;
    } else {
      // Last piece might be smaller
      return fileInfo.size - (pieceIndex * this.PIECE_SIZE);
    }
  }

  /**
   * Utility functions
   */
  async readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  async calculateFileHash(buffer) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async calculatePieceHash(pieceData) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', pieceData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async createFilePieces(buffer) {
    const pieces = [];
    
    for (let offset = 0; offset < buffer.byteLength; offset += this.PIECE_SIZE) {
      const end = Math.min(offset + this.PIECE_SIZE, buffer.byteLength);
      const pieceData = buffer.slice(offset, end);
      const pieceHash = await this.calculatePieceHash(pieceData);
      
      pieces.push({
        index: pieces.length,
        offset: offset,
        size: end - offset,
        hash: pieceHash,
        data: new Uint8Array(pieceData)
      });
    }
    
    return pieces;
  }

  /**
   * Event emitters
   */
  emitFileAdded(fileInfo) {
    if (this.onFileAdded) {
      this.onFileAdded(fileInfo);
    }
  }

  emitFileRemoved(fileHash) {
    if (this.onFileRemoved) {
      this.onFileRemoved(fileHash);
    }
  }

  emitDownloadProgress(progress) {
    if (this.onDownloadProgress) {
      this.onDownloadProgress(progress);
    }
  }

  emitDownloadComplete(fileInfo, downloadUrl) {
    if (this.onDownloadComplete) {
      this.onDownloadComplete(fileInfo, downloadUrl);
    }
  }

  emitUploadProgress(progress) {
    if (this.onUploadProgress) {
      this.onUploadProgress(progress);
    }
  }

  emitError(message, error) {
    console.error(message, error);
    if (this.onError) {
      this.onError(message, error);
    }
  }

  /**
   * Get file info
   */
  getFileInfo(fileHash) {
    return this.files.get(fileHash);
  }

  /**
   * Get all files
   */
  getAllFiles() {
    return Array.from(this.files.values());
  }

  /**
   * Get download progress
   */
  getDownloadProgress(fileHash) {
    const downloadState = this.downloads.get(fileHash);
    if (!downloadState) return null;

    return {
      fileHash: fileHash,
      fileName: downloadState.fileInfo.name,
      progress: (downloadState.completedPieces / downloadState.totalPieces) * 100,
      completedPieces: downloadState.completedPieces,
      totalPieces: downloadState.totalPieces,
      bytesDownloaded: downloadState.bytesDownloaded,
      totalSize: downloadState.fileInfo.size,
      speed: this.calculateDownloadSpeed(downloadState),
      peers: downloadState.peers.size,
      status: downloadState.status
    };
  }

  /**
   * Get all active downloads
   */
  getActiveDownloads() {
    const downloads = [];
    for (const fileHash of this.downloads.keys()) {
      const progress = this.getDownloadProgress(fileHash);
      if (progress) downloads.push(progress);
    }
    return downloads;
  }
}

export default FileManager;