import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import { STUNServer } from './stun-server.js';
import { TURNServer } from './turn-server.js';
import { SignalingServer } from './signaling-server.js';

const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('dist'));

// WebSocket server for signaling
const wss = new WebSocketServer({ server, path: '/signaling' });

// Initialize servers
const stunServer = new STUNServer();
const turnServer = new TURNServer();
const signalingServer = new SignalingServer(wss);

// Start STUN server on port 3478
stunServer.start(3478);

// Start TURN server on port 3479
turnServer.start(3479);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    peers: signalingServer.getPeerCount(),
    rooms: signalingServer.getRoomCount()
  });
});

// Get STUN/TURN configuration
app.get('/api/ice-servers', (req, res) => {
  res.json({
    iceServers: [
      { urls: 'stun:localhost:3478' },
      { 
        urls: 'turn:localhost:3479',
        username: 'user',
        credential: 'pass'
      }
    ]
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 P2P Torrent System running on port ${PORT}`);
  console.log(`📡 STUN server running on port 3478`);
  console.log(`🔄 TURN server running on port 3479`);
  console.log(`🌐 WebSocket signaling available at ws://localhost:${PORT}/signaling`);
});