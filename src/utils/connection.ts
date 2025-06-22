import { SignalingServer } from './signaling';

export class ConnectionManager {
  private connections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private localStream: MediaStream | null = null;
  private signaling: SignalingServer;
  private onConnectionChange?: (id: string, status: string) => void;
  private onRemoteStream?: (stream: MediaStream) => void;
  private onControlMessage?: (message: any) => void;
  private onDataMessage?: (message: any) => void;
  private connectionId: string;
  private isControlEnabled = false;
  private screenDimensions = { width: 1920, height: 1080 };

  constructor() {
    this.connectionId = this.generateId();
    this.signaling = new SignalingServer(this.connectionId);
    this.setupSignalingHandlers();
    this.detectScreenDimensions();
  }

  private detectScreenDimensions() {
    this.screenDimensions = {
      width: screen.width,
      height: screen.height
    };
  }

  private setupSignalingHandlers() {
    this.signaling.onMessage('offer', this.handleOffer.bind(this));
    this.signaling.onMessage('answer', this.handleAnswer.bind(this));
    this.signaling.onMessage('ice-candidate', this.handleIceCandidate.bind(this));
    this.signaling.onMessage('connect', this.handleConnectRequest.bind(this));
    this.signaling.onMessage('disconnect', this.handleDisconnect.bind(this));
  }

  private async handleOffer(message: any) {
    const { data, from } = message;
    let connection = this.connections.get(from);
    
    if (!connection) {
      connection = await this.createPeerConnection(from, false);
    }

    await connection.setRemoteDescription(data);
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    
    this.signaling.sendMessage('answer', answer, from);
  }

  private async handleAnswer(message: any) {
    const { data, from } = message;
    const connection = this.connections.get(from);
    
    if (connection) {
      await connection.setRemoteDescription(data);
    }
  }

  private async handleIceCandidate(message: any) {
    const { data, from } = message;
    const connection = this.connections.get(from);
    
    if (connection && data) {
      await connection.addIceCandidate(data);
    }
  }

  private handleConnectRequest(message: any) {
    const { from } = message;
    // Auto-accept connection requests for demo
    this.createConnection(from, false);
  }

  private handleDisconnect(message: any) {
    const { from } = message;
    this.disconnect(from);
  }

  private async createPeerConnection(remoteId: string, isInitiator: boolean): Promise<RTCPeerConnection> {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };

    const connection = new RTCPeerConnection(configuration);
    this.connections.set(remoteId, connection);

    // Handle ICE candidates
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendMessage('ice-candidate', event.candidate, remoteId);
      }
    };

    // Handle remote stream
    connection.ontrack = (event) => {
      if (this.onRemoteStream) {
        this.onRemoteStream(event.streams[0]);
      }
    };

    // Handle connection state changes
    connection.onconnectionstatechange = () => {
      if (this.onConnectionChange) {
        this.onConnectionChange(remoteId, connection.connectionState);
      }
      
      if (connection.connectionState === 'failed' || connection.connectionState === 'disconnected') {
        this.disconnect(remoteId);
      }
    };

    // Create data channel for control messages
    if (isInitiator) {
      const dataChannel = connection.createDataChannel('control', {
        ordered: true
      });
      this.setupDataChannel(dataChannel, remoteId);
    } else {
      connection.ondatachannel = (event) => {
        this.setupDataChannel(event.channel, remoteId);
      };
    }

    return connection;
  }

  private setupDataChannel(dataChannel: RTCDataChannel, remoteId: string) {
    this.dataChannels.set(remoteId, dataChannel);

    dataChannel.onopen = () => {
      console.log('Data channel opened with', remoteId);
    };

    dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleDataChannelMessage(message, remoteId);
      } catch (error) {
        console.error('Failed to parse data channel message:', error);
      }
    };

    dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
    };
  }

  private handleDataChannelMessage(message: any, from: string) {
    switch (message.type) {
      case 'mouse':
        this.handleMouseControl(message.data);
        break;
      case 'keyboard':
        this.handleKeyboardControl(message.data);
        break;
      case 'control':
        if (this.onControlMessage) {
          this.onControlMessage({ ...message, from });
        }
        break;
      default:
        if (this.onDataMessage) {
          this.onDataMessage({ ...message, from });
        }
    }
  }

  private handleMouseControl(data: any) {
    if (!this.isControlEnabled) return;

    // Simulate mouse events (limited by browser security)
    const { type, x, y, button, deltaX, deltaY } = data;
    
    // Convert relative coordinates to absolute
    const absoluteX = (x / 100) * this.screenDimensions.width;
    const absoluteY = (y / 100) * this.screenDimensions.height;

    // In a real implementation, this would control the actual mouse
    // For demo purposes, we'll just log the events
    console.log(`Mouse ${type} at (${absoluteX}, ${absoluteY})`, { button, deltaX, deltaY });
    
    // Dispatch custom events for demonstration
    const event = new CustomEvent('remoteMouseControl', {
      detail: { type, x: absoluteX, y: absoluteY, button, deltaX, deltaY }
    });
    window.dispatchEvent(event);
  }

  private handleKeyboardControl(data: any) {
    if (!this.isControlEnabled) return;

    const { type, key, code, ctrlKey, altKey, shiftKey, metaKey } = data;
    
    // In a real implementation, this would control the actual keyboard
    // For demo purposes, we'll just log the events
    console.log(`Keyboard ${type}: ${key} (${code})`, { ctrlKey, altKey, shiftKey, metaKey });
    
    // Dispatch custom events for demonstration
    const event = new CustomEvent('remoteKeyboardControl', {
      detail: { type, key, code, ctrlKey, altKey, shiftKey, metaKey }
    });
    window.dispatchEvent(event);
  }

  generateId(): string {
    return Math.random().toString(36).substr(2, 9).toUpperCase();
  }

  getId(): string {
    return this.connectionId;
  }

  async startScreenShare(): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen',
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 60 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      // Handle stream end
      this.localStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare();
      };

      return this.localStream;
    } catch (error) {
      throw new Error('Failed to start screen sharing: ' + (error as Error).message);
    }
  }

  stopScreenShare() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  async createConnection(remoteId: string, isHost: boolean): Promise<void> {
    try {
      const connection = await this.createPeerConnection(remoteId, isHost);

      if (isHost && this.localStream) {
        // Add local stream tracks
        this.localStream.getTracks().forEach(track => {
          connection.addTrack(track, this.localStream!);
        });

        // Create and send offer
        const offer = await connection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await connection.setLocalDescription(offer);
        
        this.signaling.sendMessage('offer', offer, remoteId);
      } else if (!isHost) {
        // Send connection request
        this.signaling.sendMessage('connect', { requestControl: false }, remoteId);
      }

      // Update connection status
      if (this.onConnectionChange) {
        this.onConnectionChange(remoteId, 'connecting');
      }

    } catch (error) {
      console.error('Failed to create connection:', error);
      if (this.onConnectionChange) {
        this.onConnectionChange(remoteId, 'error');
      }
      throw error;
    }
  }

  sendMouseEvent(remoteId: string, event: any) {
    const dataChannel = this.dataChannels.get(remoteId);
    if (dataChannel && dataChannel.readyState === 'open') {
      const message = {
        type: 'mouse',
        data: event,
        timestamp: Date.now()
      };
      dataChannel.send(JSON.stringify(message));
    }
  }

  sendKeyboardEvent(remoteId: string, event: any) {
    const dataChannel = this.dataChannels.get(remoteId);
    if (dataChannel && dataChannel.readyState === 'open') {
      const message = {
        type: 'keyboard',
        data: event,
        timestamp: Date.now()
      };
      dataChannel.send(JSON.stringify(message));
    }
  }

  sendControlMessage(remoteId: string, message: any) {
    const dataChannel = this.dataChannels.get(remoteId);
    if (dataChannel && dataChannel.readyState === 'open') {
      const controlMessage = {
        type: 'control',
        data: message,
        timestamp: Date.now()
      };
      dataChannel.send(JSON.stringify(controlMessage));
    }
  }

  enableControl(enabled: boolean) {
    this.isControlEnabled = enabled;
  }

  isControlActive(): boolean {
    return this.isControlEnabled;
  }

  setConnectionChangeHandler(handler: (id: string, status: string) => void) {
    this.onConnectionChange = handler;
  }

  setRemoteStreamHandler(handler: (stream: MediaStream) => void) {
    this.onRemoteStream = handler;
  }

  setControlMessageHandler(handler: (message: any) => void) {
    this.onControlMessage = handler;
  }

  setDataMessageHandler(handler: (message: any) => void) {
    this.onDataMessage = handler;
  }

  getConnectionStats(remoteId: string): Promise<RTCStatsReport | null> {
    const connection = this.connections.get(remoteId);
    if (connection) {
      return connection.getStats();
    }
    return Promise.resolve(null);
  }

  disconnect(remoteId: string) {
    // Send disconnect message
    this.signaling.sendMessage('disconnect', {}, remoteId);

    // Close data channel
    const dataChannel = this.dataChannels.get(remoteId);
    if (dataChannel) {
      dataChannel.close();
      this.dataChannels.delete(remoteId);
    }

    // Close peer connection
    const connection = this.connections.get(remoteId);
    if (connection) {
      connection.close();
      this.connections.delete(remoteId);
    }

    // Update status
    if (this.onConnectionChange) {
      this.onConnectionChange(remoteId, 'disconnected');
    }
  }

  disconnectAll() {
    this.connections.forEach((_, remoteId) => {
      this.disconnect(remoteId);
    });
    
    this.stopScreenShare();
    this.signaling.cleanup();
  }

  // Get list of active connections
  getActiveConnections(): string[] {
    return Array.from(this.connections.keys());
  }

  // Check if connection exists
  hasConnection(remoteId: string): boolean {
    return this.connections.has(remoteId);
  }
}