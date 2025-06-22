export class SignalingService {
  constructor(localId, onMessage) {
    this.localId = localId;
    this.onMessage = onMessage;

    // this.socket = new WebSocket(`ws://${window.location.host}`);
    this.socket = new WebSocket(`ws://${window.location.hostname}:8080`);
    this.socket.addEventListener('open', () => {
      this.socket.send(JSON.stringify({ register: this.localId }));
    });

    this.socket.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (data.to === this.localId) {
        this.onMessage(data);
      }
    });

    this.socket.addEventListener('close', () => {
      console.warn('Signaling server connection closed');
    });

    this.socket.addEventListener('error', (err) => {
      console.error('Signaling server error:', err);
    });
  }

  send(data) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }
}
