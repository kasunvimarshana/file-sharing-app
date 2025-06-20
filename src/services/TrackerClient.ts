import { TorrentCrypto } from '../utils/crypto';
import type { TorrentFile, TrackerResponse } from '../types/torrent';

export class TrackerClient {
  private peerId: string;
  private announceCache: Map<string, { response: TrackerResponse; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  constructor() {
    this.peerId = TorrentCrypto.generatePeerId();
  }

  async announce(
    torrent: TorrentFile,
    downloaded: number,
    uploaded: number,
    left: number,
    event: 'started' | 'stopped' | 'completed' | 'empty' = 'empty'
  ): Promise<TrackerResponse> {
    const cacheKey = `${torrent.infoHash}-${event}`;
    
    // Check cache for non-event announces
    if (event === 'empty') {
      const cached = this.announceCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.response;
      }
    }

    const params = new URLSearchParams({
      info_hash: TorrentCrypto.urlEncode(TorrentCrypto.hexToBytes(torrent.infoHash)),
      peer_id: this.peerId,
      port: '8080',
      uploaded: uploaded.toString(),
      downloaded: downloaded.toString(),
      left: left.toString(),
      compact: '1',
      numwant: '50',
      key: this.generateKey(),
      ...(event !== 'empty' && { event })
    });

    try {
      let response: TrackerResponse;

      // Try announce URLs in order
      const announceUrls = this.getAnnounceUrls(torrent);
      
      for (const url of announceUrls) {
        try {
          response = await this.httpAnnounce(url, params);
          
          // Cache successful response
          if (event === 'empty') {
            this.announceCache.set(cacheKey, {
              response,
              timestamp: Date.now()
            });
          }
          
          return response;
        } catch (error) {
          console.warn(`Tracker ${url} failed:`, error.message);
          continue;
        }
      }
      
      throw new Error('All trackers failed');
    } catch (error) {
      console.error('All tracker announces failed:', error);
      // Return empty response on failure
      return {
        interval: 300,
        peers: [],
        complete: 0,
        incomplete: 0
      };
    }
  }

  private getAnnounceUrls(torrent: TorrentFile): string[] {
    const urls: string[] = [];
    
    // Add main announce URL
    if (torrent.announce) {
      urls.push(torrent.announce);
    }
    
    // Add announce-list URLs
    if (torrent.announceList) {
      for (const tier of torrent.announceList) {
        urls.push(...tier);
      }
    }
    
    // Add fallback to our internal tracker
    const internalTracker = '/api/announce';
    if (!urls.includes(internalTracker)) {
      urls.push(internalTracker);
    }
    
    return urls;
  }

  private async httpAnnounce(url: string, params: URLSearchParams): Promise<TrackerResponse> {
    const fullUrl = url.includes('?') ? `${url}&${params}` : `${url}?${params}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'P2P-Torrent-System/1.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        // JSON response (our internal tracker)
        const data = await response.json();
        return this.validateTrackerResponse(data);
      } else {
        // Bencode response (external tracker)
        const data = await response.arrayBuffer();
        const decoded = this.parseBencodeResponse(new Uint8Array(data));
        return this.convertTrackerResponse(decoded);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Tracker request timeout');
      }
      throw error;
    }
  }

  private parseBencodeResponse(data: Uint8Array): any {
    try {
      // Try to decode as text first (for error messages)
      const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
      
      // Check for JSON response
      if (text.trim().startsWith('{')) {
        return JSON.parse(text);
      }
      
      // Check for bencode error response
      if (text.includes('failure reason')) {
        // Simple bencode parser for error messages
        const match = text.match(/failure reason(\d+):(.+)/);
        if (match) {
          const reasonLength = parseInt(match[1]);
          const reason = match[2].substring(0, reasonLength);
          throw new Error(`Tracker error: ${reason}`);
        }
      }
      
      // For now, return a simplified response
      // In production, implement full bencode parser
      return {
        interval: 300,
        peers: [],
        complete: 0,
        incomplete: 0
      };
    } catch (error) {
      if (error.message.startsWith('Tracker error:')) {
        throw error;
      }
      throw new Error('Invalid tracker response format');
    }
  }

  private convertTrackerResponse(decoded: any): TrackerResponse {
    const response: TrackerResponse = {
      interval: decoded.interval || 300,
      complete: decoded.complete || 0,
      incomplete: decoded.incomplete || 0,
      peers: []
    };

    if (decoded.peers) {
      if (typeof decoded.peers === 'string') {
        // Compact format - each peer is 6 bytes (4 IP + 2 port)
        const peerData = new Uint8Array(decoded.peers.split('').map(c => c.charCodeAt(0)));
        for (let i = 0; i < peerData.length; i += 6) {
          if (i + 5 < peerData.length) {
            const ip = `${peerData[i]}.${peerData[i+1]}.${peerData[i+2]}.${peerData[i+3]}`;
            const port = (peerData[i+4] << 8) | peerData[i+5];
            
            if (this.isValidIP(ip) && this.isValidPort(port)) {
              response.peers.push({
                peerId: TorrentCrypto.generatePeerId(),
                ip,
                port
              });
            }
          }
        }
      } else if (Array.isArray(decoded.peers)) {
        // Dictionary format
        response.peers = decoded.peers
          .filter(peer => peer && peer.ip && peer.port)
          .filter(peer => this.isValidIP(peer.ip) && this.isValidPort(peer.port))
          .map((peer: any) => ({
            peerId: peer.peer_id || peer['peer id'] || TorrentCrypto.generatePeerId(),
            ip: peer.ip,
            port: peer.port
          }));
      }
    }

    return this.validateTrackerResponse(response);
  }

  private validateTrackerResponse(response: any): TrackerResponse {
    // Validate and sanitize tracker response
    const validated: TrackerResponse = {
      interval: Math.max(60, Math.min(3600, response.interval || 300)), // 1 minute to 1 hour
      complete: Math.max(0, response.complete || 0),
      incomplete: Math.max(0, response.incomplete || 0),
      peers: []
    };

    if (Array.isArray(response.peers)) {
      validated.peers = response.peers
        .filter(peer => 
          peer && 
          typeof peer.peerId === 'string' && 
          typeof peer.ip === 'string' && 
          typeof peer.port === 'number' &&
          this.isValidIP(peer.ip) &&
          this.isValidPort(peer.port)
        )
        .slice(0, 200); // Limit to 200 peers
    }

    return validated;
  }

  private isValidIP(ip: string): boolean {
    // Basic IP validation
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    
    return parts.every(part => {
      const num = parseInt(part, 10);
      return !isNaN(num) && num >= 0 && num <= 255;
    });
  }

  private isValidPort(port: number): boolean {
    return Number.isInteger(port) && port > 0 && port <= 65535;
  }

  private generateKey(): string {
    // Generate a random key for tracker requests
    return Math.random().toString(36).substring(2, 10);
  }

  async scrape(torrent: TorrentFile): Promise<{ complete: number; incomplete: number; downloaded: number }> {
    // Convert announce URL to scrape URL
    const announceUrl = torrent.announce;
    if (!announceUrl.includes('/announce')) {
      throw new Error('Cannot convert announce URL to scrape URL');
    }
    
    const scrapeUrl = announceUrl.replace('/announce', '/scrape');
    const params = new URLSearchParams({
      info_hash: TorrentCrypto.urlEncode(TorrentCrypto.hexToBytes(torrent.infoHash))
    });

    try {
      const response = await fetch(`${scrapeUrl}?${params}`, {
        headers: {
          'User-Agent': 'P2P-Torrent-System/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Scrape failed: ${response.status}`);
      }

      const data = await response.arrayBuffer();
      const decoded = this.parseBencodeResponse(new Uint8Array(data));
      
      if (decoded.files && decoded.files[torrent.infoHash]) {
        const stats = decoded.files[torrent.infoHash];
        return {
          complete: stats.complete || 0,
          incomplete: stats.incomplete || 0,
          downloaded: stats.downloaded || 0
        };
      }
      
      return { complete: 0, incomplete: 0, downloaded: 0 };
    } catch (error) {
      console.error('Scrape failed:', error);
      return { complete: 0, incomplete: 0, downloaded: 0 };
    }
  }

  getPeerId(): string {
    return this.peerId;
  }

  clearCache() {
    this.announceCache.clear();
  }

  getStats() {
    return {
      peerId: this.peerId,
      cacheSize: this.announceCache.size
    };
  }
}