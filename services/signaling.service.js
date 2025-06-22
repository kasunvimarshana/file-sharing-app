export class SignalingService {
  constructor(peerId) {
    this.peerId = peerId;
    this.ws = null;
    this.callbacks = {};
  }

  connect() {
    // this.ws = new WebSocket(`ws://${location.host}`);
    this.ws = new WebSocket(`ws://${location.hostname}:8080`);

    this.ws.addEventListener('open', () => {
      this.ws.send(JSON.stringify({ register: this.peerId }));
    });

    this.ws.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (this.callbacks['signal']) {
        this.callbacks['signal'](data);
      }
    });

    this.ws.addEventListener('close', () => {
      console.warn('Signaling connection closed.');
    });
  }

  on(event, callback) {
    this.callbacks[event] = callback;
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  joinRoom(room) {
    this.send({ room, from: this.peerId });
  }
}
