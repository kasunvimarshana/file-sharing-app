const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto');
const path = require('path');

class P2PSignalingServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.peers = new Map();
        this.rooms = new Map();
        this.files = new Map();
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
    }
    
    setupMiddleware() {
        this.app.use(express.static('public'));
        this.app.use(express.json());
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
    }
    
    setupRoutes() {
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });
        
        this.app.get('/api/peers', (req, res) => {
            res.json({
                peers: Array.from(this.peers.keys()),
                rooms: Array.from(this.rooms.keys()),
                files: Array.from(this.files.keys())
            });
        });
        
        this.app.post('/api/announce', (req, res) => {
            const { fileHash, peerId, chunks } = req.body;
            
            if (!this.files.has(fileHash)) {
                this.files.set(fileHash, {
                    peers: new Set(),
                    chunks: new Map(),
                    metadata: {}
                });
            }
            
            const file = this.files.get(fileHash);
            file.peers.add(peerId);
            file.chunks.set(peerId, chunks || []);
            
            res.json({
                success: true,
                peers: Array.from(file.peers).filter(id => id !== peerId)
            });
        });
    }
    
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('Peer connected:', socket.id);
            
            socket.on('join-room', (roomId) => {
                socket.join(roomId);
                
                if (!this.rooms.has(roomId)) {
                    this.rooms.set(roomId, new Set());
                }
                
                this.rooms.get(roomId).add(socket.id);
                this.peers.set(socket.id, { roomId, socket });
                
                socket.to(roomId).emit('peer-joined', socket.id);
                
                const roomPeers = Array.from(this.rooms.get(roomId)).filter(id => id !== socket.id);
                socket.emit('room-peers', roomPeers);
            });
            
            socket.on('webrtc-offer', (data) => {
                socket.to(data.target).emit('webrtc-offer', {
                    offer: data.offer,
                    sender: socket.id
                });
            });
            
            socket.on('webrtc-answer', (data) => {
                socket.to(data.target).emit('webrtc-answer', {
                    answer: data.answer,
                    sender: socket.id
                });
            });
            
            socket.on('webrtc-ice-candidate', (data) => {
                socket.to(data.target).emit('webrtc-ice-candidate', {
                    candidate: data.candidate,
                    sender: socket.id
                });
            });
            
            socket.on('file-request', (data) => {
                const { fileHash, chunkIndex, target } = data;
                socket.to(target).emit('file-request', {
                    fileHash,
                    chunkIndex,
                    requester: socket.id
                });
            });
            
            socket.on('file-response', (data) => {
                const { fileHash, chunkIndex, chunkData, target } = data;
                socket.to(target).emit('file-response', {
                    fileHash,
                    chunkIndex,
                    chunkData,
                    sender: socket.id
                });
            });
            
            socket.on('disconnect', () => {
                console.log('Peer disconnected:', socket.id);
                
                const peer = this.peers.get(socket.id);
                if (peer && peer.roomId) {
                    const room = this.rooms.get(peer.roomId);
                    if (room) {
                        room.delete(socket.id);
                        socket.to(peer.roomId).emit('peer-left', socket.id);
                    }
                }
                
                this.peers.delete(socket.id);
                
                // Clean up file associations
                for (const [fileHash, fileData] of this.files.entries()) {
                    fileData.peers.delete(socket.id);
                    fileData.chunks.delete(socket.id);
                    
                    if (fileData.peers.size === 0) {
                        this.files.delete(fileHash);
                    }
                }
            });
        });
    }
    
    start(port = 3001) {
        this.server.listen(port, () => {
            console.log(`P2P Signaling Server running on port ${port}`);
        });
    }
}

// STUN Server Implementation
class STUNServer {
    constructor() {
        this.responses = new Map();
    }
    
    async getPublicIP(stunServer = 'stun:stun.l.google.com:19302') {
        return new Promise((resolve, reject) => {
            const pc = new RTCPeerConnection({ iceServers: [{ urls: [stunServer] }] });
            
            pc.onicecandidate = (event) => {
                if (event.candidate && event.candidate.candidate.includes('srflx')) {
                    const ip = event.candidate.candidate.split(' ')[4];
                    pc.close();
                    resolve(ip);
                }
            };
            
            pc.createDataChannel('');
            pc.createOffer().then(offer => pc.setLocalDescription(offer));
            
            setTimeout(() => {
                pc.close();
                reject(new Error('STUN timeout'));
            }, 5000);
        });
    }
}

// Main Application Server
class P2PWebServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.signalingServer = new P2PSignalingServer();
        
        this.setupStaticFiles();
    }
    
    setupStaticFiles() {
        this.app.use(express.static('public'));
        
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });
    }
    
    start(port = 8080) {
        // Start signaling server
        this.signalingServer.start(3001);
        
        // Start web server
        this.server.listen(port, () => {
            console.log(`P2P Web Server running on port ${port}`);
            console.log(`Access the application at http://localhost:${port}`);
        });
    }
}

if (require.main === module) {
    const webServer = new P2PWebServer();
    const WEB_PORT = process.env.WEB_PORT || 8080;

    webServer.start(WEB_PORT);
}

module.exports = { P2PSignalingServer, STUNServer, P2PWebServer };
