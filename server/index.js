import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { logger } from './logger.js';
import { STUNServer } from './stun-server.js';
import { TURNServer } from './turn-server.js';
import { SignalingServer } from './signaling-server.js';

const app = express();
const server = createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  optionsSuccessStatus: 200
}));

// Compression
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindow,
  max: config.rateLimitMax,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// Body parsing with size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    if (buf.length > config.maxMessageSize) {
      throw new Error('Request entity too large');
    }
  }
}));

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static('dist', {
  maxAge: '1d',
  etag: true
}));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// WebSocket server for signaling
const wss = new WebSocketServer({ 
  server, 
  path: '/signaling',
  maxPayload: config.maxMessageSize,
  perMessageDeflate: {
    zlibDeflateOptions: {
      level: 3
    }
  }
});

// Initialize servers
const stunServer = new STUNServer();
const turnServer = new TURNServer();
const signalingServer = new SignalingServer(wss);

// Start STUN server
try {
  stunServer.start(config.stunPort);
  logger.info(`STUN server started on port ${config.stunPort}`);
} catch (error) {
  logger.error('Failed to start STUN server:', error);
}

// Start TURN server
try {
  turnServer.start(config.turnPort);
  logger.info(`TURN server started on port ${config.turnPort}`);
} catch (error) {
  logger.error('Failed to start TURN server:', error);
}

// API Routes
app.get('/api/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    peers: signalingServer.getPeerCount(),
    rooms: signalingServer.getRoomCount(),
    connections: signalingServer.getConnectionCount(),
    version: process.env.npm_package_version || '1.0.0'
  };
  
  res.json(health);
});

app.get('/api/stats', (req, res) => {
  const stats = {
    peers: signalingServer.getPeerCount(),
    rooms: signalingServer.getRoomCount(),
    connections: signalingServer.getConnectionCount(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  };
  
  res.json(stats);
});

app.get('/api/ice-servers', (req, res) => {
  const iceServers = [
    { 
      urls: `stun:${req.hostname}:${config.stunPort}` 
    },
    { 
      urls: `turn:${req.hostname}:${config.turnPort}`,
      username: config.turnUsername,
      credential: config.turnPassword
    }
  ];
  
  // Add public STUN servers as fallback
  iceServers.push(
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  );
  
  res.json({ iceServers });
});

// Metrics endpoint (for monitoring)
app.get('/api/metrics', (req, res) => {
  const metrics = {
    peers_total: signalingServer.getPeerCount(),
    rooms_total: signalingServer.getRoomCount(),
    connections_total: signalingServer.getConnectionCount(),
    uptime_seconds: process.uptime(),
    memory_usage_bytes: process.memoryUsage().heapUsed,
    memory_total_bytes: process.memoryUsage().heapTotal,
    timestamp: Date.now()
  };
  
  res.set('Content-Type', 'text/plain');
  res.send(Object.entries(metrics)
    .map(([key, value]) => `${key} ${value}`)
    .join('\n'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Express error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });
  
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Request entity too large',
      maxSize: config.maxMessageSize
    });
  }
  
  res.status(500).json({
    error: config.nodeEnv === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'API endpoint not found' });
  } else {
    // Serve index.html for SPA routes
    res.sendFile('index.html', { root: 'dist' });
  }
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Close WebSocket server
    wss.close(() => {
      logger.info('WebSocket server closed');
    });
    
    // Close STUN/TURN servers
    stunServer.stop();
    turnServer.stop();
    
    // Close signaling server
    signalingServer.shutdown();
    
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled promise rejection
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Uncaught exception
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start server
server.listen(config.port, () => {
  logger.info(`🚀 P2P Torrent System running on port ${config.port}`);
  logger.info(`📡 STUN server running on port ${config.stunPort}`);
  logger.info(`🔄 TURN server running on port ${config.turnPort}`);
  logger.info(`🌐 WebSocket signaling available at ws://localhost:${config.port}/signaling`);
  logger.info(`Environment: ${config.nodeEnv}`);
});