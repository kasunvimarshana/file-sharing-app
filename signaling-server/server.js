const http = require('http');
const WebSocket = require('ws');

const server = http.createServer();
const wss = new WebSocket.Server({ 
  server,
  perMessageDeflate: false,
  maxPayload: 100 * 1024 * 1024 // 100MB max message size
});

const peers = new Map();

// Add CORS headers for HTTP requests
server.on('request', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Health check endpoint
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      peers: peers.size,
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection from:', req.socket.remoteAddress);
  let peerId = null;
  
  // Set up ping/pong for connection health
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  
  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch (error) {
      console.error('Invalid JSON received:', error.message);
      return;
    }
    
    const { type, payload } = data;
    
    if (!type || !payload) {
      console.error('Invalid message format');
      return;
    }

    switch (type) {
      case 'register':
        if (!payload.peerId) {
          console.error('No peerId provided in register message');
          return;
        }
        
        // Clean up old connection if peer reconnects
        if (peerId && peers.has(peerId)) {
          peers.delete(peerId);
        }
        
        peerId = payload.peerId;
        peers.set(peerId, ws);
        console.log(`Peer registered: ${peerId}`);
        
        // Send confirmation
        ws.send(JSON.stringify({
          type: 'registered',
          payload: { peerId, peerCount: peers.size }
        }));
        break;
        
      case 'signal':
        if (!payload.targetId) {
          console.error('No targetId provided in signal message');
          return;
        }
        
        const targetWs = peers.get(payload.targetId);
        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
          try {
            targetWs.send(JSON.stringify({
              type: 'signal',
              payload: { ...payload, senderId: peerId }
            }));
            console.log(`Signal forwarded from ${peerId} to ${payload.targetId}`);
          } catch (error) {
            console.error('Error forwarding signal:', error.message);
          }
        } else {
          console.log(`Target peer ${payload.targetId} not found or disconnected`);
          // Notify sender that target is not available
          ws.send(JSON.stringify({
            type: 'error',
            payload: { message: 'Target peer not available', targetId: payload.targetId }
          }));
        }
        break;
        
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', payload: {} }));
        break;
        
      default:
        console.error('Unknown message type:', type);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`WebSocket closed: ${code} ${reason}`);
    if (peerId) {
      peers.delete(peerId);
      console.log(`Peer disconnected: ${peerId}`);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error.message);
    if (peerId) {
      peers.delete(peerId);
    }
  });
});

// Health check interval
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      console.log('Terminating dead connection');
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});