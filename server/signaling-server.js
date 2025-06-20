export class SignalingServer {
  constructor(wss) {
    this.wss = wss;
    this.peers = new Map();
    this.rooms = new Map();
    
    this.setupWebSocketHandlers();
  }

  setupWebSocketHandlers() {
    this.wss.on('connection', (ws, request) => {
      const peerId = this.generatePeerId();
      
      console.log(`🔗 Peer connected: ${peerId}`);
      
      ws.peerId = peerId;
      ws.isAlive = true;
      
      this.peers.set(peerId, {
        ws,
        rooms: new Set(),
        metadata: {}
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(peerId, message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });

      ws.on('close', () => {
        console.log(`🔌 Peer disconnected: ${peerId}`);
        this.handlePeerDisconnect(peerId);
      });

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Send welcome message
      this.sendToPeer(peerId, {
        type: 'welcome',
        peerId,
        timestamp: Date.now()
      });
    });

    // Heartbeat mechanism
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  handleMessage(peerId, message) {
    switch (message.type) {
      case 'join-room':
        this.handleJoinRoom(peerId, message);
        break;
      case 'leave-room':
        this.handleLeaveRoom(peerId, message);
        break;
      case 'offer':
      case 'answer':
      case 'ice-candidate':
        this.handleWebRTCSignaling(peerId, message);
        break;
      case 'announce-file':
        this.handleFileAnnouncement(peerId, message);
        break;
      case 'request-file':
        this.handleFileRequest(peerId, message);
        break;
      case 'peer-metadata':
        this.handlePeerMetadata(peerId, message);
        break;
      default:
        console.log(`Unknown message type: ${message.type}`);
    }
  }

  handleJoinRoom(peerId, message) {
    const { roomId } = message;
    
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        peers: new Set(),
        files: new Map(),
        createdAt: Date.now()
      });
    }

    const room = this.rooms.get(roomId);
    const peer = this.peers.get(peerId);
    
    if (peer) {
      room.peers.add(peerId);
      peer.rooms.add(roomId);
      
      // Notify other peers in the room
      this.broadcastToRoom(roomId, {
        type: 'peer-joined',
        peerId,
        roomId,
        timestamp: Date.now()
      }, peerId);

      // Send current room state to the joining peer
      this.sendToPeer(peerId, {
        type: 'room-state',
        roomId,
        peers: Array.from(room.peers).filter(id => id !== peerId),
        files: Array.from(room.files.entries()).map(([hash, info]) => ({
          hash,
          ...info
        })),
        timestamp: Date.now()
      });

      console.log(`👥 Peer ${peerId} joined room ${roomId}`);
    }
  }

  handleLeaveRoom(peerId, message) {
    const { roomId } = message;
    
    if (this.rooms.has(roomId)) {
      const room = this.rooms.get(roomId);
      const peer = this.peers.get(peerId);
      
      if (peer) {
        room.peers.delete(peerId);
        peer.rooms.delete(roomId);
        
        // Notify other peers
        this.broadcastToRoom(roomId, {
          type: 'peer-left',
          peerId,
          roomId,
          timestamp: Date.now()
        }, peerId);

        // Clean up empty rooms
        if (room.peers.size === 0) {
          this.rooms.delete(roomId);
        }

        console.log(`👋 Peer ${peerId} left room ${roomId}`);
      }
    }
  }

  handleWebRTCSignaling(peerId, message) {
    const { targetPeerId, ...signalData } = message;
    
    if (this.peers.has(targetPeerId)) {
      this.sendToPeer(targetPeerId, {
        ...signalData,
        fromPeerId: peerId,
        timestamp: Date.now()
      });
    }
  }

  handleFileAnnouncement(peerId, message) {
    const { roomId, fileInfo } = message;
    
    if (this.rooms.has(roomId)) {
      const room = this.rooms.get(roomId);
      
      room.files.set(fileInfo.hash, {
        ...fileInfo,
        seeders: new Set([peerId]),
        announcedAt: Date.now()
      });

      // Broadcast file availability to room
      this.broadcastToRoom(roomId, {
        type: 'file-announced',
        fileInfo: {
          ...fileInfo,
          seeders: 1
        },
        announcedBy: peerId,
        timestamp: Date.now()
      }, peerId);

      console.log(`📁 File announced: ${fileInfo.name} in room ${roomId}`);
    }
  }

  handleFileRequest(peerId, message) {
    const { roomId, fileHash } = message;
    
    if (this.rooms.has(roomId)) {
      const room = this.rooms.get(roomId);
      const fileInfo = room.files.get(fileHash);
      
      if (fileInfo) {
        // Add peer as a leecher and notify seeders
        fileInfo.leechers = fileInfo.leechers || new Set();
        fileInfo.leechers.add(peerId);
        
        // Notify seeders about the request
        fileInfo.seeders.forEach(seederId => {
          if (seederId !== peerId) {
            this.sendToPeer(seederId, {
              type: 'file-requested',
              fileHash,
              requestedBy: peerId,
              timestamp: Date.now()
            });
          }
        });

        console.log(`📥 File requested: ${fileHash} by peer ${peerId}`);
      }
    }
  }

  handlePeerMetadata(peerId, message) {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.metadata = { ...peer.metadata, ...message.metadata };
    }
  }

  handlePeerDisconnect(peerId) {
    const peer = this.peers.get(peerId);
    
    if (peer) {
      // Remove from all rooms
      peer.rooms.forEach(roomId => {
        if (this.rooms.has(roomId)) {
          const room = this.rooms.get(roomId);
          room.peers.delete(peerId);
          
          // Notify other peers
          this.broadcastToRoom(roomId, {
            type: 'peer-left',
            peerId,
            roomId,
            timestamp: Date.now()
          });

          // Clean up empty rooms
          if (room.peers.size === 0) {
            this.rooms.delete(roomId);
          }
        }
      });
      
      this.peers.delete(peerId);
    }
  }

  sendToPeer(peerId, message) {
    const peer = this.peers.get(peerId);
    if (peer && peer.ws.readyState === 1) { // WebSocket.OPEN
      peer.ws.send(JSON.stringify(message));
    }
  }

  broadcastToRoom(roomId, message, excludePeerId = null) {
    if (this.rooms.has(roomId)) {
      const room = this.rooms.get(roomId);
      
      room.peers.forEach(peerId => {
        if (peerId !== excludePeerId) {
          this.sendToPeer(peerId, message);
        }
      });
    }
  }

  generatePeerId() {
    return 'peer_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  }

  getPeerCount() {
    return this.peers.size;
  }

  getRoomCount() {
    return this.rooms.size;
  }
}