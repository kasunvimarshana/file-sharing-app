import express from 'express';
import { createServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import cors from 'cors';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.debug(`process.env.NODE_ENV: ${process.env.NODE_ENV}`);
console.debug(`__filename: ${__filename}`);
console.debug(`__dirname: ${__dirname}`);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Security middleware
app.use(limiter);
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Serve static files with proper MIME types BEFORE other routes
const staticPath = process.env.NODE_ENV === 'production' 
  ? join(__dirname, '..')
  : join(__dirname, '..');

console.debug(`staticPath: ${staticPath}`);

app.use(express.static(staticPath, {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (path.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html');
    } else if (path.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json');
    }
  }
}));

// Secure file upload middleware
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.torrent');
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    // Validate file type
    if (file.mimetype === 'application/x-bittorrent' || file.originalname.endsWith('.torrent')) {
      cb(null, true);
    } else {
      cb(null, false); // Fixed: Pass null as first argument instead of Error
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  }
});

// Enhanced in-memory storage with persistence
const swarms = new Map(); // infoHash -> Set of peer IDs
const peers = new Map(); // peer ID -> WebSocket
const torrents = new Map(); // infoHash -> torrent metadata
const peerStats = new Map(); // peer ID -> stats

// Load persisted data on startup
function loadPersistedData() {
  try {
    if (fs.existsSync('data/torrents.json')) {
      const data = JSON.parse(fs.readFileSync('data/torrents.json', 'utf8'));
      Object.entries(data).forEach(([hash, torrent]) => {
        torrents.set(hash, torrent);
      });
      console.log(`Loaded ${torrents.size} torrents from persistent storage`);
    }
  } catch (error) {
    console.error('Failed to load persisted data:', error);
  }
}

// Save data periodically
function savePersistedData() {
  try {
    if (!fs.existsSync('data')) {
      fs.mkdirSync('data', { recursive: true });
    }
    const data = Object.fromEntries(torrents);
    fs.writeFileSync('data/torrents.json', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Failed to save persisted data:', error);
  }
}

// Tracker API with enhanced security
app.get('/api/announce', (req, res) => {
  const {
    info_hash,
    peer_id,
    port,
    uploaded,
    downloaded,
    left,
    event,
    compact,
    key,
    numwant
  } = req.query;

  // Validate required parameters
  if (!info_hash || !peer_id || typeof port === 'undefined') {
    return res.status(400).json({ 
      'failure reason': 'Missing required parameters: info_hash, peer_id, port' 
    });
  }

  // Validate parameter types and ranges
  const portNum = parseInt(port as string);
  if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
    return res.status(400).json({ 
      'failure reason': 'Invalid port number' 
    });
  }

  const infoHash = info_hash as string;
  const peerId = peer_id as string;

  // Validate info hash format
  if (!/^[a-fA-F0-9%]{40,}$/.test(infoHash)) {
    return res.status(400).json({
      'failure reason': 'Invalid info_hash format'
    });
  }

  // Initialize swarm if it doesn't exist
  if (!swarms.has(infoHash)) {
    swarms.set(infoHash, new Set());
  }

  const swarm = swarms.get(infoHash);
  const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';

  // Handle events with proper validation
  switch (event) {
    case 'started':
      swarm.add(peerId);
      peerStats.set(peerId, {
        ip: clientIp,
        port: portNum,
        uploaded: parseInt(uploaded as string) || 0,
        downloaded: parseInt(downloaded as string) || 0,
        left: parseInt(left as string) || 0,
        startTime: Date.now(),
        lastAnnounce: Date.now()
      });
      break;
    case 'stopped':
      swarm.delete(peerId);
      peerStats.delete(peerId);
      break;
    case 'completed':
      if (peerStats.has(peerId)) {
        const stats = peerStats.get(peerId);
        stats.left = 0;
        stats.lastAnnounce = Date.now();
      }
      break;
    default:
      // Regular announce - update stats
      if (peerStats.has(peerId)) {
        const stats = peerStats.get(peerId);
        stats.uploaded = parseInt(uploaded as string) || 0;
        stats.downloaded = parseInt(downloaded as string) || 0;
        stats.left = parseInt(left as string) || 0;
        stats.lastAnnounce = Date.now();
      } else {
        // Add peer if not exists
        swarm.add(peerId);
        peerStats.set(peerId, {
          ip: clientIp,
          port: portNum,
          uploaded: parseInt(uploaded as string) || 0,
          downloaded: parseInt(downloaded as string) || 0,
          left: parseInt(left as string) || 0,
          startTime: Date.now(),
          lastAnnounce: Date.now()
        });
      }
  }

  // Clean up stale peers
  const now = Date.now();
  const staleTimeout = 30 * 60 * 1000; // 30 minutes
  
  for (const [pid, stats] of peerStats) {
    if (now - stats.lastAnnounce > staleTimeout) {
      swarm.delete(pid);
      peerStats.delete(pid);
    }
  }

  // Get peer list (exclude requesting peer)
  const maxPeers = Math.min(parseInt(numwant as string) || 50, 200);
  const peerList = Array.from(swarm)
    .filter(id => id !== peerId)
    .slice(0, maxPeers)
    .map(id => {
      const stats = peerStats.get(id);
      return {
        'peer id': id,
        ip: stats?.ip || '127.0.0.1',
        port: stats?.port || 6881
      };
    });

  // Calculate seeders and leechers
  const seeders = Array.from(swarm).filter(id => {
    const stats = peerStats.get(id);
    return stats && stats.left === 0;
  }).length;

  const leechers = swarm.size - seeders;

  const response = {
    interval: 300, // 5 minutes
    'min interval': 120, // 2 minutes
    complete: seeders,
    incomplete: leechers,
    peers: peerList
  };

  res.json(response);
});

// DHT bootstrap nodes
app.get('/api/dht/nodes', (req, res) => {
  const nodes = [
    { host: 'router.bittorrent.com', port: 6881 },
    { host: 'dht.transmissionbt.com', port: 6881 },
    { host: 'router.utorrent.com', port: 6881 },
    { host: 'dht.libtorrent.org', port: 25401 }
  ];
  res.json({ nodes });
});

// Enhanced torrent management
app.post('/api/torrents', upload.single('torrent'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No torrent file provided' });
    }

    const torrentData = fs.readFileSync(req.file.path);
    
    // Validate torrent file format
    if (!isValidTorrentFile(torrentData)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Invalid torrent file format' });
    }

    // Parse torrent and generate info hash
    const infoHash = await calculateInfoHash(torrentData);
    const torrentInfo = await parseTorrentFile(torrentData);

    torrents.set(infoHash, {
      name: torrentInfo.name || req.body.name || 'Unknown',
      size: torrentInfo.size || torrentData.length,
      pieceLength: torrentInfo.pieceLength || 0,
      pieces: torrentInfo.pieces || 0,
      files: torrentInfo.files || [],
      createdAt: new Date().toISOString(),
      addedBy: req.ip || 'unknown'
    });

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    // Save to persistent storage
    savePersistedData();

    res.json({ 
      infoHash, 
      message: 'Torrent added successfully',
      torrent: torrents.get(infoHash)
    });
  } catch (error) {
    console.error('Error adding torrent:', error);
    if (req.file) {
      // Fixed: Remove .catch() since fs.unlinkSync is synchronous
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to cleanup uploaded file:', unlinkError);
      }
    }
    res.status(500).json({ error: 'Failed to add torrent' });
  }
});

app.get('/api/torrents', (req, res) => {
  const torrentList = Array.from(torrents.entries()).map(([infoHash, data]) => ({
    infoHash,
    ...data,
    swarmSize: swarms.get(infoHash)?.size || 0,
    seeders: Array.from(swarms.get(infoHash) || []).filter(peerId => {
      const stats = peerStats.get(peerId);
      return stats && stats.left === 0;
    }).length
  }));
  res.json(torrentList);
});

app.delete('/api/torrents/:infoHash', (req, res) => {
  const { infoHash } = req.params;
  
  if (torrents.has(infoHash)) {
    torrents.delete(infoHash);
    swarms.delete(infoHash);
    savePersistedData();
    res.json({ message: 'Torrent removed successfully' });
  } else {
    res.status(404).json({ error: 'Torrent not found' });
  }
});

// Enhanced WebSocket signaling server
wss.on('connection', (ws, req) => {
  let peerId: string | undefined = undefined;
  let clientIp = req.socket.remoteAddress;
  
  // Connection timeout
  const timeout = setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1000, 'Connection timeout');
    }
  }, 60000); // 1 minute timeout for initial handshake

  ws.on('message', (data) => {
    try {
      clearTimeout(timeout);
      const message = JSON.parse(data.toString());
      
      // Validate message format
      if (!message.type) {
        ws.send(JSON.stringify({ error: 'Invalid message format' }));
        return;
      }
      
      handleSignalingMessage(ws, message);
    } catch (error) {
      console.error('Invalid WebSocket message:', error);
      ws.send(JSON.stringify({ error: 'Invalid JSON format' }));
    }
  });

  ws.on('close', () => {
    clearTimeout(timeout);
    if (peerId) {
      peers.delete(peerId);
      peerStats.delete(peerId);
      
      // Remove from all swarms
      for (const [infoHash, swarm] of swarms) {
        swarm.delete(peerId);
      }
      
      // Notify other peers
      broadcastToAllSwarms({
        type: 'peer-disconnected',
        data: { peerId }
      }, peerId);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  function handleSignalingMessage(ws: WebSocket, message: any) {
    const { type, from, to, data, infoHash } = message;

    switch (type) {
      case 'join-swarm':
        if (!message.peerId || !infoHash) {
          ws.send(JSON.stringify({ error: 'Missing peerId or infoHash' }));
          return;
        }
        
        peerId = message.peerId;
        peers.set(peerId, ws);
        
        if (!swarms.has(infoHash)) {
          swarms.set(infoHash, new Set());
        }
        
        const swarm = swarms.get(infoHash);
        swarm.add(peerId);
        
        peerStats.set(peerId, {
          ip: clientIp,
          port: 0,
          uploaded: 0,
          downloaded: 0,
          left: 0,
          startTime: Date.now(),
          lastAnnounce: Date.now(),
          infoHash
        });
        
        // Send peer list to the joining peer
        const peerList = Array.from(swarm).filter(id => id !== peerId);
        ws.send(JSON.stringify({
          type: 'peer-list',
          data: { peers: peerList, swarmSize: swarm.size }
        }));
        
        // Notify other peers about the new peer
        broadcastToSwarm(infoHash, {
          type: 'peer-joined',
          data: { peerId, swarmSize: swarm.size }
        }, peerId);
        break;

      case 'leave-swarm':
        if (peerId && infoHash && swarms.has(infoHash)) {
          const swarm = swarms.get(infoHash);
          swarm.delete(peerId);
          
          broadcastToSwarm(infoHash, {
            type: 'peer-left',
            data: { peerId, swarmSize: swarm.size }
          }, peerId);
        }
        break;

      case 'offer':
      case 'answer':
      case 'ice-candidate':
        // Validate signaling message
        if (!from || !to) {
          ws.send(JSON.stringify({ error: 'Missing from or to field' }));
          return;
        }
        
        // Forward signaling messages between peers
        if (peers.has(to)) {
          const targetWs = peers.get(to);
          if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(JSON.stringify(message));
          } else {
            ws.send(JSON.stringify({ 
              error: 'Target peer not available',
              type: 'peer-unavailable',
              targetPeer: to
            }));
          }
        } else {
          ws.send(JSON.stringify({ 
            error: 'Target peer not found',
            type: 'peer-not-found',
            targetPeer: to
          }));
        }
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      default:
        console.log('Unknown message type:', type);
        ws.send(JSON.stringify({ error: 'Unknown message type' }));
    }
  }

  function broadcastToSwarm(infoHash: string, message: any, excludePeerId?: string) {
    if (!swarms.has(infoHash)) return;

    const swarm = swarms.get(infoHash);
    for (const peerId of swarm) {
      if (peerId !== excludePeerId && peers.has(peerId)) {
        const peerWs = peers.get(peerId);
        if (peerWs && peerWs.readyState === WebSocket.OPEN) {
          try {
            peerWs.send(JSON.stringify(message));
          } catch (error) {
            console.error('Failed to send message to peer:', error);
          }
        }
      }
    }
  }

  function broadcastToAllSwarms(message: any, excludePeerId?: string) {
    for (const [infoHash] of swarms) {
      broadcastToSwarm(infoHash, message, excludePeerId);
    }
  }
});

// Enhanced health check
app.get('/api/health', (req, res) => {
  const healthData = {
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    torrents: torrents.size,
    swarms: swarms.size,
    connectedPeers: peers.size,
    totalPeerConnections: Array.from(swarms.values()).reduce((sum, swarm) => sum + swarm.size, 0),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  };
  
  res.json(healthData);
});

// Enhanced statistics
app.get('/api/stats', (req, res) => {
  const stats = {
    torrents: torrents.size,
    swarms: swarms.size,
    connectedPeers: peers.size,
    totalPeerStats: peerStats.size,
    swarmDetails: Array.from(swarms.entries()).map(([hash, swarm]) => {
      const torrent = torrents.get(hash);
      const swarmPeers = Array.from(swarm);
      const seeders = swarmPeers.filter(peerId => {
        const stats = peerStats.get(peerId);
        return stats && stats.left === 0;
      });
      
      return {
        infoHash: hash,
        name: torrent?.name || 'Unknown',
        totalPeers: swarm.size,
        seeders: seeders.length,
        leechers: swarm.size - seeders.length,
        lastActivity: Math.max(...swarmPeers.map(peerId => {
          const stats = peerStats.get(peerId);
          return stats?.lastAnnounce || 0;
        }))
      };
    }),
    systemStats: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      platform: process.platform,
      nodeVersion: process.version
    }
  };
  res.json(stats);
});

// Utility functions
async function calculateInfoHash(torrentData: Buffer): Promise<string> {
  const hash = crypto.createHash('sha1');
  hash.update(torrentData);
  return hash.digest('hex');
}

function isValidTorrentFile(data: Buffer): boolean {
  try {
    // Basic validation - torrent files start with 'd' (dictionary)
    return data.length > 0 && data[0] === 0x64; // 'd' in ASCII
  } catch {
    return false;
  }
}

async function parseTorrentFile(data: Buffer): Promise<any> {
  // Simplified parser - in production, use a full bencode parser
  return {
    name: 'Parsed Torrent',
    size: data.length,
    pieceLength: 262144,
    pieces: 1,
    files: []
  };
}

// Serve the React app for all other routes (MUST be last)
app.get('*', (req, res) => {
  // Don't serve index.html for API routes or asset requests
  if (req.path.startsWith('/api/') || 
      req.path.includes('.') || 
      req.path.startsWith('/ws')) {
    return res.status(404).json({ error: 'Not found' });
  }
  
  const indexPath = join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Application not built' });
  }
});

// Error handling middleware
app.use((error: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

const PORT = process.env.PORT || 3000;

// Load persisted data on startup
loadPersistedData();

// Save data periodically
setInterval(savePersistedData, 5 * 60 * 1000); // Every 5 minutes

server.listen(PORT, () => {
  console.log(`🚀 P2P Torrent System running on port ${PORT}`);
  console.log(`📊 Tracker available at http://localhost:${PORT}/api/announce`);
  console.log(`🌐 WebSocket signaling at ws://localhost:${PORT}/ws`);
  console.log(`💻 Web interface at http://localhost:${PORT}`);
  console.log(`🐳 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`Received ${signal}, shutting down gracefully...`);
  
  // Save data before shutdown
  savePersistedData();
  
  server.close(() => {
    console.log('HTTP server closed');
    
    // Close all WebSocket connections
    wss.clients.forEach((ws) => {
      ws.close();
    });
    
    console.log('All connections closed');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});
