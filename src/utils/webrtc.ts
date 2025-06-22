export interface PeerConfig {
  iceServers: RTCIceServer[];
  sdpSemantics?: 'plan-b' | 'unified-plan';
}

export interface ConnectionQuality {
  bandwidth: number;
  latency: number;
  packetLoss: number;
  jitter: number;
  fps: number;
  resolution: string;
}

export interface SignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join-room' | 'leave-room' | 'user-joined' | 'user-left';
  sessionId: string;
  peerId: string;
  data?: any;
  timestamp: number;
}

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private onRemoteStreamCallback?: (stream: MediaStream) => void;
  private onDataChannelMessage?: (data: any) => void;
  private onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  private onIceCandidate?: (candidate: RTCIceCandidate) => void;
  private onQualityUpdate?: (quality: ConnectionQuality) => void;
  private qualityInterval?: number;
  private statsHistory: RTCStatsReport[] = [];
  private isHost: boolean = false;

  private config: PeerConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ],
    sdpSemantics: 'unified-plan'
  };

  constructor(config?: Partial<PeerConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  async initializeConnection(isHost: boolean = false): Promise<void> {
    try {
      this.isHost = isHost;
      this.peerConnection = new RTCPeerConnection(this.config);
      
      // Set up event handlers
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.onIceCandidate) {
          this.onIceCandidate(event.candidate);
        }
      };

      this.peerConnection.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
          if (this.onRemoteStreamCallback) {
            this.onRemoteStreamCallback(this.remoteStream);
          }
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        console.log('Connection state changed:', state);
        if (state && this.onConnectionStateChange) {
          this.onConnectionStateChange(state);
        }

        if (state === 'connected') {
          this.startQualityMonitoring();
        } else if (state === 'disconnected' || state === 'failed') {
          this.stopQualityMonitoring();
        }
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
      };

      this.peerConnection.onicegatheringstatechange = () => {
        console.log('ICE gathering state:', this.peerConnection?.iceGatheringState);
      };

      this.peerConnection.ondatachannel = (event) => {
        console.log('Received data channel:', event.channel.label);
        const channel = event.channel;
        this.setupDataChannel(channel);
      };

      // Create data channel if host
      if (isHost) {
        this.dataChannel = this.peerConnection.createDataChannel('control', {
          ordered: true,
          maxRetransmits: 3
        });
        this.setupDataChannel(this.dataChannel);
      }

    } catch (error) {
      console.error('Failed to initialize WebRTC connection:', error);
      throw error;
    }
  }

  private setupDataChannel(channel: RTCDataChannel): void {
    this.dataChannel = channel;

    channel.onopen = () => {
      console.log(`Data channel '${channel.label}' opened`);
    };

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (this.onDataChannelMessage) {
          this.onDataChannelMessage(data);
        }
      } catch (error) {
        console.error('Error parsing data channel message:', error);
      }
    };

    channel.onerror = (error) => {
      console.error('Data channel error:', error);
    };

    channel.onclose = () => {
      console.log(`Data channel '${channel.label}' closed`);
    };
  }

  async startScreenShare(): Promise<MediaStream> {
    try {
      const constraints: DisplayMediaStreamConstraints = {
        video: {
          displaySurface: 'monitor',
          logicalSurface: true,
          cursor: 'always',
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 60 }
        } as any,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      this.localStream = stream;

      // Add tracks to peer connection
      if (this.peerConnection) {
        // Remove existing tracks first
        this.peerConnection.getSenders().forEach(sender => {
          if (sender.track) {
            this.peerConnection!.removeTrack(sender);
          }
        });

        // Add new tracks
        stream.getTracks().forEach(track => {
          console.log('Adding track:', track.kind, track.label);
          this.peerConnection!.addTrack(track, stream);
        });
      }

      // Handle stream end
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('Screen share ended by user');
        this.stopScreenShare();
      });

      return stream;
    } catch (error) {
      console.error('Failed to start screen share:', error);
      throw error;
    }
  }

  stopScreenShare(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      this.localStream = null;
    }

    // Remove tracks from peer connection
    if (this.peerConnection) {
      this.peerConnection.getSenders().forEach(sender => {
        if (sender.track) {
          this.peerConnection!.removeTrack(sender);
        }
      });
    }
  }

  async getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (this.peerConnection) {
        stream.getTracks().forEach(track => {
          this.peerConnection!.addTrack(track, stream);
        });
      }

      return stream;
    } catch (error) {
      console.error('Failed to get user media:', error);
      throw error;
    }
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await this.peerConnection.setLocalDescription(offer);
      console.log('Created and set local offer');
      return offer;
    } catch (error) {
      console.error('Failed to create offer:', error);
      throw error;
    }
  }

  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      await this.peerConnection.setRemoteDescription(offer);
      console.log('Set remote offer');
      
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log('Created and set local answer');
      
      return answer;
    } catch (error) {
      console.error('Failed to create answer:', error);
      throw error;
    }
  }

  async setAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      await this.peerConnection.setRemoteDescription(answer);
      console.log('Set remote answer');
    } catch (error) {
      console.error('Failed to set answer:', error);
      throw error;
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      await this.peerConnection.addIceCandidate(candidate);
      console.log('Added ICE candidate');
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
      // Don't throw here as ICE candidates can fail and that's normal
    }
  }

  sendData(data: any): boolean {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        const message = JSON.stringify({
          ...data,
          timestamp: Date.now()
        });
        this.dataChannel.send(message);
        return true;
      } catch (error) {
        console.error('Failed to send data:', error);
        return false;
      }
    }
    return false;
  }

  private startQualityMonitoring(): void {
    this.qualityInterval = window.setInterval(async () => {
      if (this.peerConnection) {
        try {
          const stats = await this.peerConnection.getStats();
          this.statsHistory.push(stats);
          
          // Keep only last 10 stats reports
          if (this.statsHistory.length > 10) {
            this.statsHistory.shift();
          }
          
          const quality = this.parseConnectionStats(stats);
          if (this.onQualityUpdate) {
            this.onQualityUpdate(quality);
          }
        } catch (error) {
          console.error('Error getting connection stats:', error);
        }
      }
    }, 2000);
  }

  private stopQualityMonitoring(): void {
    if (this.qualityInterval) {
      clearInterval(this.qualityInterval);
      this.qualityInterval = undefined;
    }
  }

  private parseConnectionStats(stats: RTCStatsReport): ConnectionQuality {
    let bandwidth = 0;
    let latency = 0;
    let packetLoss = 0;
    let jitter = 0;
    let fps = 0;
    let resolution = 'Unknown';

    stats.forEach((report) => {
      if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
        // Calculate bandwidth from bytes received
        if (report.bytesReceived && this.statsHistory.length > 1) {
          const prevStats = this.statsHistory[this.statsHistory.length - 2];
          let prevReport: any = null;
          prevStats.forEach(prev => {
            if (prev.id === report.id) {
              prevReport = prev;
            }
          });
          
          if (prevReport && prevReport.bytesReceived) {
            const bytesDiff = report.bytesReceived - prevReport.bytesReceived;
            const timeDiff = (report.timestamp - prevReport.timestamp) / 1000;
            bandwidth = (bytesDiff * 8) / (timeDiff * 1000); // kbps
          }
        }
        
        jitter = report.jitter ? report.jitter * 1000 : 0;
        fps = report.framesPerSecond || 0;
        
        if (report.frameWidth && report.frameHeight) {
          resolution = `${report.frameWidth}x${report.frameHeight}`;
        }
      } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        latency = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : 0;
      } else if (report.type === 'remote-inbound-rtp' && report.mediaType === 'video') {
        if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
          const totalPackets = report.packetsLost + report.packetsReceived;
          packetLoss = totalPackets > 0 ? (report.packetsLost / totalPackets) * 100 : 0;
        }
      }
    });

    return {
      bandwidth: Math.round(bandwidth),
      latency: Math.round(latency),
      packetLoss: Math.round(packetLoss * 100) / 100,
      jitter: Math.round(jitter),
      fps: Math.round(fps),
      resolution
    };
  }

  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  close(): void {
    console.log('Closing WebRTC connection');
    
    this.stopQualityMonitoring();
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.statsHistory = [];
  }

  // Event listeners
  onRemoteStream(callback: (stream: MediaStream) => void): void {
    this.onRemoteStreamCallback = callback;
  }

  onDataMessage(callback: (data: any) => void): void {
    this.onDataChannelMessage = callback;
  }

  onConnectionState(callback: (state: RTCPeerConnectionState) => void): void {
    this.onConnectionStateChange = callback;
  }

  onIceCandidateReceived(callback: (candidate: RTCIceCandidate) => void): void {
    this.onIceCandidate = callback;
  }

  onQualityChanged(callback: (quality: ConnectionQuality) => void): void {
    this.onQualityUpdate = callback;
  }
}

// Enhanced input handling with better precision and performance
export class InputHandler {
  private element: HTMLElement | null = null;
  private onMouseEvent?: (event: MouseInputEvent) => void;
  private onKeyEvent?: (event: KeyboardInputEvent) => void;
  private mousePressed = false;
  private lastMousePosition = { x: 0, y: 0 };
  private mouseMoveThrottle = 16; // ~60fps
  private lastMouseMoveTime = 0;
  private keyStates = new Set<string>();

  constructor(element?: HTMLElement) {
    if (element) {
      this.attachToElement(element);
    }
  }

  attachToElement(element: HTMLElement): void {
    this.detachFromElement();
    this.element = element;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.element) return;

    // Mouse events
    this.element.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.element.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.element.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.element.addEventListener('wheel', this.handleWheel.bind(this));
    this.element.addEventListener('contextmenu', (e) => e.preventDefault());
    this.element.addEventListener('dragstart', (e) => e.preventDefault());
    this.element.addEventListener('selectstart', (e) => e.preventDefault());

    // Keyboard events
    this.element.addEventListener('keydown', this.handleKeyDown.bind(this));
    this.element.addEventListener('keyup', this.handleKeyUp.bind(this));
    
    // Focus events
    this.element.addEventListener('focus', this.handleFocus.bind(this));
    this.element.addEventListener('blur', this.handleBlur.bind(this));
    
    // Make element focusable and capture keyboard
    this.element.tabIndex = 0;
    this.element.style.outline = 'none';
  }

  private detachFromElement(): void {
    if (this.element) {
      this.element.removeEventListener('mousedown', this.handleMouseDown);
      this.element.removeEventListener('mouseup', this.handleMouseUp);
      this.element.removeEventListener('mousemove', this.handleMouseMove);
      this.element.removeEventListener('wheel', this.handleWheel);
      this.element.removeEventListener('keydown', this.handleKeyDown);
      this.element.removeEventListener('keyup', this.handleKeyUp);
      this.element.removeEventListener('focus', this.handleFocus);
      this.element.removeEventListener('blur', this.handleBlur);
    }
  }

  private handleMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.mousePressed = true;
    const coords = this.getRelativeCoordinates(event);
    this.lastMousePosition = coords;
    
    if (this.onMouseEvent) {
      this.onMouseEvent({
        type: 'mousedown',
        button: event.button,
        x: coords.x,
        y: coords.y,
        pressure: 1.0,
        timestamp: Date.now()
      });
    }
  }

  private handleMouseUp(event: MouseEvent): void {
    event.preventDefault();
    this.mousePressed = false;
    const coords = this.getRelativeCoordinates(event);
    
    if (this.onMouseEvent) {
      this.onMouseEvent({
        type: 'mouseup',
        button: event.button,
        x: coords.x,
        y: coords.y,
        pressure: 0.0,
        timestamp: Date.now()
      });
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    event.preventDefault();
    
    // Throttle mouse move events for performance
    const now = Date.now();
    if (now - this.lastMouseMoveTime < this.mouseMoveThrottle) {
      return;
    }
    this.lastMouseMoveTime = now;
    
    const coords = this.getRelativeCoordinates(event);
    const deltaX = coords.x - this.lastMousePosition.x;
    const deltaY = coords.y - this.lastMousePosition.y;
    this.lastMousePosition = coords;
    
    if (this.onMouseEvent) {
      this.onMouseEvent({
        type: 'mousemove',
        button: this.mousePressed ? event.button : -1,
        x: coords.x,
        y: coords.y,
        deltaX,
        deltaY,
        pressure: this.mousePressed ? 1.0 : 0.0,
        timestamp: now
      });
    }
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    const coords = this.getRelativeCoordinates(event);
    
    if (this.onMouseEvent) {
      this.onMouseEvent({
        type: 'wheel',
        button: -1,
        x: coords.x,
        y: coords.y,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaZ: event.deltaZ,
        deltaMode: event.deltaMode,
        timestamp: Date.now()
      });
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Prevent default for most keys except some system keys
    if (!['F5', 'F11', 'F12'].includes(event.key)) {
      event.preventDefault();
    }
    
    const keyId = `${event.code}-${event.key}`;
    if (this.keyStates.has(keyId)) {
      return; // Ignore key repeat
    }
    this.keyStates.add(keyId);
    
    if (this.onKeyEvent) {
      this.onKeyEvent({
        type: 'keydown',
        key: event.key,
        code: event.code,
        keyCode: event.keyCode,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        repeat: event.repeat,
        timestamp: Date.now()
      });
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    event.preventDefault();
    
    const keyId = `${event.code}-${event.key}`;
    this.keyStates.delete(keyId);
    
    if (this.onKeyEvent) {
      this.onKeyEvent({
        type: 'keyup',
        key: event.key,
        code: event.code,
        keyCode: event.keyCode,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        repeat: false,
        timestamp: Date.now()
      });
    }
  }

  private handleFocus(): void {
    console.log('Input handler gained focus');
  }

  private handleBlur(): void {
    console.log('Input handler lost focus');
    // Clear all key states when losing focus
    this.keyStates.clear();
    this.mousePressed = false;
  }

  private getRelativeCoordinates(event: MouseEvent): { x: number; y: number } {
    if (!this.element) return { x: 0, y: 0 };
    
    const rect = this.element.getBoundingClientRect();
    const scaleX = this.element.offsetWidth > 0 ? rect.width / this.element.offsetWidth : 1;
    const scaleY = this.element.offsetHeight > 0 ? rect.height / this.element.offsetHeight : 1;
    
    return {
      x: Math.round((event.clientX - rect.left) / scaleX),
      y: Math.round((event.clientY - rect.top) / scaleY)
    };
  }

  focus(): void {
    if (this.element) {
      this.element.focus();
    }
  }

  onMouse(callback: (event: MouseInputEvent) => void): void {
    this.onMouseEvent = callback;
  }

  onKeyboard(callback: (event: KeyboardInputEvent) => void): void {
    this.onKeyEvent = callback;
  }

  destroy(): void {
    this.detachFromElement();
    this.keyStates.clear();
    this.element = null;
  }
}

export interface MouseInputEvent {
  type: 'mousedown' | 'mouseup' | 'mousemove' | 'wheel';
  button: number;
  x: number;
  y: number;
  deltaX?: number;
  deltaY?: number;
  deltaZ?: number;
  deltaMode?: number;
  pressure?: number;
  timestamp: number;
}

export interface KeyboardInputEvent {
  type: 'keydown' | 'keyup';
  key: string;
  code: string;
  keyCode: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  repeat: boolean;
  timestamp: number;
}

// Enhanced signaling service with better error handling and reconnection
export class SignalingService {
  private websocket: WebSocket | null = null;
  private onSignalCallback?: (signal: SignalMessage) => void;
  private onConnectionCallback?: (connected: boolean) => void;
  private onErrorCallback?: (error: Error) => void;
  private sessionId: string;
  private peerId: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private messageQueue: SignalMessage[] = [];

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.peerId = this.generatePeerId();
  }

  private generatePeerId(): string {
    return 'peer-' + Math.random().toString(36).substring(2, 15);
  }

  async connect(serverUrl?: string): Promise<void> {
    if (this.isConnecting || (this.websocket && this.websocket.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        // For demo purposes, simulate WebSocket connection
        // In production, replace with actual WebSocket server
        setTimeout(() => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          
          if (this.onConnectionCallback) {
            this.onConnectionCallback(true);
          }
          
          // Process queued messages
          this.processMessageQueue();
          
          resolve();
        }, 1000 + Math.random() * 1000);
        
      } catch (error) {
        this.isConnecting = false;
        if (this.onErrorCallback) {
          this.onErrorCallback(error as Error);
        }
        reject(error);
      }
    });
  }

  private async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  sendSignal(signal: Omit<SignalMessage, 'timestamp' | 'peerId'>): void {
    const message: SignalMessage = {
      ...signal,
      peerId: this.peerId,
      timestamp: Date.now()
    };

    // Queue message if not connected
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      this.messageQueue.push(message);
      return;
    }

    try {
      // In production, send via WebSocket
      // this.websocket.send(JSON.stringify(message));
      
      // For demo, simulate message handling
      this.simulateSignalHandling(message);
    } catch (error) {
      console.error('Failed to send signal:', error);
      this.messageQueue.push(message);
    }
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendSignal(message);
      }
    }
  }

  private simulateSignalHandling(signal: SignalMessage): void {
    // Simulate network delay and responses
    setTimeout(() => {
      if (this.onSignalCallback) {
        switch (signal.type) {
          case 'offer':
            // Simulate answer from remote peer
            this.onSignalCallback({
              type: 'answer',
              sessionId: signal.sessionId,
              peerId: 'remote-peer-' + Math.random().toString(36).substring(2, 8),
              data: {
                type: 'answer',
                sdp: 'v=0\r\no=- ' + Date.now() + ' 2 IN IP4 127.0.0.1\r\n...'
              },
              timestamp: Date.now()
            });
            break;
            
          case 'ice-candidate':
            // Simulate ICE candidate from remote peer
            setTimeout(() => {
              this.onSignalCallback!({
                type: 'ice-candidate',
                sessionId: signal.sessionId,
                peerId: 'remote-peer',
                data: {
                  candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 ' + (54400 + Math.floor(Math.random() * 1000)) + ' typ host',
                  sdpMLineIndex: 0,
                  sdpMid: '0'
                },
                timestamp: Date.now()
              });
            }, 100 + Math.random() * 500);
            break;
        }
      }
    }, 200 + Math.random() * 800);
  }

  onSignal(callback: (signal: SignalMessage) => void): void {
    this.onSignalCallback = callback;
  }

  onConnection(callback: (connected: boolean) => void): void {
    this.onConnectionCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getPeerId(): string {
    return this.peerId;
  }

  isConnected(): boolean {
    return this.websocket?.readyState === WebSocket.OPEN;
  }

  disconnect(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    this.messageQueue = [];
    this.reconnectAttempts = 0;
    
    if (this.onConnectionCallback) {
      this.onConnectionCallback(false);
    }
  }
}

// File transfer utility
export class FileTransferManager {
  private dataChannel: RTCDataChannel | null = null;
  private onProgressCallback?: (progress: number, fileName: string) => void;
  private onCompleteCallback?: (fileName: string, data: ArrayBuffer) => void;
  private onErrorCallback?: (error: Error, fileName: string) => void;
  private activeTransfers = new Map<string, FileTransfer>();

  constructor(dataChannel?: RTCDataChannel) {
    if (dataChannel) {
      this.setDataChannel(dataChannel);
    }
  }

  setDataChannel(dataChannel: RTCDataChannel): void {
    this.dataChannel = dataChannel;
    
    this.dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleFileMessage(message);
      } catch (error) {
        // Handle binary data
        this.handleBinaryData(event.data);
      }
    };
  }

  async sendFile(file: File): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not available');
    }

    const transferId = this.generateTransferId();
    const chunkSize = 16384; // 16KB chunks
    
    // Send file metadata
    const metadata = {
      type: 'file-start',
      transferId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      chunkSize,
      totalChunks: Math.ceil(file.size / chunkSize)
    };

    this.dataChannel.send(JSON.stringify(metadata));

    // Create transfer tracking
    const transfer: FileTransfer = {
      id: transferId,
      fileName: file.name,
      fileSize: file.size,
      chunks: [],
      receivedChunks: 0,
      totalChunks: metadata.totalChunks,
      startTime: Date.now()
    };

    this.activeTransfers.set(transferId, transfer);

    // Send file in chunks
    const reader = new FileReader();
    let offset = 0;
    let chunkIndex = 0;

    const sendNextChunk = () => {
      if (offset >= file.size) {
        // Send completion message
        this.dataChannel!.send(JSON.stringify({
          type: 'file-complete',
          transferId
        }));
        return;
      }

      const chunk = file.slice(offset, offset + chunkSize);
      reader.onload = (e) => {
        if (e.target?.result) {
          const chunkData = {
            type: 'file-chunk',
            transferId,
            chunkIndex,
            data: Array.from(new Uint8Array(e.target.result as ArrayBuffer))
          };

          this.dataChannel!.send(JSON.stringify(chunkData));
          
          offset += chunkSize;
          chunkIndex++;
          
          if (this.onProgressCallback) {
            const progress = (offset / file.size) * 100;
            this.onProgressCallback(Math.min(progress, 100), file.name);
          }
          
          // Send next chunk with small delay to avoid overwhelming
          setTimeout(sendNextChunk, 10);
        }
      };
      
      reader.readAsArrayBuffer(chunk);
    };

    sendNextChunk();
  }

  private handleFileMessage(message: any): void {
    switch (message.type) {
      case 'file-start':
        this.handleFileStart(message);
        break;
      case 'file-chunk':
        this.handleFileChunk(message);
        break;
      case 'file-complete':
        this.handleFileComplete(message);
        break;
    }
  }

  private handleFileStart(message: any): void {
    const transfer: FileTransfer = {
      id: message.transferId,
      fileName: message.fileName,
      fileSize: message.fileSize,
      fileType: message.fileType,
      chunks: new Array(message.totalChunks),
      receivedChunks: 0,
      totalChunks: message.totalChunks,
      startTime: Date.now()
    };

    this.activeTransfers.set(message.transferId, transfer);
  }

  private handleFileChunk(message: any): void {
    const transfer = this.activeTransfers.get(message.transferId);
    if (!transfer) return;

    transfer.chunks[message.chunkIndex] = new Uint8Array(message.data);
    transfer.receivedChunks++;

    if (this.onProgressCallback) {
      const progress = (transfer.receivedChunks / transfer.totalChunks) * 100;
      this.onProgressCallback(progress, transfer.fileName);
    }
  }

  private handleFileComplete(message: any): void {
    const transfer = this.activeTransfers.get(message.transferId);
    if (!transfer) return;

    // Combine all chunks
    const totalSize = transfer.chunks.reduce((size, chunk) => size + (chunk?.length || 0), 0);
    const fileData = new Uint8Array(totalSize);
    let offset = 0;

    for (const chunk of transfer.chunks) {
      if (chunk) {
        fileData.set(chunk, offset);
        offset += chunk.length;
      }
    }

    if (this.onCompleteCallback) {
      this.onCompleteCallback(transfer.fileName, fileData.buffer);
    }

    this.activeTransfers.delete(message.transferId);
  }

  private handleBinaryData(data: ArrayBuffer): void {
    // Handle direct binary transfers if needed
    console.log('Received binary data:', data.byteLength, 'bytes');
  }

  private generateTransferId(): string {
    return 'transfer-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  }

  onProgress(callback: (progress: number, fileName: string) => void): void {
    this.onProgressCallback = callback;
  }

  onComplete(callback: (fileName: string, data: ArrayBuffer) => void): void {
    this.onCompleteCallback = callback;
  }

  onError(callback: (error: Error, fileName: string) => void): void {
    this.onErrorCallback = callback;
  }

  getActiveTransfers(): FileTransfer[] {
    return Array.from(this.activeTransfers.values());
  }
}

interface FileTransfer {
  id: string;
  fileName: string;
  fileSize: number;
  fileType?: string;
  chunks: (Uint8Array | undefined)[];
  receivedChunks: number;
  totalChunks: number;
  startTime: number;
}

// Audio processing utilities
export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noiseGate: AudioWorkletNode | null = null;

  async initialize(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create audio processing nodes
      this.analyser = this.audioContext.createAnalyser();
      this.gainNode = this.audioContext.createGain();
      this.compressor = this.audioContext.createDynamicsCompressor();
      
      // Configure analyser
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      
      // Configure compressor
      this.compressor.threshold.setValueAtTime(-24, this.audioContext.currentTime);
      this.compressor.knee.setValueAtTime(30, this.audioContext.currentTime);
      this.compressor.ratio.setValueAtTime(12, this.audioContext.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.audioContext.currentTime);
      this.compressor.release.setValueAtTime(0.25, this.audioContext.currentTime);
      
    } catch (error) {
      console.error('Failed to initialize audio processor:', error);
      throw error;
    }
  }

  processStream(stream: MediaStream): MediaStream {
    if (!this.audioContext || !this.gainNode || !this.compressor || !this.analyser) {
      return stream;
    }

    try {
      const source = this.audioContext.createMediaStreamSource(stream);
      const destination = this.audioContext.createMediaStreamDestination();
      
      // Connect audio processing chain
      source
        .connect(this.gainNode)
        .connect(this.compressor)
        .connect(this.analyser)
        .connect(destination);
      
      return destination.stream;
    } catch (error) {
      console.error('Failed to process audio stream:', error);
      return stream;
    }
  }

  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(volume / 100, this.audioContext!.currentTime);
    }
  }

  getAudioLevel(): number {
    if (!this.analyser) return 0;
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    return (average / 255) * 100;
  }

  destroy(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.gainNode = null;
    this.compressor = null;
    this.noiseGate = null;
  }
}