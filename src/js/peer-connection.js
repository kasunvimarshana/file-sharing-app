/**
 * WebRTC Peer Connection Manager
 * Handles P2P connections, data channels, and NAT traversal
 * Integrates with custom STUN/TURN servers for connection establishment
 */

export class PeerConnectionManager {
  constructor(localPeerId, signalingSocket, stunServers = [], turnServers = []) {
    this.localPeerId = localPeerId;
    this.signalingSocket = signalingSocket;
    this.connections = new Map(); // peerId -> RTCPeerConnection
    this.dataChannels = new Map(); // peerId -> RTCDataChannel
    this.connectionStates = new Map(); // peerId -> connection state
    
    // ICE servers configuration
    this.iceServers = [
      // Custom STUN servers
      ...stunServers.map(server => ({ urls: `stun:${server}` })),
      // Custom TURN servers
      ...turnServers.map(server => ({
        urls: `turn:${server}`,
        username: 'user',
        credential: 'pass'
      })),
      // Fallback public STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];

    this.rtcConfig = {
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };

    // Event callbacks
    this.onConnectionStateChange = null;
    this.onDataChannelMessage = null;
    this.onDataChannelOpen = null;
    this.onDataChannelClose = null;
    this.onError = null;

    this.setupSignalingHandlers();
  }

  /**
   * Setup signaling message handlers
   */
  setupSignalingHandlers() {
    this.signalingSocket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleSignalingMessage(message);
      } catch (error) {
        this.emitError('Failed to parse signaling message', error);
      }
    });
  }

  /**
   * Handle incoming signaling messages
   */
  async handleSignalingMessage(message) {
    try {
      switch (message.type) {
        case 'offer':
          await this.handleOffer(message);
          break;
        
        case 'answer':
          await this.handleAnswer(message);
          break;
        
        case 'ice-candidate':
          await this.handleIceCandidate(message);
          break;
        
        default:
          // Not a WebRTC signaling message
          break;
      }
    } catch (error) {
      this.emitError(`Error handling signaling message: ${message.type}`, error);
    }
  }

  /**
   * Create peer connection
   */
  createPeerConnection(peerId, isInitiator = false) {
    try {
      const pc = new RTCPeerConnection(this.rtcConfig);
      
      // Set up event handlers
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignalingMessage({
            type: 'ice-candidate',
            targetPeerId: peerId,
            candidate: event.candidate
          });
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        this.connectionStates.set(peerId, state);
        this.emitConnectionStateChange(peerId, state);
        
        if (state === 'failed' || state === 'closed') {
          this.cleanupPeerConnection(peerId);
        }
      };

      pc.ondatachannel = (event) => {
        this.setupDataChannel(peerId, event.channel);
      };

      this.connections.set(peerId, pc);
      
      // Create data channel if initiator
      if (isInitiator) {
        const dataChannel = pc.createDataChannel('file-transfer', {
          ordered: true,
          maxRetransmits: 3
        });
        this.setupDataChannel(peerId, dataChannel);
      }

      return pc;
    } catch (error) {
      this.emitError('Failed to create peer connection', error);
      return null;
    }
  }

  /**
   * Setup data channel
   */
  setupDataChannel(peerId, dataChannel) {
    dataChannel.onopen = () => {
      console.log(`Data channel opened with peer ${peerId}`);
      this.emitDataChannelOpen(peerId);
    };

    dataChannel.onclose = () => {
      console.log(`Data channel closed with peer ${peerId}`);
      this.dataChannels.delete(peerId);
      this.emitDataChannelClose(peerId);
    };

    dataChannel.onmessage = (event) => {
      this.handleDataChannelMessage(peerId, event.data);
    };

    dataChannel.onerror = (error) => {
      this.emitError(`Data channel error with peer ${peerId}`, error);
    };

    this.dataChannels.set(peerId, dataChannel);
  }

  /**
   * Connect to peer
   */
  async connectToPeer(peerId) {
    try {
      if (this.connections.has(peerId)) {
        console.warn(`Already connected to peer ${peerId}`);
        return;
      }

      const pc = this.createPeerConnection(peerId, true);
      if (!pc) return;

      // Create offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });

      await pc.setLocalDescription(offer);

      // Send offer through signaling
      this.sendSignalingMessage({
        type: 'offer',
        targetPeerId: peerId,
        offer: offer
      });

      console.log(`Sent offer to peer ${peerId}`);
    } catch (error) {
      this.emitError(`Failed to connect to peer ${peerId}`, error);
    }
  }

  /**
   * Handle incoming offer
   */
  async handleOffer(message) {
    try {
      const { fromPeerId, offer } = message;
      
      if (this.connections.has(fromPeerId)) {
        console.warn(`Already connected to peer ${fromPeerId}`);
        return;
      }

      const pc = this.createPeerConnection(fromPeerId, false);
      if (!pc) return;

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send answer through signaling
      this.sendSignalingMessage({
        type: 'answer',
        targetPeerId: fromPeerId,
        answer: answer
      });

      console.log(`Sent answer to peer ${fromPeerId}`);
    } catch (error) {
      this.emitError(`Failed to handle offer from ${message.fromPeerId}`, error);
    }
  }

  /**
   * Handle incoming answer
   */
  async handleAnswer(message) {
    try {
      const { fromPeerId, answer } = message;
      const pc = this.connections.get(fromPeerId);

      if (!pc) {
        console.warn(`No peer connection found for ${fromPeerId}`);
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log(`Received answer from peer ${fromPeerId}`);
    } catch (error) {
      this.emitError(`Failed to handle answer from ${message.fromPeerId}`, error);
    }
  }

  /**
   * Handle incoming ICE candidate
   */
  async handleIceCandidate(message) {
    try {
      const { fromPeerId, candidate } = message;
      const pc = this.connections.get(fromPeerId);

      if (!pc) {
        console.warn(`No peer connection found for ${fromPeerId}`);
        return;
      }

      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log(`Added ICE candidate from peer ${fromPeerId}`);
    } catch (error) {
      this.emitError(`Failed to handle ICE candidate from ${message.fromPeerId}`, error);
    }
  }

  /**
   * Handle data channel messages
   */
  handleDataChannelMessage(peerId, data) {
    try {
      // Try to parse as JSON first
      let message;
      if (typeof data === 'string') {
        try {
          message = JSON.parse(data);
        } catch {
          message = { type: 'text', data: data };
        }
      } else {
        // Binary data (file chunks)
        message = { type: 'binary', data: data };
      }

      this.emitDataChannelMessage(peerId, message);
    } catch (error) {
      this.emitError(`Failed to handle data channel message from ${peerId}`, error);
    }
  }

  /**
   * Send message to peer via data channel
   */
  sendToPeer(peerId, message) {
    try {
      const dataChannel = this.dataChannels.get(peerId);
      
      if (!dataChannel || dataChannel.readyState !== 'open') {
        throw new Error(`Data channel not available for peer ${peerId}`);
      }

      const data = typeof message === 'string' ? message : JSON.stringify(message);
      dataChannel.send(data);
      
      return true;
    } catch (error) {
      this.emitError(`Failed to send message to peer ${peerId}`, error);
      return false;
    }
  }

  /**
   * Send binary data to peer
   */
  sendBinaryToPeer(peerId, data) {
    try {
      const dataChannel = this.dataChannels.get(peerId);
      
      if (!dataChannel || dataChannel.readyState !== 'open') {
        throw new Error(`Data channel not available for peer ${peerId}`);
      }

      dataChannel.send(data);
      return true;
    } catch (error) {
      this.emitError(`Failed to send binary data to peer ${peerId}`, error);
      return false;
    }
  }

  /**
   * Disconnect from peer
   */
  disconnectFromPeer(peerId) {
    try {
      this.cleanupPeerConnection(peerId);
      console.log(`Disconnected from peer ${peerId}`);
    } catch (error) {
      this.emitError(`Failed to disconnect from peer ${peerId}`, error);
    }
  }

  /**
   * Cleanup peer connection
   */
  cleanupPeerConnection(peerId) {
    // Close data channel
    const dataChannel = this.dataChannels.get(peerId);
    if (dataChannel) {
      dataChannel.close();
      this.dataChannels.delete(peerId);
    }

    // Close peer connection
    const pc = this.connections.get(peerId);
    if (pc) {
      pc.close();
      this.connections.delete(peerId);
    }

    // Remove connection state
    this.connectionStates.delete(peerId);
  }

  /**
   * Get connection state for peer
   */
  getConnectionState(peerId) {
    return this.connectionStates.get(peerId) || 'disconnected';
  }

  /**
   * Get all connected peers
   */
  getConnectedPeers() {
    const connectedPeers = [];
    
    for (const [peerId, state] of this.connectionStates.entries()) {
      if (state === 'connected') {
        connectedPeers.push(peerId);
      }
    }

    return connectedPeers;
  }

  /**
   * Send signaling message
   */
  sendSignalingMessage(message) {
    if (this.signalingSocket.readyState === WebSocket.OPEN) {
      this.signalingSocket.send(JSON.stringify(message));
    } else {
      this.emitError('Signaling socket not connected', new Error('WebSocket not open'));
    }
  }

  /**
   * Event emitters
   */
  emitConnectionStateChange(peerId, state) {
    if (this.onConnectionStateChange) {
      this.onConnectionStateChange(peerId, state);
    }
  }

  emitDataChannelMessage(peerId, message) {
    if (this.onDataChannelMessage) {
      this.onDataChannelMessage(peerId, message);
    }
  }

  emitDataChannelOpen(peerId) {
    if (this.onDataChannelOpen) {
      this.onDataChannelOpen(peerId);
    }
  }

  emitDataChannelClose(peerId) {
    if (this.onDataChannelClose) {
      this.onDataChannelClose(peerId);
    }
  }

  emitError(message, error) {
    console.error(message, error);
    if (this.onError) {
      this.onError(message, error);
    }
  }

  /**
   * Cleanup all connections
   */
  destroy() {
    // Disconnect from all peers
    for (const peerId of this.connections.keys()) {
      this.cleanupPeerConnection(peerId);
    }

    // Clear all maps
    this.connections.clear();
    this.dataChannels.clear();
    this.connectionStates.clear();
  }
}

export default PeerConnectionManager;