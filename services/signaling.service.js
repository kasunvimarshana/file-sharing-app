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
      this.onMessage(data);
    });
  }

  send(data) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }
}
