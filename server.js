const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto');
const path = require('path');
const cors = require('cors');

class P2PSignalingServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
                credentials: false
            },
            transports: ['websocket', 'polling'],
            allowEIO3: true
        });
        
        this.peers = new Map();
        this.rooms = new Map();
        this.files = new Map();
        this.announcements = new Map();
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
        this.startCleanupTimer();
    }
    
    setupMiddleware() {
        // CORS middleware
        this.app.use(cors({
            origin: '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization']
        }));
        
        this.app.use(express.static(path.join(__dirname, 'public')));
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
        
        // Error handling middleware
        this.app.use((err, req, res, next) => {
            console.error('Server error:', err);
            res.status(500).json({ error: 'Internal server error' });
        });
    }
    
    setupRoutes() {
        // Main route
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });
        
        // API routes
        this.app.get('/api/status', (req, res) => {
            res.json({
                status: 'running',
                peers: this.peers.size,
                rooms: this.rooms.size,
                files: this.files.size,
                uptime: process.uptime()
            });
        });
        
        this.app.get('/api/peers', (req, res) => {
            const peerList = Array.from(this.peers.entries()).map(([id, peer]) => ({
                id: id.substring(0, 8) + '...',
                roomId: peer.roomId,
                connected: peer.socket && peer.socket.connected,
                lastSeen: peer.lastSeen
            }));
            
            res.json({
                peers: peerList,
                rooms: Array.from(this.rooms.keys()),
                totalPeers: this.peers.size
            });
        });
        
        this.app.post('/api/announce', (req, res) => {
            try {
                const { fileHash, peerId, fileName, fileSize, chunks } = req.body;
                
                if (!fileHash || !peerId) {
                    return res.status(400).json({ error: 'Missing required fields' });
                }
                
                // Store file announcement
                if (!this.files.has(fileHash)) {
                    this.files.set(fileHash, {
                        peers: new Set(),
                        chunks: new Map(),
                        metadata: {
                            fileName: fileName || 'unknown',
                            fileSize: fileSize || 0,
                            announcedAt: Date.now()
                        }
                    });
                }
                
                const file = this.files.get(fileHash);
                file.peers.add(peerId);
                
                if (chunks && Array.isArray(chunks)) {
                    file.chunks.set(peerId, chunks);
                }
                
                // Store announcement for peer discovery
                this.announcements.set(fileHash, {
                    fileHash,
                    fileName,
                    fileSize,
                    peers: Array.from(file.peers),
                    lastUpdate: Date.now()
                });
                
                const availablePeers = Array.from(file.peers).filter(id => id !== peerId);
                
                res.json({
                    success: true,
                    peers: availablePeers,
                    totalPeers: file.peers.size
                });
                
            } catch (error) {
                console.error('Announce error:', error);
                res.status(500).json({ error: 'Failed to process announcement' });
            }
        });
        
        this.app.get('/api/files/:hash', (req, res) => {
            const fileHash = req.params.hash;
            const file = this.files.get(fileHash);
            
            if (!file) {
                return res.status(404).json({ error: 'File not found' });
            }
            
            res.json({
                fileHash,
                metadata: file.metadata,
                peers: Array.from(file.peers).map(id => id.substring(0, 8) + '...'),
                totalPeers: file.peers.size
            });
        });
        
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'healthy', timestamp: new Date().toISOString() });
        });
        
        // Catch-all route
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });
    }
    
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`Peer connected: ${socket.id}`);
            
            // Initialize peer data
            this.peers.set(socket.id, {
                socket: socket,
                roomId: null,
                connectedAt: Date.now(),
                lastSeen: Date.now()
            });
            
            // Join room handler
            socket.on('join-room', (roomId) => {
                try {
                    if (!roomId) {
                        roomId = 'default';
                    }
                    
                    // Leave previous room if any
                    const peer = this.peers.get(socket.id);
                    if (peer && peer.roomId) {
                        socket.leave(peer.roomId);
                        this.removeFromRoom(peer.roomId, socket.id);
                    }
                    
                    // Join new room
                    socket.join(roomId);
                    
                    if (!this.rooms.has(roomId)) {
                        this.rooms.set(roomId, new Set());
                    }
                    
                    this.rooms.get(roomId).add(socket.id);
                    
                    // Update peer info
                    if (peer) {
                        peer.roomId = roomId;
                        peer.lastSeen = Date.now();
                    }
                    
                    // Notify other peers
                    socket.to(roomId).emit('peer-joined', {
                        peerId: socket.id,
                        timestamp: Date.now()
                    });
                    
                    // Send current room peers to new peer
                    const roomPeers = Array.from(this.rooms.get(roomId))
                        .filter(id => id !== socket.id)
                        .filter(id => this.peers.has(id) && this.peers.get(id).socket.connected);
                    
                    socket.emit('room-peers', roomPeers);
                    
                    console.log(`Peer ${socket.id} joined room ${roomId}. Room size: ${this.rooms.get(roomId).size}`);
                    
                } catch (error) {
                    console.error('Join room error:', error);
                    socket.emit('error', { message: 'Failed to join room' });
                }
            });
            
            // WebRTC signaling handlers
            socket.on('webrtc-offer', (data) => {
                try {
                    const { target, offer } = data;
                    
                    if (!target || !offer) {
                        return socket.emit('error', { message: 'Invalid offer data' });
                    }
                    
                    const targetPeer = this.peers.get(target);
                    if (targetPeer && targetPeer.socket.connected) {
                        targetPeer.socket.emit('webrtc-offer', {
                            offer: offer,
                            sender: socket.id
                        });
                        console.log(`Forwarded offer from ${socket.id} to ${target}`);
                    } else {
                        socket.emit('peer-unavailable', { target });
                    }
                } catch (error) {
                    console.error('WebRTC offer error:', error);
                }
            });
            
            socket.on('webrtc-answer', (data) => {
                try {
                    const { target, answer } = data;
                    
                    if (!target || !answer) {
                        return socket.emit('error', { message: 'Invalid answer data' });
                    }
                    
                    const targetPeer = this.peers.get(target);
                    if (targetPeer && targetPeer.socket.connected) {
                        targetPeer.socket.emit('webrtc-answer', {
                            answer: answer,
                            sender: socket.id
                        });
                        console.log(`Forwarded answer from ${socket.id} to ${target}`);
                    } else {
                        socket.emit('peer-unavailable', { target });
                    }
                } catch (error) {
                    console.error('WebRTC answer error:', error);
                }
            });
            
            socket.on('webrtc-ice-candidate', (data) => {
                try {
                    const { target, candidate } = data;
                    
                    if (!target || !candidate) {
                        return socket.emit('error', { message: 'Invalid ICE candidate data' });
                    }
                    
                    const targetPeer = this.peers.get(target);
                    if (targetPeer && targetPeer.socket.connected) {
                        targetPeer.socket.emit('webrtc-ice-candidate', {
                            candidate: candidate,
                            sender: socket.id
                        });
                    } else {
                        socket.emit('peer-unavailable', { target });
                    }
                } catch (error) {
                    console.error('ICE candidate error:', error);
                }
            });
            
            // File transfer signaling
            socket.on('file-request', (data) => {
                try {
                    const { fileHash, chunkIndex, target } = data;
                    
                    const targetPeer = this.peers.get(target);
                    if (targetPeer && targetPeer.socket.connected) {
                        targetPeer.socket.emit('file-request', {
                            fileHash,
                            chunkIndex,
                            requester: socket.id
                        });
                    }
                } catch (error) {
                    console.error('File request error:', error);
                }
            });
            
            socket.on('file-response', (data) => {
                try {
                    const { fileHash, chunkIndex, chunkData, target } = data;
                    
                    const targetPeer = this.peers.get(target);
                    if (targetPeer && targetPeer.socket.connected) {
                        targetPeer.socket.emit('file-response', {
                            fileHash,
                            chunkIndex,
                            chunkData,
                            sender: socket.id
                        });
                    }
                } catch (error) {
                    console.error('File response error:', error);
                }
            });
            
            // Heartbeat
            socket.on('ping', () => {
                const peer = this.peers.get(socket.id);
                if (peer) {
                    peer.lastSeen = Date.now();
                }
                socket.emit('pong');
            });
            
            // Disconnect handler
            socket.on('disconnect', (reason) => {
                console.log(`Peer disconnected: ${socket.id}, reason: ${reason}`);
                
                const peer = this.peers.get(socket.id);
                if (peer && peer.roomId) {
                    // Remove from room
                    this.removeFromRoom(peer.roomId, socket.id);
                    
                    // Notify other peers
                    socket.to(peer.roomId).emit('peer-left', {
                        peerId: socket.id,
                        timestamp: Date.now()
                    });
                }
                
                // Clean up peer data
                this.peers.delete(socket.id);
                
                // Clean up file associations
                for (const [fileHash, fileData] of this.files.entries()) {
                    fileData.peers.delete(socket.id);
                    fileData.chunks.delete(socket.id);
                    
                    // Remove file if no peers left
                    if (fileData.peers.size === 0) {
                        this.files.delete(fileHash);
                        this.announcements.delete(fileHash);
                    }
                }
            });
            
            // Error handler
            socket.on('error', (error) => {
                console.error(`Socket error for ${socket.id}:`, error);
            });
        });
    }
    
    removeFromRoom(roomId, peerId) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.delete(peerId);
            
            // Clean up empty rooms
            if (room.size === 0) {
                this.rooms.delete(roomId);
                console.log(`Removed empty room: ${roomId}`);
            }
        }
    }
    
    startCleanupTimer() {
        // Clean up old announcements and inactive peers every 5 minutes
        setInterval(() => {
            this.cleanupOldData();
        }, 5 * 60 * 1000);
    }
    
    cleanupOldData() {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000; // 30 minutes
        
        // Clean up old announcements
        for (const [hash, announcement] of this.announcements.entries()) {
            if (now - announcement.lastUpdate > maxAge) {
                this.announcements.delete(hash);
            }
        }
        
        // Clean up disconnected peers
        for (const [peerId, peer] of this.peers.entries()) {
            if (!peer.socket.connected || (now - peer.lastSeen > maxAge)) {
                this.peers.delete(peerId);
                
                // Remove from rooms
                if (peer.roomId) {
                    this.removeFromRoom(peer.roomId, peerId);
                }
            }
        }
        
        console.log(`Cleanup completed. Active peers: ${this.peers.size}, Active rooms: ${this.rooms.size}`);
    }
    
    start(port = 3001) {
        this.server.listen(port, () => {
            console.log(`🚀 P2P Signaling Server running on port ${port}`);
            console.log(`📊 Server status: http://localhost:${port}/api/status`);
            console.log(`🏥 Health check: http://localhost:${port}/health`);
        });
        
        // Graceful shutdown
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
    }
    
    shutdown() {
        console.log('Shutting down P2P Signaling Server...');
        
        // Notify all connected peers
        this.io.emit('server-shutdown', { message: 'Server is shutting down' });
        
        // Close all connections
        setTimeout(() => {
            this.server.close(() => {
                console.log('Server shutdown complete');
                process.exit(0);
            });
        }, 1000);
    }
}

// Main Application Server
class P2PWebServer {
    constructor() {
        this.signalingServer = new P2PSignalingServer();
    }
    
    start(signalingPort = 3001) {
        this.signalingServer.start(signalingPort);
    }
}

if (require.main === module) {
    const SIGNALING_PORT = process.env.SIGNALING_PORT || 3001;
    
    const server = new P2PWebServer();
    server.start(SIGNALING_PORT);
}

module.exports = { P2PSignalingServer, P2PWebServer };