import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { STUNServer } from './stun-server.js';
import { TURNServer } from './turn-server.js';

const app = express();
const server = createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable for development
}));
app.use(cors());
app.use(express.json());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
}

// WebSocket signaling server with explicit path
const wss = new WebSocketServer({ 
  server,
  path: '/ws'
});
const peers = new Map();

wss.on('connection', (ws) => {
  console.log('New peer connected');
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleSignalingMessage(ws, message);
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  });

  ws.on('close', () => {
    // Remove peer from the list
    for (const [peerId, peer] of peers) {
      if (peer.ws === ws) {
        peers.delete(peerId);
        broadcastPeerLeft(peerId);
        break;
      }
    }
    console.log('Peer disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function handleSignalingMessage(ws, message) {
  switch (message.type) {
    case 'join':
      handleJoin(ws);
      break;
    case 'offer':
      handleOffer(message);
      break;
    case 'answer':
      handleAnswer(message);
      break;
    case 'ice-candidate':
      handleIceCandidate(message);
      break;
  }
}

function handleJoin(ws) {
  const peerId = generatePeerId();
  peers.set(peerId, { ws, id: peerId, connected: true });
  
  // Send joined confirmation
  ws.send(JSON.stringify({
    type: 'joined',
    id: peerId
  }));

  // Send current peers list
  const peersList = Array.from(peers.values())
    .filter(peer => peer.id !== peerId)
    .map(peer => ({ id: peer.id, connected: peer.connected }));
  
  ws.send(JSON.stringify({
    type: 'peers-list',
    peers: peersList
  }));

  // Broadcast new peer to existing peers
  broadcastPeerJoined({ id: peerId, connected: true }, peerId);
}

function handleOffer(message) {
  const targetPeer = peers.get(message.target);
  if (targetPeer) {
    targetPeer.ws.send(JSON.stringify({
      type: 'offer',
      from: getSenderPeerId(message),
      offer: message.offer
    }));
  }
}

function handleAnswer(message) {
  const targetPeer = peers.get(message.target);
  if (targetPeer) {
    targetPeer.ws.send(JSON.stringify({
      type: 'answer',
      from: getSenderPeerId(message),
      answer: message.answer
    }));
  }
}

function handleIceCandidate(message) {
  const targetPeer = peers.get(message.target);
  if (targetPeer) {
    targetPeer.ws.send(JSON.stringify({
      type: 'ice-candidate',
      from: getSenderPeerId(message),
      candidate: message.candidate
    }));
  }
}

function getSenderPeerId(message) {
  for (const [peerId, peer] of peers) {
    if (peer.ws.readyState === WebSocket.OPEN) {
      // This is a simplified way to identify sender
      // In production, you'd want proper authentication
      return peerId;
    }
  }
  return null;
}

function broadcastPeerJoined(peer, excludePeerId) {
  const message = JSON.stringify({
    type: 'peer-joined',
    peer: peer
  });

  peers.forEach((peerInfo, peerId) => {
    if (peerId !== excludePeerId && peerInfo.ws.readyState === WebSocket.OPEN) {
      peerInfo.ws.send(message);
    }
  });
}

function broadcastPeerLeft(peerId) {
  const message = JSON.stringify({
    type: 'peer-left',
    peerId: peerId
  });

  peers.forEach((peer) => {
    if (peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(message);
    }
  });
}

function generatePeerId() {
  return Math.random().toString(36).substr(2, 9);
}

// Start STUN server
const stunServer = new STUNServer();
stunServer.start(3478);

// Start TURN server
const turnServer = new TURNServer();
turnServer.start(3479);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    peers: peers.size,
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket signaling server ready on /ws`);
  console.log(`STUN server running on port 3478`);
  console.log(`TURN server running on port 3479`);
});

export { app, server };