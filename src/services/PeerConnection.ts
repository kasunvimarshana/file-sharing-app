import type { Peer, TorrentFile, Piece, Block } from '../types/torrent';

interface PeerConnectionConfig {
  iceServers: RTCIceServer[];
  connectionTimeout: number;
  maxConcurrentConnections: number;
}

export class PeerConnectionManager {
  private connections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private signalingSocket: WebSocket | null = null;
  private torrent: TorrentFile | null = null;
  private peerId: string;
  private config: PeerConnectionConfig;
  
  // Callbacks
  private onPeerConnected?: (peer: Peer) => void;
  private onPeerDisconnected?: (peerId: string) => void;
  private onPieceReceived?: (piece: Piece) => void;
  private onPeerMessage?: (peerId: string, message: any) => void;

  // Connection management
  private connectionAttempts: Map<string, number> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isDestroyed = false;

  constructor(config?: Partial<PeerConnectionConfig>) {
    this.peerId = this.generatePeerId();
    this.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ],
      connectionTimeout: 30000, // 30 seconds
      maxConcurrentConnections: 50,
      ...config
    };
    
    this.connectToSignalingServer();
    this.startHeartbeat();
  }

  private generatePeerId(): string {
    // Generate a unique peer ID for this session
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '-P2P1000-'; // Client identifier
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  setTorrent(torrent: TorrentFile) {
    this.torrent = torrent;
  }

  setPeerConnectedCallback(callback: (peer: Peer) => void) {
    this.onPeerConnected = callback;
  }

  setPeerDisconnectedCallback(callback: (peerId: string) => void) {
    this.onPeerDisconnected = callback;
  }

  setPieceReceivedCallback(callback: (piece: Piece) => void) {
    this.onPieceReceived = callback;
  }

  setPeerMessageCallback(callback: (peerId: string, message: any) => void) {
    this.onPeerMessage = callback;
  }

  private connectToSignalingServer() {
    if (this.isDestroyed) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    try {
      this.signalingSocket = new WebSocket(`${protocol}//${host}/ws`);

      this.signalingSocket.onopen = () => {
        console.log('Connected to signaling server');
        this.connectionAttempts.clear();
      };

      this.signalingSocket.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          await this.handleSignalingMessage(message);
        } catch (error) {
          console.error('Failed to handle signaling message:', error);
        }
      };

      this.signalingSocket.onclose = (event) => {
        console.log('Disconnected from signaling server:', event.code, event.reason);
        this.signalingSocket = null;
        
        // Attempt to reconnect after delay if not destroyed
        if (!this.isDestroyed) {
          setTimeout(() => {
            if (!this.signalingSocket && !this.isDestroyed) {
              this.connectToSignalingServer();
            }
          }, 5000);
        }
      };

      this.signalingSocket.onerror = (error) => {
        console.error('Signaling server error:', error);
      };
    } catch (error) {
      console.error('Failed to connect to signaling server:', error);
      if (!this.isDestroyed) {
        setTimeout(() => this.connectToSignalingServer(), 5000);
      }
    }
  }

  private async handleSignalingMessage(message: any) {
    const { type, from, to, data } = message;

    if (to && to !== this.peerId) {
      return; // Message not for us
    }

    try {
      switch (type) {
        case 'offer':
          await this.handleOffer(from, data);
          break;
        case 'answer':
          await this.handleAnswer(from, data);
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(from, data);
          break;
        case 'peer-list':
          await this.handlePeerList(data.peers);
          break;
        case 'peer-joined':
          await this.handlePeerJoined(data.peerId);
          break;
        case 'peer-left':
          this.handlePeerLeft(data.peerId);
          break;
        case 'pong':
          // Handle heartbeat response
          break;
        case 'error':
          console.error('Signaling error:', data);
          break;
      }
    } catch (error) {
      console.error('Error handling signaling message:', error);
    }
  }

  private async handleOffer(peerId: string, offer: RTCSessionDescriptionInit) {
    if (this.connections.has(peerId)) return;

    const connection = this.createPeerConnection(peerId);
    
    try {
      await connection.setRemoteDescription(offer);
      
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      
      this.sendSignalingMessage({
        type: 'answer',
        from: this.peerId,
        to: peerId,
        data: answer
      });
    } catch (error) {
      console.error('Failed to handle offer from', peerId, error);
      this.cleanupConnection(peerId);
    }
  }

  private async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit) {
    const connection = this.connections.get(peerId);
    if (connection) {
      try {
        await connection.setRemoteDescription(answer);
      } catch (error) {
        console.error('Failed to handle answer from', peerId, error);
        this.cleanupConnection(peerId);
      }
    }
  }

  private async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit) {
    const connection = this.connections.get(peerId);
    if (connection && connection.remoteDescription) {
      try {
        await connection.addIceCandidate(candidate);
      } catch (error) {
        console.error('Failed to add ICE candidate from', peerId, error);
      }
    }
  }

  private async handlePeerList(peers: string[]) {
    // Limit concurrent connections
    const availableSlots = this.config.maxConcurrentConnections - this.connections.size;
    const peersToConnect = peers
      .filter(peerId => peerId !== this.peerId && !this.connections.has(peerId))
      .slice(0, availableSlots);

    for (const peerId of peersToConnect) {
      await this.connectToPeer(peerId);
      // Add small delay between connections to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private async handlePeerJoined(peerId: string) {
    if (peerId !== this.peerId && !this.connections.has(peerId)) {
      // Small delay to allow the new peer to settle
      setTimeout(() => this.connectToPeer(peerId), 1000);
    }
  }

  private handlePeerLeft(peerId: string) {
    this.cleanupConnection(peerId);
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const connection = new RTCPeerConnection({
      iceServers: this.config.iceServers,
      iceCandidatePoolSize: 10
    });

    // Set up connection timeout
    const timeout = setTimeout(() => {
      if (connection.connectionState !== 'connected') {
        console.log('Connection timeout for peer', peerId);
        this.cleanupConnection(peerId);
      }
    }, this.config.connectionTimeout);

    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: 'ice-candidate',
          from: this.peerId,
          to: peerId,
          data: event.candidate
        });
      }
    };

    connection.ondatachannel = (event) => {
      const channel = event.channel;
      this.setupDataChannel(peerId, channel);
    };

    connection.onconnectionstatechange = () => {
      const state = connection.connectionState;
      console.log(`Connection state with ${peerId}: ${state}`);
      
      switch (state) {
        case 'connected':
          clearTimeout(timeout);
          this.connectionAttempts.delete(peerId);
          this.handlePeerConnection(peerId);
          break;
        case 'disconnected':
          this.scheduleReconnect(peerId);
          break;
        case 'failed':
        case 'closed':
          clearTimeout(timeout);
          this.handlePeerDisconnection(peerId);
          break;
      }
    };

    connection.oniceconnectionstatechange = () => {
      const state = connection.iceConnectionState;
      if (state === 'failed' || state === 'disconnected') {
        console.log(`ICE connection state with ${peerId}: ${state}`);
      }
    };

    this.connections.set(peerId, connection);
    return connection;
  }

  private setupDataChannel(peerId: string, channel: RTCDataChannel) {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      console.log(`Data channel opened with ${peerId}`);
      this.dataChannels.set(peerId, channel);
      
      // Send initial handshake
      if (this.torrent) {
        this.sendToPeer(peerId, {
          type: 'handshake',
          infoHash: this.torrent.infoHash,
          peerId: this.peerId,
          protocol: 'BitTorrent protocol'
        });
      }
    };

    channel.onmessage = (event) => {
      this.handlePeerMessage(peerId, event.data);
    };

    channel.onclose = () => {
      console.log(`Data channel closed with ${peerId}`);
      this.dataChannels.delete(peerId);
    };

    channel.onerror = (error) => {
      console.error(`Data channel error with ${peerId}:`, error);
    };
  }

  private handlePeerMessage(peerId: string, data: string | ArrayBuffer) {
    try {
      if (typeof data === 'string') {
        const message = JSON.parse(data);
        this.handleProtocolMessage(peerId, message);
      } else {
        // Binary data - handle piece data
        this.handleBinaryData(peerId, new Uint8Array(data));
      }
    } catch (error) {
      console.error('Failed to handle peer message from', peerId, error);
    }
  }

  private handleProtocolMessage(peerId: string, message: any) {
    if (this.onPeerMessage) {
      this.onPeerMessage(peerId, message);
    }

    switch (message.type) {
      case 'handshake':
        this.handleHandshake(peerId, message);
        break;
      case 'request':
        this.handlePieceRequest(peerId, message);
        break;
      case 'have':
        this.handleHaveMessage(peerId, message);
        break;
      case 'bitfield':
        this.handleBitfield(peerId, message);
        break;
      case 'interested':
        this.handleInterested(peerId);
        break;
      case 'not-interested':
        this.handleNotInterested(peerId);
        break;
      case 'choke':
        this.handleChoke(peerId);
        break;
      case 'unchoke':
        this.handleUnchoke(peerId);
        break;
      case 'piece':
        this.handlePieceMessage(peerId, message);
        break;
    }
  }

  private handleHandshake(peerId: string, message: any) {
    if (this.torrent && message.infoHash === this.torrent.infoHash) {
      console.log(`Handshake successful with ${peerId}`);
      
      // Send our bitfield
      this.sendToPeer(peerId, {
        type: 'bitfield',
        bitfield: Array.from(this.getBitfield())
      });
    } else {
      console.log(`Handshake failed with ${peerId}: info hash mismatch`);
      this.cleanupConnection(peerId);
    }
  }

  private handlePieceRequest(peerId: string, message: any) {
    const { index, offset, length } = message;
    console.log(`Peer ${peerId} requested piece ${index}, offset ${offset}, length ${length}`);
    
    // Forward to torrent engine via callback
    if (this.onPeerMessage) {
      this.onPeerMessage(peerId, {
        type: 'request',
        infoHash: this.torrent?.infoHash,
        pieceIndex: index,
        offset,
        length
      });
    }
  }

  private handlePieceMessage(peerId: string, message: any) {
    console.log(`Received piece data from ${peerId}: piece ${message.pieceIndex}`);
    
    // Forward to torrent engine
    if (this.onPeerMessage) {
      this.onPeerMessage(peerId, message);
    }
  }

  private handleHaveMessage(peerId: string, message: any) {
    console.log(`Peer ${peerId} has piece ${message.pieceIndex}`);
    
    if (this.onPeerMessage) {
      this.onPeerMessage(peerId, message);
    }
  }

  private handleBitfield(peerId: string, message: any) {
    console.log(`Received bitfield from ${peerId}`);
    
    if (this.onPeerMessage) {
      this.onPeerMessage(peerId, message);
    }
  }

  private handleInterested(peerId: string) {
    console.log(`Peer ${peerId} is interested`);
  }

  private handleNotInterested(peerId: string) {
    console.log(`Peer ${peerId} is not interested`);
  }

  private handleChoke(peerId: string) {
    console.log(`Peer ${peerId} choked us`);
  }

  private handleUnchoke(peerId: string) {
    console.log(`Peer ${peerId} unchoked us`);
  }

  private handleBinaryData(peerId: string, data: Uint8Array) {
    // Handle piece data
    console.log(`Received ${data.length} bytes from ${peerId}`);
    
    // TODO: Parse and validate piece data
    // This would involve reconstructing pieces from blocks
  }

  async connectToPeer(peerId: string) {
    if (this.connections.has(peerId) || peerId === this.peerId || this.isDestroyed) {
      return;
    }

    // Check connection attempts
    const attempts = this.connectionAttempts.get(peerId) || 0;
    if (attempts >= 3) {
      console.log(`Max connection attempts reached for ${peerId}`);
      return;
    }

    this.connectionAttempts.set(peerId, attempts + 1);

    try {
      const connection = this.createPeerConnection(peerId);
      const dataChannel = connection.createDataChannel('torrent', {
        ordered: true,
        maxRetransmits: 3
      });
      
      this.setupDataChannel(peerId, dataChannel);

      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);

      this.sendSignalingMessage({
        type: 'offer',
        from: this.peerId,
        to: peerId,
        data: offer
      });
    } catch (error) {
      console.error('Failed to connect to peer', peerId, error);
      this.cleanupConnection(peerId);
    }
  }

  private handlePeerConnection(peerId: string) {
    // Create a serializable peer object without RTCPeerConnection and RTCDataChannel
    const peer: Peer = {
      id: peerId,
      ip: 'webrtc',
      port: 0,
      connected: true,
      uploaded: 0,
      downloaded: 0,
      lastSeen: Date.now()
    };

    if (this.onPeerConnected) {
      this.onPeerConnected(peer);
    }
  }

  private handlePeerDisconnection(peerId: string) {
    this.cleanupConnection(peerId);
    
    if (this.onPeerDisconnected) {
      this.onPeerDisconnected(peerId);
    }
  }

  private scheduleReconnect(peerId: string) {
    // Don't reconnect immediately, schedule for later
    if (this.reconnectTimers.has(peerId) || this.isDestroyed) {
      return;
    }

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(peerId);
      if (!this.connections.has(peerId) && !this.isDestroyed) {
        this.connectToPeer(peerId);
      }
    }, 10000); // 10 seconds

    this.reconnectTimers.set(peerId, timer);
  }

  private cleanupConnection(peerId: string) {
    const connection = this.connections.get(peerId);
    if (connection) {
      connection.close();
      this.connections.delete(peerId);
    }

    this.dataChannels.delete(peerId);
    
    const timer = this.reconnectTimers.get(peerId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(peerId);
    }
  }

  sendToPeer(peerId: string, message: any) {
    const channel = this.dataChannels.get(peerId);
    if (channel && channel.readyState === 'open') {
      try {
        channel.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send message to peer', peerId, error);
      }
    }
  }

  sendBinaryToPeer(peerId: string, data: Uint8Array) {
    const channel = this.dataChannels.get(peerId);
    if (channel && channel.readyState === 'open') {
      try {
        channel.send(data);
      } catch (error) {
        console.error('Failed to send binary data to peer', peerId, error);
      }
    }
  }

  requestPiece(peerId: string, pieceIndex: number, offset: number, length: number) {
    this.sendToPeer(peerId, {
      type: 'request',
      index: pieceIndex,
      offset,
      length
    });
  }

  private sendSignalingMessage(message: any) {
    if (this.signalingSocket && this.signalingSocket.readyState === WebSocket.OPEN) {
      try {
        this.signalingSocket.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send signaling message:', error);
      }
    }
  }

  private getBitfield(): Uint8Array {
    // TODO: Return actual bitfield based on downloaded pieces
    return new Uint8Array(0);
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.signalingSocket && this.signalingSocket.readyState === WebSocket.OPEN && !this.isDestroyed) {
        this.sendSignalingMessage({ type: 'ping', from: this.peerId });
      }
    }, 30000); // 30 seconds
  }

  joinSwarm(infoHash: string) {
    this.sendSignalingMessage({
      type: 'join-swarm',
      infoHash,
      peerId: this.peerId
    });
  }

  leaveSwarm(infoHash: string) {
    this.sendSignalingMessage({
      type: 'leave-swarm',
      infoHash,
      peerId: this.peerId
    });
  }

  getConnectionStats() {
    return {
      totalConnections: this.connections.size,
      activeDataChannels: this.dataChannels.size,
      connectionAttempts: this.connectionAttempts.size,
      peerId: this.peerId
    };
  }

  disconnect() {
    this.isDestroyed = true;

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Clear all reconnect timers
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    // Close all connections
    for (const [peerId] of this.connections) {
      this.cleanupConnection(peerId);
    }

    // Close signaling socket
    if (this.signalingSocket) {
      this.signalingSocket.close();
      this.signalingSocket = null;
    }

    console.log('PeerConnectionManager disconnected');
  }
}