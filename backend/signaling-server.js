/**
 * Custom WebSocket Signaling Server
 * Handles peer discovery, connection establishment, and message routing
 * Implements secure peer authentication and session management
 */

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { createHash, randomBytes } from 'crypto';
import { readFileSync } from 'fs';

class SignalingServer {
  constructor(port = 8080) {
    this.port = port;
    this.peers = new Map(); // Connected peers
    this.rooms = new Map(); // File sharing rooms
    this.sessions = new Map(); // Authentication sessions
    this.server = null;
    this.wss = null;
  }

  /**
   * Initialize and start the signaling server
   */
  async start() {
    try {
      // Create HTTP server
      this.server = createServer();
      
      // Create WebSocket server
      this.wss = new WebSocketServer({ 
        server: this.server,
        perMessageDeflate: false,
        maxPayload: 64 * 1024 // 64KB max message size
      });

      this.setupWebSocketHandlers();
      this.setupHealthCheck();
      
      // Start listening
      this.server.listen(this.port, () => {
        console.log(`🚀 Signaling server running on port ${this.port}`);
        console.log(`📡 WebSocket endpoint: ws://localhost:${this.port}`);
      });

      // Graceful shutdown handling
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } catch (error) {
      console.error('❌ Failed to start signaling server:', error);
      process.exit(1);
    }
  }

  /**
   * Setup WebSocket connection handlers
   */
  setupWebSocketHandlers() {
    this.wss.on('connection', (ws, request) => {
      const clientIp = request.socket.remoteAddress;
      const peerId = this.generatePeerId();
      
      console.log(`👋 New peer connected: ${peerId} from ${clientIp}`);
      
      // Initialize peer session
      const peer = {
        id: peerId,
        ws: ws,
        ip: clientIp,
        authenticated: false,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
        rooms: new Set()
      };

      this.peers.set(peerId, peer);

      // Set up message handlers
      ws.on('message', (data) => this.handleMessage(peerId, data));
      ws.on('close', () => this.handleDisconnection(peerId));
      ws.on('error', (error) => this.handleError(peerId, error));

      // Send welcome message
      this.sendToPeer(peerId, {
        type: 'welcome',
        peerId: peerId,
        timestamp: Date.now()
      });

      // Set up ping/pong for connection health
      this.setupHeartbeat(peerId);
    });
  }

  /**
   * Handle incoming messages from peers
   */
  async handleMessage(peerId, data) {
    try {
      const peer = this.peers.get(peerId);
      if (!peer) return;

      peer.lastSeen = Date.now();
      
      const message = JSON.parse(data.toString());
      console.log(`📨 Message from ${peerId}:`, message.type);

      switch (message.type) {
        case 'authenticate':
          await this.handleAuthentication(peerId, message);
          break;
        
        case 'join-room':
          await this.handleJoinRoom(peerId, message);
          break;
        
        case 'leave-room':
          await this.handleLeaveRoom(peerId, message);
          break;
        
        case 'offer':
        case 'answer':
        case 'ice-candidate':
          await this.handleWebRTCSignaling(peerId, message);
          break;
        
        case 'file-announce':
          await this.handleFileAnnounce(peerId, message);
          break;
        
        case 'peer-list-request':
          await this.handlePeerListRequest(peerId, message);
          break;
        
        case 'ping':
          this.sendToPeer(peerId, { type: 'pong', timestamp: Date.now() });
          break;
        
        default:
          console.warn(`⚠️ Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`❌ Error handling message from ${peerId}:`, error);
      this.sendToPeer(peerId, {
        type: 'error',
        message: 'Invalid message format'
      });
    }
  }

  /**
   * Handle peer authentication
   */
  async handleAuthentication(peerId, message) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    try {
      // Simple challenge-response authentication
      const { challenge, response } = message;
      
      if (!challenge || !response) {
        this.sendToPeer(peerId, {
          type: 'auth-failed',
          reason: 'Missing challenge or response'
        });
        return;
      }

      // Verify the response (in production, use proper cryptographic verification)
      const expectedResponse = createHash('sha256')
        .update(challenge + 'secret-key') // In production, use proper key management
        .digest('hex');

      if (response === expectedResponse) {
        peer.authenticated = true;
        this.sendToPeer(peerId, {
          type: 'auth-success',
          timestamp: Date.now()
        });
        console.log(`✅ Peer ${peerId} authenticated successfully`);
      } else {
        this.sendToPeer(peerId, {
          type: 'auth-failed',
          reason: 'Invalid credentials'
        });
        console.log(`❌ Authentication failed for peer ${peerId}`);
      }
    } catch (error) {
      console.error(`❌ Authentication error for ${peerId}:`, error);
      this.sendToPeer(peerId, {
        type: 'auth-failed',
        reason: 'Server error'
      });
    }
  }

  /**
   * Handle joining a file sharing room
   */
  async handleJoinRoom(peerId, message) {
    const peer = this.peers.get(peerId);
    if (!peer || !peer.authenticated) {
      this.sendToPeer(peerId, {
        type: 'error',
        message: 'Authentication required'
      });
      return;
    }

    const { roomId, fileHash } = message;
    if (!roomId || !fileHash) {
      this.sendToPeer(peerId, {
        type: 'error',
        message: 'Room ID and file hash required'
      });
      return;
    }

    // Create room if it doesn't exist
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        fileHash: fileHash,
        peers: new Set(),
        createdAt: Date.now()
      });
    }

    const room = this.rooms.get(roomId);
    room.peers.add(peerId);
    peer.rooms.add(roomId);

    // Notify peer of successful join
    this.sendToPeer(peerId, {
      type: 'room-joined',
      roomId: roomId,
      peerCount: room.peers.size
    });

    // Notify other peers in the room
    this.broadcastToRoom(roomId, {
      type: 'peer-joined',
      peerId: peerId,
      peerCount: room.peers.size
    }, peerId);

    console.log(`🏠 Peer ${peerId} joined room ${roomId}`);
  }

  /**
   * Handle WebRTC signaling messages
   */
  async handleWebRTCSignaling(peerId, message) {
    const { targetPeerId, roomId } = message;
    
    if (!targetPeerId) {
      this.sendToPeer(peerId, {
        type: 'error',
        message: 'Target peer ID required'
      });
      return;
    }

    const targetPeer = this.peers.get(targetPeerId);
    if (!targetPeer) {
      this.sendToPeer(peerId, {
        type: 'error',
        message: 'Target peer not found'
      });
      return;
    }

    // Forward the signaling message to target peer
    this.sendToPeer(targetPeerId, {
      ...message,
      fromPeerId: peerId
    });

    console.log(`🔄 Forwarded ${message.type} from ${peerId} to ${targetPeerId}`);
  }

  /**
   * Handle file announcement
   */
  async handleFileAnnounce(peerId, message) {
    const peer = this.peers.get(peerId);
    if (!peer || !peer.authenticated) return;

    const { fileName, fileSize, fileHash, pieceHashes } = message;
    
    console.log(`📁 File announced by ${peerId}: ${fileName} (${fileSize} bytes)`);
    
    // Broadcast to all peers in relevant rooms
    peer.rooms.forEach(roomId => {
      this.broadcastToRoom(roomId, {
        type: 'file-available',
        peerId: peerId,
        fileName: fileName,
        fileSize: fileSize,
        fileHash: fileHash,
        pieceCount: pieceHashes.length
      }, peerId);
    });
  }

  /**
   * Handle peer list requests
   */
  async handlePeerListRequest(peerId, message) {
    const peer = this.peers.get(peerId);
    if (!peer || !peer.authenticated) return;

    const { roomId } = message;
    const room = this.rooms.get(roomId);
    
    if (!room) {
      this.sendToPeer(peerId, {
        type: 'peer-list',
        roomId: roomId,
        peers: []
      });
      return;
    }

    const peerList = Array.from(room.peers)
      .filter(id => id !== peerId && this.peers.has(id))
      .map(id => ({
        peerId: id,
        joinedAt: this.peers.get(id).joinedAt
      }));

    this.sendToPeer(peerId, {
      type: 'peer-list',
      roomId: roomId,
      peers: peerList
    });
  }

  /**
   * Send message to specific peer
   */
  sendToPeer(peerId, message) {
    const peer = this.peers.get(peerId);
    if (peer && peer.ws.readyState === 1) { // WebSocket.OPEN
      try {
        peer.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`❌ Failed to send message to ${peerId}:`, error);
        this.handleDisconnection(peerId);
      }
    }
  }

  /**
   * Broadcast message to all peers in a room
   */
  broadcastToRoom(roomId, message, excludePeerId = null) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.peers.forEach(peerId => {
      if (peerId !== excludePeerId) {
        this.sendToPeer(peerId, message);
      }
    });
  }

  /**
   * Handle peer disconnection
   */
  handleDisconnection(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    console.log(`👋 Peer disconnected: ${peerId}`);

    // Remove from all rooms
    peer.rooms.forEach(roomId => {
      const room = this.rooms.get(roomId);
      if (room) {
        room.peers.delete(peerId);
        
        // Notify other peers
        this.broadcastToRoom(roomId, {
          type: 'peer-left',
          peerId: peerId,
          peerCount: room.peers.size
        });

        // Clean up empty rooms
        if (room.peers.size === 0) {
          this.rooms.delete(roomId);
          console.log(`🗑️ Cleaned up empty room: ${roomId}`);
        }
      }
    });

    // Remove peer
    this.peers.delete(peerId);
  }

  /**
   * Handle WebSocket errors
   */
  handleError(peerId, error) {
    console.error(`❌ WebSocket error for peer ${peerId}:`, error);
    this.handleDisconnection(peerId);
  }

  /**
   * Setup heartbeat mechanism
   */
  setupHeartbeat(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    const interval = setInterval(() => {
      if (!this.peers.has(peerId)) {
        clearInterval(interval);
        return;
      }

      const now = Date.now();
      if (now - peer.lastSeen > 30000) { // 30 seconds timeout
        console.log(`💔 Peer ${peerId} timed out`);
        peer.ws.terminate();
        this.handleDisconnection(peerId);
        clearInterval(interval);
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Setup health check endpoint
   */
  setupHealthCheck() {
    this.server.on('request', (req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'healthy',
          peers: this.peers.size,
          rooms: this.rooms.size,
          uptime: process.uptime()
        }));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });
  }

  /**
   * Generate unique peer ID
   */
  generatePeerId() {
    return randomBytes(16).toString('hex');
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🛑 Shutting down signaling server...');
    
    // Close all WebSocket connections
    this.wss.clients.forEach(ws => {
      ws.close(1000, 'Server shutting down');
    });

    // Close HTTP server
    this.server.close(() => {
      console.log('✅ Signaling server shut down gracefully');
      process.exit(0);
    });
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new SignalingServer(process.env.PORT || 8080);
  server.start();
}

export default SignalingServer;