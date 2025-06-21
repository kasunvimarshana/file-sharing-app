/**
 * BitTorrent-like Tracker Server
 * Maintains peer lists for file sharing and coordinates piece exchange
 * Implements torrent-like protocol for distributed file sharing
 */

import { createServer } from 'http';
import { parse } from 'url';
import { createHash } from 'crypto';

class TorrentTracker {
  constructor(port = 8000) {
    this.port = port;
    this.server = null;
    
    // Torrent tracking data
    this.torrents = new Map(); // infoHash -> torrent info
    this.peers = new Map(); // peerId -> peer info
    this.announces = new Map(); // peerId -> last announce time
    
    // Configuration
    this.announceInterval = 1800; // 30 minutes
    this.minAnnounceInterval = 900; // 15 minutes
    this.peerCleanupInterval = 3600; // 1 hour
  }

  /**
   * Start the tracker server
   */
  async start() {
    try {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (error) => {
        console.error('❌ Tracker server error:', error);
      });

      this.server.listen(this.port, () => {
        console.log(`📊 Torrent tracker running on port ${this.port}`);
        console.log(`🔗 Tracker URL: http://localhost:${this.port}/announce`);
      });

      // Start cleanup timer
      this.startCleanupTimer();

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } catch (error) {
      console.error('❌ Failed to start tracker server:', error);
      process.exit(1);
    }
  }

  /**
   * Handle HTTP requests
   */
  async handleRequest(req, res) {
    try {
      const url = parse(req.url, true);
      
      // Set CORS headers for web clients
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      console.log(`📨 ${req.method} ${url.pathname} from ${req.socket.remoteAddress}`);

      switch (url.pathname) {
        case '/announce':
          await this.handleAnnounce(url.query, req, res);
          break;
        
        case '/scrape':
          await this.handleScrape(url.query, req, res);
          break;
        
        case '/stats':
          await this.handleStats(req, res);
          break;
        
        case '/health':
          await this.handleHealth(req, res);
          break;
        
        default:
          this.sendError(res, 404, 'Not Found');
      }

    } catch (error) {
      console.error('❌ Error handling request:', error);
      this.sendError(res, 500, 'Internal Server Error');
    }
  }

  /**
   * Handle announce requests
   */
  async handleAnnounce(query, req, res) {
    try {
      // Validate required parameters
      const { info_hash, peer_id, port, uploaded, downloaded, left, event } = query;
      
      if (!info_hash || !peer_id || !port) {
        this.sendError(res, 400, 'Missing required parameters');
        return;
      }

      const infoHash = Buffer.from(info_hash, 'hex').toString('hex');
      const peerId = Buffer.from(peer_id, 'hex').toString('hex');
      const clientIp = req.socket.remoteAddress;
      const clientPort = parseInt(port);

      console.log(`📢 Announce from peer ${peerId.substring(0, 8)}... for torrent ${infoHash.substring(0, 8)}...`);

      // Get or create torrent
      if (!this.torrents.has(infoHash)) {
        this.torrents.set(infoHash, {
          infoHash: infoHash,
          peers: new Set(),
          seeders: new Set(),
          leechers: new Set(),
          completed: 0,
          createdAt: Date.now()
        });
      }

      const torrent = this.torrents.get(infoHash);
      
      // Update peer information
      const peer = {
        peerId: peerId,
        ip: clientIp,
        port: clientPort,
        uploaded: parseInt(uploaded) || 0,
        downloaded: parseInt(downloaded) || 0,
        left: parseInt(left) || 0,
        event: event || 'update',
        lastAnnounce: Date.now()
      };

      // Handle different events
      switch (event) {
        case 'started':
          console.log(`🟢 Peer ${peerId.substring(0, 8)}... started downloading`);
          break;
        
        case 'completed':
          console.log(`✅ Peer ${peerId.substring(0, 8)}... completed download`);
          torrent.completed++;
          break;
        
        case 'stopped':
          console.log(`🔴 Peer ${peerId.substring(0, 8)}... stopped`);
          this.removePeerFromTorrent(peerId, torrent);
          break;
        
        default:
          // Regular update
          break;
      }

      if (event !== 'stopped') {
        // Add/update peer in torrent
        torrent.peers.add(peerId);
        
        if (peer.left === 0) {
          torrent.seeders.add(peerId);
          torrent.leechers.delete(peerId);
        } else {
          torrent.leechers.add(peerId);
          torrent.seeders.delete(peerId);
        }

        // Update global peer registry
        this.peers.set(peerId, peer);
        this.announces.set(peerId, Date.now());
      }

      // Generate peer list for response
      const peerList = this.generatePeerList(torrent, peerId, query.numwant);

      // Send announce response
      this.sendAnnounceResponse(res, torrent, peerList);

    } catch (error) {
      console.error('❌ Error handling announce:', error);
      this.sendError(res, 500, 'Server error during announce');
    }
  }

  /**
   * Handle scrape requests
   */
  async handleScrape(query, req, res) {
    try {
      const scrapeData = {};

      if (query.info_hash) {
        // Scrape specific torrent
        const infoHashes = Array.isArray(query.info_hash) ? query.info_hash : [query.info_hash];
        
        for (const hash of infoHashes) {
          const infoHash = Buffer.from(hash, 'hex').toString('hex');
          const torrent = this.torrents.get(infoHash);
          
          if (torrent) {
            scrapeData[infoHash] = {
              complete: torrent.seeders.size,
              incomplete: torrent.leechers.size,
              downloaded: torrent.completed
            };
          }
        }
      } else {
        // Scrape all torrents
        for (const [infoHash, torrent] of this.torrents.entries()) {
          scrapeData[infoHash] = {
            complete: torrent.seeders.size,
            incomplete: torrent.leechers.size,
            downloaded: torrent.completed
          };
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        files: scrapeData
      }));

    } catch (error) {
      console.error('❌ Error handling scrape:', error);
      this.sendError(res, 500, 'Server error during scrape');
    }
  }

  /**
   * Handle stats requests
   */
  async handleStats(req, res) {
    try {
      const stats = {
        torrents: this.torrents.size,
        peers: this.peers.size,
        totalSeeders: 0,
        totalLeechers: 0,
        uptime: process.uptime(),
        timestamp: Date.now()
      };

      // Calculate totals
      for (const torrent of this.torrents.values()) {
        stats.totalSeeders += torrent.seeders.size;
        stats.totalLeechers += torrent.leechers.size;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats, null, 2));

    } catch (error) {
      console.error('❌ Error handling stats:', error);
      this.sendError(res, 500, 'Server error');
    }
  }

  /**
   * Handle health check requests
   */
  async handleHealth(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      uptime: process.uptime(),
      torrents: this.torrents.size,
      peers: this.peers.size
    }));
  }

  /**
   * Generate peer list for announce response
   */
  generatePeerList(torrent, requestingPeerId, numwant = 50) {
    const peers = [];
    const maxPeers = Math.min(parseInt(numwant) || 50, 100);
    
    // Get list of peers excluding the requesting peer
    const availablePeers = Array.from(torrent.peers)
      .filter(peerId => peerId !== requestingPeerId && this.peers.has(peerId))
      .slice(0, maxPeers);

    for (const peerId of availablePeers) {
      const peer = this.peers.get(peerId);
      if (peer) {
        peers.push({
          peer_id: Buffer.from(peer.peerId, 'hex'),
          ip: peer.ip,
          port: peer.port
        });
      }
    }

    return peers;
  }

  /**
   * Send announce response
   */
  sendAnnounceResponse(res, torrent, peers) {
    const response = {
      interval: this.announceInterval,
      'min interval': this.minAnnounceInterval,
      complete: torrent.seeders.size,
      incomplete: torrent.leechers.size,
      peers: peers.map(peer => ({
        'peer id': peer.peer_id.toString('hex'),
        ip: peer.ip,
        port: peer.port
      }))
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  }

  /**
   * Remove peer from torrent
   */
  removePeerFromTorrent(peerId, torrent) {
    torrent.peers.delete(peerId);
    torrent.seeders.delete(peerId);
    torrent.leechers.delete(peerId);
    
    this.peers.delete(peerId);
    this.announces.delete(peerId);
  }

  /**
   * Send error response
   */
  sendError(res, statusCode, message) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      'failure reason': message
    }));
  }

  /**
   * Start cleanup timer for inactive peers
   */
  startCleanupTimer() {
    setInterval(() => {
      const now = Date.now();
      const timeout = this.peerCleanupInterval * 1000;
      const inactivePeers = [];

      // Find inactive peers
      for (const [peerId, lastAnnounce] of this.announces.entries()) {
        if (now - lastAnnounce > timeout) {
          inactivePeers.push(peerId);
        }
      }

      // Clean up inactive peers
      for (const peerId of inactivePeers) {
        console.log(`🗑️ Cleaning up inactive peer: ${peerId.substring(0, 8)}...`);
        
        // Remove from all torrents
        for (const torrent of this.torrents.values()) {
          this.removePeerFromTorrent(peerId, torrent);
        }
      }

      // Clean up empty torrents
      const emptyTorrents = [];
      for (const [infoHash, torrent] of this.torrents.entries()) {
        if (torrent.peers.size === 0 && now - torrent.createdAt > timeout) {
          emptyTorrents.push(infoHash);
        }
      }

      for (const infoHash of emptyTorrents) {
        this.torrents.delete(infoHash);
        console.log(`🗑️ Cleaned up empty torrent: ${infoHash.substring(0, 8)}...`);
      }

      if (inactivePeers.length > 0 || emptyTorrents.length > 0) {
        console.log(`🧹 Cleanup completed: ${inactivePeers.length} peers, ${emptyTorrents.length} torrents`);
      }

    }, 300000); // Check every 5 minutes
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    console.log('🛑 Shutting down torrent tracker...');
    
    if (this.server) {
      this.server.close(() => {
        console.log('✅ Torrent tracker shut down gracefully');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tracker = new TorrentTracker(process.env.TRACKER_PORT || 8000);
  tracker.start();
}

export default TorrentTracker;