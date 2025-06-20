export class P2PClient {
  constructor() {
    this.ws = null;
    this.peerId = null;
    this.peers = new Map();
    this.connections = new Map();
    this.torrents = new Map();
    this.eventListeners = new Map();
    this.iceServers = [];
    this.currentRoom = null;
    this.files = new Map();
    this.chunks = new Map();
    this.stats = {
      uploadSpeed: 0,
      downloadSpeed: 0,
      totalUploaded: 0,
      totalDownloaded: 0
    };
    
    this.chunkSize = 64 * 1024; // 64KB chunks
  }

  async connect() {
    try {
      // Get ICE servers configuration
      const response = await fetch('/api/ice-servers');
      const config = await response.json();
      this.iceServers = config.iceServers;

      // Connect to signaling server
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/signaling`;
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('Connected to signaling server');
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleSignalingMessage(message);
      };

      this.ws.onclose = () => {
        console.log('Disconnected from signaling server');
        this.emit('disconnected');
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to connect:', error);
      throw error;
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
    
    this.connections.forEach(connection => {
      connection.close();
    });
    
    this.connections.clear();
    this.peers.clear();
  }

  async joinRoom(roomId) {
    this.currentRoom = roomId;
    this.send({ type: 'join-room', roomId });
  }

  async leaveRoom() {
    if (this.currentRoom) {
      this.send({ type: 'leave-room', roomId: this.currentRoom });
      this.currentRoom = null;
    }
  }

  handleSignalingMessage(message) {
    switch (message.type) {
      case 'welcome':
        this.peerId = message.peerId;
        this.emit('connected', this.peerId);
        // Auto-join default room
        this.joinRoom('default');
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
    }
  }

  async handlePeerJoined(message) {
    const { peerId } = message;
    await this.createPeerConnection(peerId, true);
  }

  handlePeerLeft(message) {
    const { peerId } = message;
    
    if (this.connections.has(peerId)) {
      this.connections.get(peerId).close();
      this.connections.delete(peerId);
    }
    
    this.peers.delete(peerId);
    this.updatePeersList();
  }

  async handleRoomState(message) {
    const { peers } = message;
    
    for (const peerId of peers) {
      await this.createPeerConnection(peerId, false);
    }
  }

  async createPeerConnection(peerId, isInitiator) {
    if (this.connections.has(peerId)) {
      return;
    }

    const connection = new RTCPeerConnection({
      iceServers: this.iceServers
    });

    // Create data channel for file transfer
    let dataChannel;
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
          candidate: event.candidate
        });
      }
    };

    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'connected') {
        console.log(`Connected to peer: ${peerId}`);
        this.peers.set(peerId, { 
          connection, 
          dataChannel, 
          connected: true,
          lastSeen: Date.now()
        });
        this.updatePeersList();
      } else if (connection.connectionState === 'disconnected' || 
                 connection.connectionState === 'failed') {
        this.peers.delete(peerId);
        this.connections.delete(peerId);
        this.updatePeersList();
      }
    };

    this.connections.set(peerId, connection);

    if (isInitiator) {
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      
      this.send({
        type: 'offer',
        targetPeerId: peerId,
        offer: offer
      });
    }
  }

  async handleOffer(message) {
    const { fromPeerId, offer } = message;
    const connection = this.connections.get(fromPeerId);
    
    if (connection) {
      await connection.setRemoteDescription(offer);
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      
      this.send({
        type: 'answer',
        targetPeerId: fromPeerId,
        answer: answer
      });
    }
  }

  async handleAnswer(message) {
    const { fromPeerId, answer } = message;
    const connection = this.connections.get(fromPeerId);
    
    if (connection) {
      await connection.setRemoteDescription(answer);
    }
  }

  async handleIceCandidate(message) {
    const { fromPeerId, candidate } = message;
    const connection = this.connections.get(fromPeerId);
    
    if (connection) {
      await connection.addIceCandidate(candidate);
    }
  }

  setupDataChannel(dataChannel, peerId) {
    dataChannel.onopen = () => {
      console.log(`Data channel opened with peer: ${peerId}`);
    };

    dataChannel.onmessage = (event) => {
      this.handleDataChannelMessage(event.data, peerId);
    };

    dataChannel.onerror = (error) => {
      console.error(`Data channel error with peer ${peerId}:`, error);
    };
  }

  handleDataChannelMessage(data, peerId) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'chunk-request':
          this.handleChunkRequest(message, peerId);
          break;
        case 'chunk-data':
          this.handleChunkData(message, peerId);
          break;
        case 'file-info':
          this.handleFileInfo(message, peerId);
          break;
      }
    } catch (error) {
      // Handle binary chunk data
      this.handleBinaryChunk(data, peerId);
    }
  }

  async addFile(file) {
    const fileBuffer = await file.arrayBuffer();
    const hash = await this.calculateFileHash(fileBuffer);
    
    const fileInfo = {
      name: file.name,
      size: file.size,
      hash,
      type: file.type,
      chunks: Math.ceil(file.size / this.chunkSize),
      uploadedAt: Date.now()
    };

    // Store file chunks
    const chunks = [];
    for (let i = 0; i < fileInfo.chunks; i++) {
      const start = i * this.chunkSize;
      const end = Math.min(start + this.chunkSize, file.size);
      chunks.push(fileBuffer.slice(start, end));
    }

    this.files.set(hash, fileBuffer);
    this.chunks.set(hash, chunks);

    // Add to torrents
    const torrent = {
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
      fileInfo
    });

    this.updateTorrentsList();
    return hash;
  }

  async downloadFile(fileHash) {
    this.send({
      type: 'request-file',
      roomId: this.currentRoom,
      fileHash
    });

    // Request file info from peers
    this.peers.forEach((peer, peerId) => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(JSON.stringify({
          type: 'file-info',
          fileHash
        }));
      }
    });
  }

  handleFileAnnounced(message) {
    const { fileInfo } = message;
    
    if (!this.torrents.has(fileInfo.hash)) {
      const torrent = {
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
    }
  }

  handleFileRequested(message) {
    const { fileHash, requestedBy } = message;
    
    if (this.files.has(fileHash)) {
      const peer = this.peers.get(requestedBy);
      if (peer && peer.dataChannel && peer.dataChannel.readyState === 'open') {
        // Send file info
        const torrent = this.torrents.get(fileHash);
        peer.dataChannel.send(JSON.stringify({
          type: 'file-info',
          fileHash,
          fileInfo: {
            name: torrent.name,
            size: torrent.size,
            chunks: torrent.chunks,
            type: torrent.type
          }
        }));
      }
    }
  }

  handleChunkRequest(message, peerId) {
    const { fileHash, chunkIndex } = message;
    
    if (this.chunks.has(fileHash)) {
      const chunks = this.chunks.get(fileHash);
      if (chunkIndex < chunks.length) {
        const peer = this.peers.get(peerId);
        if (peer && peer.dataChannel && peer.dataChannel.readyState === 'open') {
          // Send chunk data
          const chunkData = {
            type: 'chunk-data',
            fileHash,
            chunkIndex,
            data: Array.from(new Uint8Array(chunks[chunkIndex]))
          };
          
          peer.dataChannel.send(JSON.stringify(chunkData));
          
          // Update upload stats
          this.stats.totalUploaded += chunks[chunkIndex].byteLength;
          this.updateStats();
        }
      }
    }
  }

  handleChunkData(message, peerId) {
    const { fileHash, chunkIndex, data } = message;
    
    if (!this.chunks.has(fileHash)) {
      this.chunks.set(fileHash, []);
    }
    
    const chunks = this.chunks.get(fileHash);
    chunks[chunkIndex] = new Uint8Array(data).buffer;
    
    // Update download progress
    if (this.torrents.has(fileHash)) {
      const torrent = this.torrents.get(fileHash);
      const receivedChunks = chunks.filter(chunk => chunk).length;
      torrent.progress = (receivedChunks / torrent.chunks) * 100;
      
      if (torrent.progress === 100) {
        // File download complete - reconstruct file
        this.reconstructFile(fileHash);
        torrent.status = 'seeding';
      } else {
        torrent.status = 'downloading';
      }
      
      this.updateTorrentsList();
    }
    
    // Update download stats
    this.stats.totalDownloaded += data.length;
    this.updateStats();
  }

  handleFileInfo(message, peerId) {
    const { fileHash, fileInfo } = message;
    
    if (!this.torrents.has(fileHash)) {
      const torrent = {
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
    
    // Start requesting chunks
    this.requestFileChunks(fileHash, peerId);
  }

  requestFileChunks(fileHash, peerId) {
    const torrent = this.torrents.get(fileHash);
    if (!torrent) return;
    
    const peer = this.peers.get(peerId);
    if (!peer || !peer.dataChannel || peer.dataChannel.readyState !== 'open') return;
    
    // Request chunks sequentially (can be optimized for parallel requests)
    for (let i = 0; i < torrent.chunks; i++) {
      setTimeout(() => {
        peer.dataChannel.send(JSON.stringify({
          type: 'chunk-request',
          fileHash,
          chunkIndex: i
        }));
      }, i * 100); // Stagger requests
    }
  }

  async reconstructFile(fileHash) {
    const chunks = this.chunks.get(fileHash);
    const torrent = this.torrents.get(fileHash);
    
    if (chunks && torrent) {
      // Combine all chunks
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
      const calculatedHash = await this.calculateFileHash(fileBuffer);
      if (calculatedHash === fileHash) {
        this.files.set(fileHash, fileBuffer);
        console.log(`File download completed: ${torrent.name}`);
        
        // Trigger download
        const blob = new Blob([fileBuffer], { type: torrent.type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = torrent.name;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        console.error('File hash verification failed');
      }
    }
  }

  async calculateFileHash(buffer) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  updatePeersList() {
    const peerList = Array.from(this.peers.entries()).map(([id, peer]) => ({
      id,
      connected: peer.connected,
      lastSeen: peer.lastSeen
    }));
    
    this.emit('peers-updated', peerList);
  }

  updateTorrentsList() {
    const torrentList = Array.from(this.torrents.values());
    this.emit('torrents-updated', torrentList);
  }

  updateStats() {
    this.emit('stats-updated', this.stats);
  }

  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => callback(data));
    }
  }
}