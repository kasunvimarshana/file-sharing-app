import { 
  Peer, 
  TorrentFile, 
  NetworkStats, 
  ChunkData, 
  FileInfo, 
  SignalingMessage, 
  ConnectionConfig,
  AppError
} from '../types';
import { logger } from '../utils/logger';
import { CryptoUtils } from '../utils/crypto';
import { ErrorHandler } from '../utils/error-handler';
import { validateFile, validateFileHash, validatePeerId } from '../utils/validation';

export class P2PClient {
  private ws: WebSocket | null = null;
  private peerId: string = '';
  private peers = new Map<string, Peer>();
  private connections = new Map<string, RTCPeerConnection>();
  private torrents = new Map<string, TorrentFile>();
  private eventListeners = new Map<string, Function[]>();
  private files = new Map<string, ArrayBuffer>();
  private chunks = new Map<string, ArrayBuffer[]>();
  private downloadProgress = new Map<string, Set<number>>();
  private config: ConnectionConfig;
  private currentRoom: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private connectionTimeout = 30000;
  private chunkTimeout = 10000;
  private stats: NetworkStats = {
    uploadSpeed: 0,
    downloadSpeed: 0,
    connectedPeers: 0,
    totalTransferred: 0,
    totalUploaded: 0,
    totalDownloaded: 0,
    activeConnections: 0,
    failedConnections: 0
  };

  constructor(config?: Partial<ConnectionConfig>) {
    this.config = {
      iceServers: [],
      maxConnections: 50,
      chunkSize: 64 * 1024, // 64KB
      timeout: 30000,
      retryAttempts: 3,
      ...config
    };

    this.setupPeriodicTasks();
  }

  async connect(): Promise<void> {
    try {
      // Get ICE servers configuration
      const response = await fetch('/api/ice-servers');
      if (!response.ok) {
        throw new Error(`Failed to get ICE servers: ${response.statusText}`);
      }
      
      const config = await response.json();
      this.config.iceServers = config.iceServers;

      await this.connectWebSocket();
    } catch (error) {
      const appError = ErrorHandler.handle(error as Error, 'P2PClient.connect');
      this.emit('error', appError);
      throw appError;
    }
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/signaling`;
        
        this.ws = new WebSocket(wsUrl);
        
        const timeout = setTimeout(() => {
          if (this.ws) {
            this.ws.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, this.connectionTimeout);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          logger.info('Connected to signaling server');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: SignalingMessage = JSON.parse(event.data);
            this.handleSignalingMessage(message);
          } catch (error) {
            logger.error('Failed to parse signaling message:', error);
          }
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          logger.warn(`WebSocket closed: ${event.code} ${event.reason}`);
          this.emit('disconnected');
          this.handleReconnection();
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          logger.error('WebSocket error:', error);
          reject(new Error('WebSocket connection failed'));
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  private handleReconnection(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      logger.info(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(async () => {
        try {
          await this.connectWebSocket();
        } catch (error) {
          logger.error('Reconnection failed:', error);
        }
      }, delay);
    } else {
      logger.error('Max reconnection attempts reached');
      this.emit('error', ErrorHandler.createError('CONNECTION_FAILED', 'Failed to reconnect to signaling server'));
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.connections.forEach(connection => {
      connection.close();
    });
    
    this.connections.clear();
    this.peers.clear();
    this.peerId = '';
  }

  async joinRoom(roomId: string): Promise<void> {
    try {
      if (!roomId || roomId.trim().length === 0) {
        throw new Error('Room ID is required');
      }

      this.currentRoom = roomId.trim();
      this.send({ 
        type: 'join-room', 
        roomId: this.currentRoom,
        timestamp: Date.now()
      });
      
      logger.info(`Joining room: ${this.currentRoom}`);
    } catch (error) {
      const appError = ErrorHandler.handle(error as Error, 'P2PClient.joinRoom');
      this.emit('error', appError);
      throw appError;
    }
  }

  async leaveRoom(): Promise<void> {
    if (this.currentRoom) {
      this.send({ 
        type: 'leave-room', 
        roomId: this.currentRoom,
        timestamp: Date.now()
      });
      this.currentRoom = null;
      logger.info('Left room');
    }
  }

  private handleSignalingMessage(message: SignalingMessage): void {
    try {
      switch (message.type) {
        case 'welcome':
          this.handleWelcome(message);
          break;
        case 'peer-joined':
          this.handlePeerJoined(message);
          break;
        case 'peer-left':
          this.handlePeerLeft(message);
          break;
        case 'room-state':
          this.handleRoomState(message);
          break;
        case 'offer':
          this.handleOffer(message);
          break;
        case 'answer':
          this.handleAnswer(message);
          break;
        case 'ice-candidate':
          this.handleIceCandidate(message);
          break;
        case 'file-announced':
          this.handleFileAnnounced(message);
          break;
        case 'file-requested':
          this.handleFileRequested(message);
          break;
        default:
          logger.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error('Error handling signaling message:', error);
    }
  }

  private handleWelcome(message: SignalingMessage): void {
    this.peerId = message.peerId!;
    this.emit('connected', this.peerId);
    logger.info(`Connected with peer ID: ${this.peerId}`);
    
    // Auto-join default room
    this.joinRoom('default');
  }

  private async handlePeerJoined(message: SignalingMessage): Promise<void> {
    const { peerId } = message;
    if (peerId && peerId !== this.peerId) {
      await this.createPeerConnection(peerId, true);
    }
  }

  private handlePeerLeft(message: SignalingMessage): void {
    const { peerId } = message;
    if (peerId) {
      this.removePeer(peerId);
    }
  }

  private async handleRoomState(message: SignalingMessage): Promise<void> {
    const { data } = message;
    if (data?.peers) {
      for (const peerId of data.peers) {
        if (peerId !== this.peerId) {
          await this.createPeerConnection(peerId, false);
        }
      }
    }
  }

  private async createPeerConnection(peerId: string, isInitiator: boolean): Promise<void> {
    try {
      validatePeerId(peerId);
      
      if (this.connections.has(peerId)) {
        logger.debug(`Connection already exists for peer: ${peerId}`);
        return;
      }

      if (this.connections.size >= this.config.maxConnections) {
        logger.warn(`Max connections reached (${this.config.maxConnections})`);
        return;
      }

      const connection = new RTCPeerConnection({
        iceServers: this.config.iceServers,
        iceCandidatePoolSize: 10
      });

      // Set up connection timeout
      const timeout = setTimeout(() => {
        if (connection.connectionState !== 'connected') {
          logger.warn(`Connection timeout for peer: ${peerId}`);
          connection.close();
          this.connections.delete(peerId);
          this.stats.failedConnections++;
        }
      }, this.connectionTimeout);

      let dataChannel: RTCDataChannel;
      
      if (isInitiator) {
        dataChannel = connection.createDataChannel('files', {
          ordered: true,
          maxRetransmits: 3
        });
        this.setupDataChannel(dataChannel, peerId);
      } else {
        connection.ondatachannel = (event) => {
          dataChannel = event.channel;
          this.setupDataChannel(dataChannel, peerId);
        };
      }

      connection.onicecandidate = (event) => {
        if (event.candidate) {
          this.send({
            type: 'ice-candidate',
            targetPeerId: peerId,
            data: event.candidate,
            timestamp: Date.now()
          });
        }
      };

      connection.onconnectionstatechange = () => {
        logger.debug(`Connection state changed for ${peerId}: ${connection.connectionState}`);
        
        switch (connection.connectionState) {
          case 'connected':
            clearTimeout(timeout);
            this.peers.set(peerId, { 
              id: peerId,
              connection, 
              dataChannel, 
              connected: true,
              lastSeen: Date.now()
            });
            this.stats.activeConnections++;
            this.updatePeersList();
            logger.info(`Connected to peer: ${peerId}`);
            break;
            
          case 'disconnected':
          case 'failed':
          case 'closed':
            clearTimeout(timeout);
            this.removePeer(peerId);
            break;
        }
      };

      connection.onicegatheringstatechange = () => {
        logger.debug(`ICE gathering state for ${peerId}: ${connection.iceGatheringState}`);
      };

      this.connections.set(peerId, connection);

      if (isInitiator) {
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        
        this.send({
          type: 'offer',
          targetPeerId: peerId,
          data: offer,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      logger.error(`Failed to create peer connection for ${peerId}:`, error);
      this.stats.failedConnections++;
    }
  }

  private async handleOffer(message: SignalingMessage): Promise<void> {
    try {
      const { peerId: fromPeerId, data: offer } = message;
      if (!fromPeerId || !offer) return;

      const connection = this.connections.get(fromPeerId);
      if (!connection) {
        logger.warn(`No connection found for peer: ${fromPeerId}`);
        return;
      }

      await connection.setRemoteDescription(offer);
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      
      this.send({
        type: 'answer',
        targetPeerId: fromPeerId,
        data: answer,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Failed to handle offer:', error);
    }
  }

  private async handleAnswer(message: SignalingMessage): Promise<void> {
    try {
      const { peerId: fromPeerId, data: answer } = message;
      if (!fromPeerId || !answer) return;

      const connection = this.connections.get(fromPeerId);
      if (connection) {
        await connection.setRemoteDescription(answer);
      }
    } catch (error) {
      logger.error('Failed to handle answer:', error);
    }
  }

  private async handleIceCandidate(message: SignalingMessage): Promise<void> {
    try {
      const { peerId: fromPeerId, data: candidate } = message;
      if (!fromPeerId || !candidate) return;

      const connection = this.connections.get(fromPeerId);
      if (connection) {
        await connection.addIceCandidate(candidate);
      }
    } catch (error) {
      logger.error('Failed to handle ICE candidate:', error);
    }
  }

  private setupDataChannel(dataChannel: RTCDataChannel, peerId: string): void {
    dataChannel.binaryType = 'arraybuffer';
    
    dataChannel.onopen = () => {
      logger.info(`Data channel opened with peer: ${peerId}`);
    };

    dataChannel.onmessage = (event) => {
      this.handleDataChannelMessage(event.data, peerId);
    };

    dataChannel.onerror = (error) => {
      logger.error(`Data channel error with peer ${peerId}:`, error);
    };

    dataChannel.onclose = () => {
      logger.info(`Data channel closed with peer: ${peerId}`);
    };
  }

  private async handleDataChannelMessage(data: any, peerId: string): Promise<void> {
    try {
      if (typeof data === 'string') {
        const message = JSON.parse(data);
        await this.handlePeerMessage(message, peerId);
      } else if (data instanceof ArrayBuffer) {
        await this.handleBinaryData(data, peerId);
      }
    } catch (error) {
      logger.error(`Error handling data channel message from ${peerId}:`, error);
    }
  }

  private async handlePeerMessage(message: any, peerId: string): Promise<void> {
    switch (message.type) {
      case 'chunk-request':
        await this.handleChunkRequest(message, peerId);
        break;
      case 'chunk-data':
        await this.handleChunkData(message, peerId);
        break;
      case 'file-info':
        await this.handleFileInfo(message, peerId);
        break;
      case 'ping':
        await this.handlePing(peerId);
        break;
      case 'pong':
        this.handlePong(peerId);
        break;
    }
  }

  private async handleBinaryData(data: ArrayBuffer, peerId: string): Promise<void> {
    // Handle binary chunk data
    logger.debug(`Received binary data from ${peerId}: ${data.byteLength} bytes`);
    this.stats.totalDownloaded += data.byteLength;
    this.updateStats();
  }

  async addFile(file: File): Promise<string> {
    try {
      validateFile(file);
      
      const fileBuffer = await file.arrayBuffer();
      const hash = await CryptoUtils.calculateFileHash(fileBuffer);
      
      if (this.files.has(hash)) {
        logger.info(`File already exists: ${file.name}`);
        return hash;
      }

      const fileInfo: FileInfo = {
        name: file.name,
        size: file.size,
        hash,
        type: file.type,
        chunks: Math.ceil(file.size / this.config.chunkSize),
        checksum: hash,
        uploadedAt: Date.now()
      };

      // Store file and create chunks
      await this.storeFileAndChunks(fileBuffer, fileInfo);

      // Add to torrents
      const torrent: TorrentFile = {
        ...fileInfo,
        status: 'seeding',
        progress: 100,
        seeders: 1,
        leechers: 0,
        downloadSpeed: 0,
        uploadSpeed: 0
      };

      this.torrents.set(hash, torrent);

      // Announce file to the network
      this.send({
        type: 'announce-file',
        roomId: this.currentRoom,
        data: fileInfo,
        timestamp: Date.now()
      });

      this.updateTorrentsList();
      logger.info(`File added successfully: ${file.name} (${hash})`);
      
      return hash;
    } catch (error) {
      const appError = ErrorHandler.handle(error as Error, 'P2PClient.addFile');
      this.emit('error', appError);
      throw appError;
    }
  }

  private async storeFileAndChunks(fileBuffer: ArrayBuffer, fileInfo: FileInfo): Promise<void> {
    this.files.set(fileInfo.hash, fileBuffer);
    
    const chunks: ArrayBuffer[] = [];
    for (let i = 0; i < fileInfo.chunks; i++) {
      const start = i * this.config.chunkSize;
      const end = Math.min(start + this.config.chunkSize, fileInfo.size);
      chunks.push(fileBuffer.slice(start, end));
    }
    
    this.chunks.set(fileInfo.hash, chunks);
  }

  async downloadFile(fileHash: string): Promise<void> {
    try {
      validateFileHash(fileHash);
      
      if (this.files.has(fileHash)) {
        logger.info(`File already downloaded: ${fileHash}`);
        return;
      }

      const torrent = this.torrents.get(fileHash);
      if (!torrent) {
        throw new Error('File not found in torrent list');
      }

      if (torrent.status === 'downloading') {
        logger.info(`File already downloading: ${fileHash}`);
        return;
      }

      torrent.status = 'downloading';
      torrent.progress = 0;
      this.downloadProgress.set(fileHash, new Set());

      // Request file from the network
      this.send({
        type: 'request-file',
        roomId: this.currentRoom,
        data: { fileHash },
        timestamp: Date.now()
      });

      // Request file info from connected peers
      this.peers.forEach((peer, peerId) => {
        if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
          peer.dataChannel.send(JSON.stringify({
            type: 'file-info',
            fileHash,
            timestamp: Date.now()
          }));
        }
      });

      this.updateTorrentsList();
      logger.info(`Started downloading file: ${fileHash}`);
    } catch (error) {
      const appError = ErrorHandler.handle(error as Error, 'P2PClient.downloadFile');
      this.emit('error', appError);
      throw appError;
    }
  }

  private removePeer(peerId: string): void {
    const connection = this.connections.get(peerId);
    if (connection) {
      connection.close();
      this.connections.delete(peerId);
    }
    
    if (this.peers.has(peerId)) {
      this.peers.delete(peerId);
      this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1);
    }
    
    this.updatePeersList();
    logger.info(`Removed peer: ${peerId}`);
  }

  private async handleChunkRequest(message: any, peerId: string): Promise<void> {
    const { fileHash, chunkIndex } = message;
    
    if (!this.chunks.has(fileHash)) {
      logger.warn(`Chunk request for unknown file: ${fileHash}`);
      return;
    }

    const chunks = this.chunks.get(fileHash)!;
    if (chunkIndex >= chunks.length) {
      logger.warn(`Invalid chunk index: ${chunkIndex} for file: ${fileHash}`);
      return;
    }

    const peer = this.peers.get(peerId);
    if (!peer?.dataChannel || peer.dataChannel.readyState !== 'open') {
      logger.warn(`Cannot send chunk to peer ${peerId}: channel not ready`);
      return;
    }

    try {
      const chunk = chunks[chunkIndex];
      const checksum = await CryptoUtils.calculateChunkChecksum(chunk);
      
      const chunkData = {
        type: 'chunk-data',
        fileHash,
        chunkIndex,
        checksum,
        data: Array.from(new Uint8Array(chunk)),
        timestamp: Date.now()
      };
      
      peer.dataChannel.send(JSON.stringify(chunkData));
      
      // Update upload stats
      this.stats.totalUploaded += chunk.byteLength;
      this.updateStats();
      
      logger.debug(`Sent chunk ${chunkIndex} for file ${fileHash} to peer ${peerId}`);
    } catch (error) {
      logger.error(`Failed to send chunk ${chunkIndex} to peer ${peerId}:`, error);
    }
  }

  private async handleChunkData(message: any, peerId: string): Promise<void> {
    const { fileHash, chunkIndex, checksum, data } = message;
    
    if (!this.downloadProgress.has(fileHash)) {
      logger.warn(`Received chunk for file not being downloaded: ${fileHash}`);
      return;
    }

    try {
      const chunkBuffer = new Uint8Array(data).buffer;
      
      // Verify chunk integrity
      if (checksum) {
        const isValid = await CryptoUtils.verifyChunkIntegrity(chunkBuffer, checksum);
        if (!isValid) {
          logger.error(`Chunk integrity verification failed for chunk ${chunkIndex} of file ${fileHash}`);
          return;
        }
      }

      // Store chunk
      if (!this.chunks.has(fileHash)) {
        this.chunks.set(fileHash, []);
      }
      
      const chunks = this.chunks.get(fileHash)!;
      chunks[chunkIndex] = chunkBuffer;
      
      // Update progress
      const progress = this.downloadProgress.get(fileHash)!;
      progress.add(chunkIndex);
      
      const torrent = this.torrents.get(fileHash);
      if (torrent) {
        torrent.progress = (progress.size / torrent.chunks) * 100;
        
        if (progress.size === torrent.chunks) {
          // Download complete
          await this.completeFileDownload(fileHash);
        }
        
        this.updateTorrentsList();
      }
      
      // Update download stats
      this.stats.totalDownloaded += chunkBuffer.byteLength;
      this.updateStats();
      
      logger.debug(`Received chunk ${chunkIndex} for file ${fileHash} from peer ${peerId}`);
    } catch (error) {
      logger.error(`Failed to handle chunk data from peer ${peerId}:`, error);
    }
  }

  private async completeFileDownload(fileHash: string): Promise<void> {
    try {
      const chunks = this.chunks.get(fileHash);
      const torrent = this.torrents.get(fileHash);
      
      if (!chunks || !torrent) {
        throw new Error('Missing chunks or torrent data');
      }

      // Reconstruct file
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      const fileBuffer = new ArrayBuffer(totalSize);
      const fileView = new Uint8Array(fileBuffer);
      
      let offset = 0;
      for (const chunk of chunks) {
        const chunkView = new Uint8Array(chunk);
        fileView.set(chunkView, offset);
        offset += chunkView.length;
      }
      
      // Verify file hash
      const calculatedHash = await CryptoUtils.calculateFileHash(fileBuffer);
      if (calculatedHash !== fileHash) {
        throw new Error('File hash verification failed');
      }

      // Store file
      this.files.set(fileHash, fileBuffer);
      
      // Update torrent status
      torrent.status = 'seeding';
      torrent.progress = 100;
      torrent.completedAt = Date.now();
      torrent.seeders = (torrent.seeders || 0) + 1;
      
      // Clean up download progress
      this.downloadProgress.delete(fileHash);
      
      // Trigger download
      this.triggerFileDownload(fileBuffer, torrent);
      
      logger.info(`File download completed: ${torrent.name}`);
      this.emit('download-complete', { fileHash, torrent });
      
    } catch (error) {
      logger.error(`Failed to complete file download for ${fileHash}:`, error);
      
      const torrent = this.torrents.get(fileHash);
      if (torrent) {
        torrent.status = 'error';
        torrent.error = error instanceof Error ? error.message : 'Unknown error';
        this.updateTorrentsList();
      }
    }
  }

  private triggerFileDownload(fileBuffer: ArrayBuffer, torrent: TorrentFile): void {
    try {
      const blob = new Blob([fileBuffer], { type: torrent.type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = torrent.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Failed to trigger file download:', error);
    }
  }

  private handleFileAnnounced(message: SignalingMessage): void {
    const { data: fileInfo } = message;
    if (!fileInfo) return;
    
    if (!this.torrents.has(fileInfo.hash)) {
      const torrent: TorrentFile = {
        ...fileInfo,
        status: 'available',
        progress: 0,
        seeders: fileInfo.seeders || 1,
        leechers: 0,
        downloadSpeed: 0,
        uploadSpeed: 0
      };
      
      this.torrents.set(fileInfo.hash, torrent);
      this.updateTorrentsList();
      logger.info(`New file announced: ${fileInfo.name}`);
    }
  }

  private handleFileRequested(message: SignalingMessage): void {
    const { data, peerId: requestedBy } = message;
    if (!data?.fileHash || !requestedBy) return;
    
    const { fileHash } = data;
    
    if (this.files.has(fileHash)) {
      const peer = this.peers.get(requestedBy);
      if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
        const torrent = this.torrents.get(fileHash);
        if (torrent) {
          peer.dataChannel.send(JSON.stringify({
            type: 'file-info',
            fileHash,
            fileInfo: {
              name: torrent.name,
              size: torrent.size,
              chunks: torrent.chunks,
              type: torrent.type,
              checksum: torrent.hash
            },
            timestamp: Date.now()
          }));
        }
      }
    }
  }

  private async handleFileInfo(message: any, peerId: string): Promise<void> {
    const { fileHash, fileInfo } = message;
    
    if (!fileInfo) return;

    if (!this.torrents.has(fileHash)) {
      const torrent: TorrentFile = {
        ...fileInfo,
        hash: fileHash,
        status: 'available',
        progress: 0,
        seeders: 1,
        leechers: 0,
        downloadSpeed: 0,
        uploadSpeed: 0
      };
      
      this.torrents.set(fileHash, torrent);
      this.updateTorrentsList();
    }
    
    // Start requesting chunks if we're downloading this file
    if (this.downloadProgress.has(fileHash)) {
      await this.requestFileChunks(fileHash, peerId);
    }
  }

  private async requestFileChunks(fileHash: string, peerId: string): Promise<void> {
    const torrent = this.torrents.get(fileHash);
    const peer = this.peers.get(peerId);
    
    if (!torrent || !peer?.dataChannel || peer.dataChannel.readyState !== 'open') {
      return;
    }
    
    const progress = this.downloadProgress.get(fileHash);
    if (!progress) return;

    // Request missing chunks
    for (let i = 0; i < torrent.chunks; i++) {
      if (!progress.has(i)) {
        setTimeout(() => {
          if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
            peer.dataChannel.send(JSON.stringify({
              type: 'chunk-request',
              fileHash,
              chunkIndex: i,
              timestamp: Date.now()
            }));
          }
        }, i * 50); // Stagger requests to avoid overwhelming
      }
    }
  }

  private async handlePing(peerId: string): Promise<void> {
    const peer = this.peers.get(peerId);
    if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
      peer.dataChannel.send(JSON.stringify({
        type: 'pong',
        timestamp: Date.now()
      }));
    }
  }

  private handlePong(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.lastSeen = Date.now();
    }
  }

  private setupPeriodicTasks(): void {
    // Ping peers every 30 seconds
    setInterval(() => {
      this.peers.forEach((peer, peerId) => {
        if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
          peer.dataChannel.send(JSON.stringify({
            type: 'ping',
            timestamp: Date.now()
          }));
        }
      });
    }, 30000);

    // Clean up stale connections every 60 seconds
    setInterval(() => {
      const now = Date.now();
      const staleTimeout = 120000; // 2 minutes
      
      this.peers.forEach((peer, peerId) => {
        if (now - peer.lastSeen > staleTimeout) {
          logger.info(`Removing stale peer: ${peerId}`);
          this.removePeer(peerId);
        }
      });
    }, 60000);

    // Update stats every 5 seconds
    setInterval(() => {
      this.updateStats();
    }, 5000);
  }

  private send(message: SignalingMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      logger.warn('Cannot send message: WebSocket not connected');
    }
  }

  private updatePeersList(): void {
    const peerList = Array.from(this.peers.values());
    this.stats.connectedPeers = peerList.length;
    this.emit('peers-updated', peerList);
  }

  private updateTorrentsList(): void {
    const torrentList = Array.from(this.torrents.values());
    this.emit('torrents-updated', torrentList);
  }

  private updateStats(): void {
    this.stats.activeConnections = this.peers.size;
    this.emit('stats-updated', { ...this.stats });
  }

  // Public API methods
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Getters for current state
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get currentPeerId(): string {
    return this.peerId;
  }

  get currentStats(): NetworkStats {
    return { ...this.stats };
  }

  get activeTorrents(): TorrentFile[] {
    return Array.from(this.torrents.values()).filter(t => 
      t.status === 'downloading' || t.status === 'seeding'
    );
  }
}