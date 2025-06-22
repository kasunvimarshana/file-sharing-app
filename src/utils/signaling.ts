export class SignalingServer {
  private connections: Map<string, WebSocket[]> = new Map();
  private messageHandlers: Map<string, (message: any) => void> = new Map();
  private connectionId: string;

  constructor(connectionId: string) {
    this.connectionId = connectionId;
    this.setupLocalSignaling();
  }

  private setupLocalSignaling() {
    // Use BroadcastChannel for local signaling between tabs
    const channel = new BroadcastChannel('remote-desktop-signaling');
    
    channel.onmessage = (event) => {
      const message = event.data;
      if (message.to === this.connectionId || message.to === 'broadcast') {
        this.handleMessage(message);
      }
    };

    // Store channel reference for sending messages
    (this as any).channel = channel;
  }

  private handleMessage(message: any) {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    }
  }

  onMessage(type: string, handler: (message: any) => void) {
    this.messageHandlers.set(type, handler);
  }

  sendMessage(type: string, data: any, to: string) {
    const message = {
      type,
      data,
      from: this.connectionId,
      to,
      timestamp: Date.now()
    };

    // Send via BroadcastChannel
    (this as any).channel.postMessage(message);

    // Also store in localStorage as backup
    const messages = JSON.parse(localStorage.getItem('signaling-messages') || '[]');
    messages.push(message);
    // Keep only last 100 messages
    if (messages.length > 100) {
      messages.splice(0, messages.length - 100);
    }
    localStorage.setItem('signaling-messages', JSON.stringify(messages));
  }

  getStoredMessages(): any[] {
    return JSON.parse(localStorage.getItem('signaling-messages') || '[]');
  }

  cleanup() {
    if ((this as any).channel) {
      (this as any).channel.close();
    }
  }
}