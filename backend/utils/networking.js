/**
 * Networking Utilities
 * Provides network-related functions for P2P operations
 * Handles connection management, NAT traversal, and network discovery
 */

import { networkInterfaces } from 'os';
import { createSocket } from 'dgram';

export class NetworkUtils {
  /**
   * Get local IP addresses
   */
  static getLocalIPs() {
    const interfaces = networkInterfaces();
    const addresses = [];

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal and non-IPv4 addresses
        if (!iface.internal && iface.family === 'IPv4') {
          addresses.push({
            interface: name,
            address: iface.address,
            netmask: iface.netmask,
            mac: iface.mac
          });
        }
      }
    }

    return addresses;
  }

  /**
   * Get primary local IP address
   */
  static getPrimaryLocalIP() {
    const ips = this.getLocalIPs();
    
    // Prefer private network addresses
    const privateIP = ips.find(ip => 
      ip.address.startsWith('192.168.') ||
      ip.address.startsWith('10.') ||
      ip.address.startsWith('172.')
    );

    return privateIP ? privateIP.address : (ips[0] ? ips[0].address : '127.0.0.1');
  }

  /**
   * Check if IP address is private
   */
  static isPrivateIP(ip) {
    return (
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      ip.startsWith('172.16.') ||
      ip.startsWith('172.17.') ||
      ip.startsWith('172.18.') ||
      ip.startsWith('172.19.') ||
      ip.startsWith('172.20.') ||
      ip.startsWith('172.21.') ||
      ip.startsWith('172.22.') ||
      ip.startsWith('172.23.') ||
      ip.startsWith('172.24.') ||
      ip.startsWith('172.25.') ||
      ip.startsWith('172.26.') ||
      ip.startsWith('172.27.') ||
      ip.startsWith('172.28.') ||
      ip.startsWith('172.29.') ||
      ip.startsWith('172.30.') ||
      ip.startsWith('172.31.') ||
      ip.startsWith('127.') ||
      ip === 'localhost'
    );
  }

  /**
   * Get public IP address using STUN
   */
  static async getPublicIP(stunServer = 'stun.l.google.com', stunPort = 19302) {
    return new Promise((resolve, reject) => {
      const socket = createSocket('udp4');
      let timeout;

      socket.on('message', (message, remote) => {
        try {
          clearTimeout(timeout);
          
          if (message.length >= 20) {
            // Parse STUN response
            const messageType = message.readUInt16BE(0);
            const messageLength = message.readUInt16BE(2);
            const magicCookie = message.readUInt32BE(4);

            if (magicCookie === 0x2112A442 && messageType === 0x0101) {
              // Parse attributes to find XOR-MAPPED-ADDRESS
              let offset = 20;
              while (offset < message.length) {
                const attrType = message.readUInt16BE(offset);
                const attrLength = message.readUInt16BE(offset + 2);
                
                if (attrType === 0x0020) { // XOR-MAPPED-ADDRESS
                  const family = message.readUInt16BE(offset + 4);
                  if (family === 0x01) { // IPv4
                    const xorPort = message.readUInt16BE(offset + 6);
                    const xorAddress = message.readUInt32BE(offset + 8);
                    
                    const port = xorPort ^ (magicCookie >> 16);
                    const addressInt = xorAddress ^ magicCookie;
                    
                    const address = [
                      (addressInt >> 24) & 0xFF,
                      (addressInt >> 16) & 0xFF,
                      (addressInt >> 8) & 0xFF,
                      addressInt & 0xFF
                    ].join('.');

                    socket.close();
                    resolve({ address, port });
                    return;
                  }
                }
                
                offset += 4 + attrLength + (4 - (attrLength % 4)) % 4;
              }
            }
          }
          
          socket.close();
          reject(new Error('Invalid STUN response'));
        } catch (error) {
          socket.close();
          reject(error);
        }
      });

      socket.on('error', (error) => {
        clearTimeout(timeout);
        socket.close();
        reject(error);
      });

      try {
        // Create STUN binding request
        const transactionId = Buffer.from('123456789012');
        const request = Buffer.allocUnsafe(20);
        
        request.writeUInt16BE(0x0001, 0); // Binding Request
        request.writeUInt16BE(0, 2); // Length
        request.writeUInt32BE(0x2112A442, 4); // Magic Cookie
        transactionId.copy(request, 8);

        socket.send(request, stunPort, stunServer);
        
        timeout = setTimeout(() => {
          socket.close();
          reject(new Error('STUN request timeout'));
        }, 5000);

      } catch (error) {
        socket.close();
        reject(error);
      }
    });
  }

  /**
   * Test port connectivity
   */
  static async testPort(port, host = '127.0.0.1', timeout = 5000) {
    return new Promise((resolve) => {
      const socket = createSocket('udp4');
      let timer;

      socket.on('message', () => {
        clearTimeout(timer);
        socket.close();
        resolve(true);
      });

      socket.on('error', () => {
        clearTimeout(timer);
        socket.close();
        resolve(false);
      });

      try {
        socket.send(Buffer.from('test'), port, host);
        
        timer = setTimeout(() => {
          socket.close();
          resolve(false);
        }, timeout);

      } catch (error) {
        socket.close();
        resolve(false);
      }
    });
  }

  /**
   * Find available port in range
   */
  static async findAvailablePort(startPort = 6881, endPort = 6999) {
    for (let port = startPort; port <= endPort; port++) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    return null;
  }

  /**
   * Check if port is available
   */
  static async isPortAvailable(port) {
    return new Promise((resolve) => {
      const socket = createSocket('udp4');
      
      socket.on('error', () => {
        resolve(false);
      });

      socket.bind(port, () => {
        socket.close();
        resolve(true);
      });
    });
  }

  /**
   * Calculate network latency
   */
  static async measureLatency(host, port, samples = 3) {
    const latencies = [];

    for (let i = 0; i < samples; i++) {
      const start = Date.now();
      const reachable = await this.testPort(port, host, 2000);
      const end = Date.now();
      
      if (reachable) {
        latencies.push(end - start);
      }
    }

    if (latencies.length === 0) return null;

    return {
      min: Math.min(...latencies),
      max: Math.max(...latencies),
      avg: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      samples: latencies.length
    };
  }

  /**
   * Generate compact peer info for BitTorrent protocol
   */
  static compactPeerInfo(peers) {
    const compactBuffer = Buffer.allocUnsafe(peers.length * 6);
    let offset = 0;

    for (const peer of peers) {
      const ipParts = peer.ip.split('.').map(part => parseInt(part));
      
      // 4 bytes for IP
      compactBuffer[offset] = ipParts[0];
      compactBuffer[offset + 1] = ipParts[1];
      compactBuffer[offset + 2] = ipParts[2];
      compactBuffer[offset + 3] = ipParts[3];
      
      // 2 bytes for port
      compactBuffer.writeUInt16BE(peer.port, offset + 4);
      
      offset += 6;
    }

    return compactBuffer;
  }

  /**
   * Parse compact peer info
   */
  static parseCompactPeerInfo(buffer) {
    const peers = [];
    
    for (let offset = 0; offset < buffer.length; offset += 6) {
      if (offset + 6 <= buffer.length) {
        const ip = [
          buffer[offset],
          buffer[offset + 1],
          buffer[offset + 2],
          buffer[offset + 3]
        ].join('.');
        
        const port = buffer.readUInt16BE(offset + 4);
        
        peers.push({ ip, port });
      }
    }

    return peers;
  }

  /**
   * Create UDP hole punching payload
   */
  static createHolePunchingPayload(peerId, sessionId) {
    const payload = Buffer.allocUnsafe(64);
    
    // Magic bytes for identification
    payload.writeUInt32BE(0xDEADBEEF, 0);
    
    // Timestamp
    payload.writeBigUInt64BE(BigInt(Date.now()), 4);
    
    // Peer ID (20 bytes)
    Buffer.from(peerId).copy(payload, 12, 0, 20);
    
    // Session ID (20 bytes)
    Buffer.from(sessionId).copy(payload, 32, 0, 20);
    
    // Checksum
    let checksum = 0;
    for (let i = 0; i < 52; i++) {
      checksum ^= payload[i];
    }
    payload.writeUInt32BE(checksum, 52);
    
    return payload;
  }

  /**
   * Validate hole punching payload
   */
  static validateHolePunchingPayload(buffer) {
    if (buffer.length !== 64) return null;
    
    // Check magic bytes
    if (buffer.readUInt32BE(0) !== 0xDEADBEEF) return null;
    
    // Verify checksum
    let checksum = 0;
    for (let i = 0; i < 52; i++) {
      checksum ^= buffer[i];
    }
    
    if (buffer.readUInt32BE(52) !== checksum) return null;
    
    return {
      timestamp: Number(buffer.readBigUInt64BE(4)),
      peerId: buffer.subarray(12, 32).toString(),
      sessionId: buffer.subarray(32, 52).toString()
    };
  }

  /**
   * Perform UDP hole punching
   */
  static async performHolePunching(localPort, remoteHost, remotePort, peerId, sessionId) {
    return new Promise((resolve, reject) => {
      const socket = createSocket('udp4');
      let attempts = 0;
      const maxAttempts = 10;
      const interval = 1000; // 1 second between attempts
      
      const payload = this.createHolePunchingPayload(peerId, sessionId);
      let timer;

      socket.on('message', (message, remote) => {
        const validated = this.validateHolePunchingPayload(message);
        if (validated && remote.address === remoteHost && remote.port === remotePort) {
          clearInterval(timer);
          socket.close();
          resolve(true);
        }
      });

      socket.on('error', (error) => {
        clearInterval(timer);
        socket.close();
        reject(error);
      });

      socket.bind(localPort, () => {
        timer = setInterval(() => {
          if (attempts >= maxAttempts) {
            clearInterval(timer);
            socket.close();
            resolve(false);
            return;
          }

          socket.send(payload, remotePort, remoteHost, (error) => {
            if (error) {
              console.warn(`Hole punching attempt ${attempts + 1} failed:`, error.message);
            }
          });

          attempts++;
        }, interval);
      });
    });
  }
}

export default NetworkUtils;