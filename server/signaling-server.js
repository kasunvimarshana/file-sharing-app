import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger.js';
import { config } from './config.js';
import { RateLimiter } from './rate-limiter.js';
import { validateMessage, schemas, sanitizeString } from './validation.js';

export class SignalingServer {
  constructor(wss) {
    this.wss = wss;
    this.peers = new Map();
    this.rooms = new Map();
    this.rateLimiter = new RateLimiter(config.rateLimitWindow, config.rateLimitMax);
    this.connectionCount = 0;
    
    this.setupWebSocketHandlers();
    this.setupPeriodicTasks();
  }

  setupWebSocketHandlers() {
    this.wss.on('connection', (ws, request) => {
      const peerId = this.generatePeerId();
      const clientIp = this.getClientIp(request);
      
      // Rate limiting check
      if (!this.rateLimiter.isAllowed(clientIp)) {
        logger.warn(`Rate limit exceeded for IP: ${clientIp}`);
        ws.close(1008, 'Rate limit exceeded');
        return;
      }
      
      // Connection limit check
      if (this.peers.size >= config.maxConnections) {
        logger.warn(`Max connections reached: ${config.maxConnections}`);
        ws.close(1008, 'Server at capacity');
        return;
      }
      
      logger.info(`Peer connected: ${peerId} from ${clientIp}`);
      
      ws.peerId = peerId;
      ws.clientIp = clientIp;
      ws.isAlive = true;
      ws.connectedAt = Date.now();
      ws.messageCount = 0;
      ws.lastActivity = Date.now();
      
      this.peers.set(peerId, {
        ws,
        rooms: new Set(),
        metadata: {},
        clientIp,
        connectedAt: Date.now(),
        messageCount: 0,
        lastActivity: Date.now()
      });
      
      this.connectionCount++;

      ws.on('message', (data) => {
        try {
          // Message size check
          if (data.length > config.maxMessageSize) {
            logger.warn(`Message too large from ${peerId}: ${data.length} bytes`);
            ws.close(1009, 'Message too large');
            return;
          }
          
          // Rate limiting per connection
          const peer = this.peers.get(peerId);
          if (peer) {
            peer.messageCount++;
            peer.lastActivity = Date.now();
            
            // Simple per-connection rate limiting
            if (peer.messageCount > 1000) { // 1000 messages per connection lifetime
              logger.warn(`Message limit exceeded for peer: ${peerId}`);
              ws.close(1008, 'Message limit exceeded');
              return;
            }
          }
          
          const message = JSON.parse(data.toString());
          this.handleMessage(peerId, message);
        } catch (error) {
          logger.error(`Error parsing message from ${peerId}:`, error);
          ws.close(1003, 'Invalid message format');
        }
      });

      ws.on('close', (code, reason) => {
        logger.info(`Peer disconnected: ${peerId}, code: ${code}, reason: ${reason}`);
        this.handlePeerDisconnect(peerId);
      });

      ws.on('error', (error) => {
        logger.error(`WebSocket error for peer ${peerId}:`, error);
        this.handlePeerDisconnect(peerId);
      });

      ws.on('pong', () => {
        ws.isAlive = true;
        const peer = this.peers.get(peerId);
        if (peer) {
          peer.lastActivity = Date.now();
        }
      });

      // Send welcome message
      this.sendToPeer(peerId, {
        type: 'welcome',
        peerId,
        timestamp: Date.now(),
        serverInfo: {
          version: '1.0.0',
          maxConnections: config.maxConnections,
          maxRoomsPerPeer: config.maxRoomsPerPeer
        }
      });
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error:', error);
    });
  }

  setupPeriodicTasks() {
    // Heartbeat mechanism
    const heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          logger.info(`Terminating inactive connection: ${ws.peerId}`);
          return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
      });
    }, config.heartbeatInterval);

    // Cleanup stale data
    setInterval(() => {
      this.cleanupStaleData();
    }, 5 * 60 * 1000); // Every 5 minutes

    this.wss.on('close', () => {
      clearInterval(heartbeatInterval);
    });
  }

  handleMessage(peerId, message) {
    try {
      // Add timestamp if not present
      if (!message.timestamp) {
        message.timestamp = Date.now();
      }
      
      // Validate message based on type
      let validatedMessage;
      
      switch (message.type) {
        case 'join-room':
          validatedMessage = validateMessage(message, schemas.joinRoom);
          this.handleJoinRoom(peerId, validatedMessage);
          break;
        case 'leave-room':
          validatedMessage = validateMessage(message, schemas.leaveRoom);
          this.handleLeaveRoom(peerId, validatedMessage);
          break;
        case 'offer':
        case 'answer':
        case 'ice-candidate':
          validatedMessage = validateMessage(message, schemas.webrtcSignaling);
          this.handleWebRTCSignaling(peerId, validatedMessage);
          break;
        case 'announce-file':
          validatedMessage = validateMessage(message, schemas.announceFile);
          this.handleFileAnnouncement(peerId, validatedMessage);
          break;
        case 'request-file':
          validatedMessage = validateMessage(message, schemas.requestFile);
          this.handleFileRequest(peerId, validatedMessage);
          break;
        case 'peer-metadata':
          validatedMessage = validateMessage(message, schemas.peerMetadata);
          this.handlePeerMetadata(peerId, validatedMessage);
          break;
        default:
          logger.warn(`Unknown message type from ${peerId}: ${message.type}`);
      }
    } catch (error) {
      logger.error(`Error handling message from ${peerId}:`, error);
      this.sendToPeer(peerId, {
        type: 'error',
        error: 'Invalid message format',
        timestamp: Date.now()
      });
    }
  }

  handleJoinRoom(peerId, message) {
    const { roomId } = message;
    const peer = this.peers.get(peerId);
    
    if (!peer) {
      logger.warn(`Join room request from unknown peer: ${peerId}`);
      return;
    }
    
    // Check room limit per peer
    if (peer.rooms.size >= config.maxRoomsPerPeer) {
      logger.warn(`Peer ${peerId} exceeded max rooms limit`);
      this.sendToPeer(peerId, {
        type: 'error',
        error: 'Maximum rooms per peer exceeded',
        timestamp: Date.now()
      });
      return;
    }
    
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        peers: new Set(),
        files: new Map(),
        createdAt: Date.now(),
        lastActivity: Date.now()
      });
    }

    const room = this.rooms.get(roomId);
    
    // Check if already in room
    if (peer.rooms.has(roomId)) {
      logger.debug(`Peer ${peerId} already in room ${roomId}`);
      return;
    }
    
    room.peers.add(peerId);
    room.lastActivity = Date.now();
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
      data: {
        peers: Array.from(room.peers).filter(id => id !== peerId),
        files: Array.from(room.files.entries()).map(([hash, info]) => ({
          hash,
          ...info
        })),
        peerCount: room.peers.size
      },
      timestamp: Date.now()
    });

    logger.info(`Peer ${peerId} joined room ${roomId} (${room.peers.size} peers total)`);
  }

  handleLeaveRoom(peerId, message) {
    const { roomId } = message;
    
    if (this.rooms.has(roomId)) {
      const room = this.rooms.get(roomId);
      const peer = this.peers.get(peerId);
      
      if (peer && peer.rooms.has(roomId)) {
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
          logger.info(`Room ${roomId} deleted (empty)`);
        } else {
          room.lastActivity = Date.now();
        }

        logger.info(`Peer ${peerId} left room ${roomId}`);
      }
    }
  }

  handleWebRTCSignaling(peerId, message) {
    const { targetPeerId, type, data } = message;
    
    if (!this.peers.has(targetPeerId)) {
      logger.warn(`WebRTC signaling target not found: ${targetPeerId}`);
      this.sendToPeer(peerId, {
        type: 'error',
        error: 'Target peer not found',
        timestamp: Date.now()
      });
      return;
    }
    
    this.sendToPeer(targetPeerId, {
      type,
      peerId: peerId, // Use 'peerId' instead of 'fromPeerId' for consistency
      data,
      timestamp: Date.now()
    });
    
    logger.debug(`WebRTC ${type} relayed from ${peerId} to ${targetPeerId}`);
  }

  handleFileAnnouncement(peerId, message) {
    const { roomId, fileInfo } = message;
    
    if (!this.rooms.has(roomId)) {
      logger.warn(`File announcement for non-existent room: ${roomId}`);
      return;
    }
    
    const room = this.rooms.get(roomId);
    const peer = this.peers.get(peerId);
    
    if (!peer || !peer.rooms.has(roomId)) {
      logger.warn(`File announcement from peer not in room: ${peerId} -> ${roomId}`);
      return;
    }
    
    // Sanitize file info
    const sanitizedFileInfo = {
      ...fileInfo,
      name: sanitizeString(fileInfo.name, 255)
    };
    
    room.files.set(fileInfo.hash, {
      ...sanitizedFileInfo,
      seeders: new Set([peerId]),
      announcedAt: Date.now(),
      announcedBy: peerId
    });
    
    room.lastActivity = Date.now();

    // Broadcast file availability to room
    this.broadcastToRoom(roomId, {
      type: 'file-announced',
      data: {
        ...sanitizedFileInfo,
        seeders: 1
      },
      announcedBy: peerId,
      timestamp: Date.now()
    }, peerId);

    logger.info(`File announced: ${sanitizedFileInfo.name} (${fileInfo.hash}) in room ${roomId} by ${peerId}`);
  }

  handleFileRequest(peerId, message) {
    const { roomId, fileHash } = message;
    
    if (!this.rooms.has(roomId)) {
      logger.warn(`File request for non-existent room: ${roomId}`);
      return;
    }
    
    const room = this.rooms.get(roomId);
    const peer = this.peers.get(peerId);
    
    if (!peer || !peer.rooms.has(roomId)) {
      logger.warn(`File request from peer not in room: ${peerId} -> ${roomId}`);
      return;
    }
    
    const fileInfo = room.files.get(fileHash);
    
    if (fileInfo) {
      // Add peer as a leecher
      if (!fileInfo.leechers) {
        fileInfo.leechers = new Set();
      }
      fileInfo.leechers.add(peerId);
      
      room.lastActivity = Date.now();
      
      // Notify seeders about the request
      fileInfo.seeders.forEach(seederId => {
        if (seederId !== peerId && this.peers.has(seederId)) {
          this.sendToPeer(seederId, {
            type: 'file-requested',
            data: { fileHash },
            peerId: peerId, // Use 'peerId' for consistency
            timestamp: Date.now()
          });
        }
      });

      logger.info(`File requested: ${fileHash} by peer ${peerId} in room ${roomId}`);
    } else {
      logger.warn(`File request for unknown file: ${fileHash} in room ${roomId}`);
    }
  }

  handlePeerMetadata(peerId, message) {
    const peer = this.peers.get(peerId);
    if (peer) {
      // Sanitize metadata
      const sanitizedMetadata = {};
      if (message.metadata.userAgent) {
        sanitizedMetadata.userAgent = sanitizeString(message.metadata.userAgent, 500);
      }
      if (message.metadata.capabilities && Array.isArray(message.metadata.capabilities)) {
        sanitizedMetadata.capabilities = message.metadata.capabilities
          .slice(0, 10)
          .map(cap => sanitizeString(cap, 50));
      }
      if (typeof message.metadata.bandwidth === 'number' && message.metadata.bandwidth > 0) {
        sanitizedMetadata.bandwidth = message.metadata.bandwidth;
      }
      
      peer.metadata = { ...peer.metadata, ...sanitizedMetadata };
      peer.lastActivity = Date.now();
      
      logger.debug(`Updated metadata for peer ${peerId}`);
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
          
          // Remove from file seeders/leechers
          room.files.forEach(fileInfo => {
            if (fileInfo.seeders) {
              fileInfo.seeders.delete(peerId);
            }
            if (fileInfo.leechers) {
              fileInfo.leechers.delete(peerId);
            }
          });
          
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
            logger.info(`Room ${roomId} deleted (empty after peer disconnect)`);
          }
        }
      });
      
      this.peers.delete(peerId);
      this.connectionCount = Math.max(0, this.connectionCount - 1);
      
      logger.info(`Peer ${peerId} disconnected and cleaned up`);
    }
  }

  cleanupStaleData() {
    const now = Date.now();
    const staleTimeout = 24 * 60 * 60 * 1000; // 24 hours
    
    // Clean up stale rooms
    for (const [roomId, room] of this.rooms.entries()) {
      if (now - room.lastActivity > staleTimeout && room.peers.size === 0) {
        this.rooms.delete(roomId);
        logger.info(`Cleaned up stale room: ${roomId}`);
      }
    }
    
    // Clean up stale file entries
    this.rooms.forEach(room => {
      for (const [fileHash, fileInfo] of room.files.entries()) {
        if (fileInfo.seeders.size === 0 && now - fileInfo.announcedAt > staleTimeout) {
          room.files.delete(fileHash);
          logger.debug(`Cleaned up stale file: ${fileHash}`);
        }
      }
    });
    
    logger.debug(`Cleanup completed: ${this.rooms.size} rooms, ${this.peers.size} peers`);
  }

  sendToPeer(peerId, message) {
    const peer = this.peers.get(peerId);
    if (peer && peer.ws.readyState === 1) { // WebSocket.OPEN
      try {
        peer.ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error(`Failed to send message to peer ${peerId}:`, error);
        this.handlePeerDisconnect(peerId);
      }
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
    return 'peer_' + uuidv4().replace(/-/g, '').substring(0, 16);
  }

  getClientIp(request) {
    return request.headers['x-forwarded-for']?.split(',')[0] || 
           request.headers['x-real-ip'] || 
           request.connection.remoteAddress || 
           request.socket.remoteAddress ||
           'unknown';
  }

  // Public API methods
  getPeerCount() {
    return this.peers.size;
  }

  getRoomCount() {
    return this.rooms.size;
  }

  getConnectionCount() {
    return this.connectionCount;
  }

  getRoomInfo(roomId) {
    const room = this.rooms.get(roomId);
    if (room) {
      return {
        peerCount: room.peers.size,
        fileCount: room.files.size,
        createdAt: room.createdAt,
        lastActivity: room.lastActivity
      };
    }
    return null;
  }

  shutdown() {
    logger.info('Shutting down signaling server...');
    
    // Close all WebSocket connections
    this.wss.clients.forEach(ws => {
      ws.close(1001, 'Server shutdown');
    });
    
    // Clear data structures
    this.peers.clear();
    this.rooms.clear();
    
    logger.info('Signaling server shutdown complete');
  }
}