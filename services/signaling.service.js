export class SignalingService {
  constructor(peerId) {
    this.peerId = peerId;
    this.socket = null;
    this.callbacks = {};
  }

  connect() {
    // this.socket = new WebSocket(`ws://${location.host}`);
    this.socket = new WebSocket(`ws://${location.hostname}:8080`);
    this.socket.addEventListener('open', () => {
      this.socket.send(JSON.stringify({ register: this.peerId }));
    });
    this.socket.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (this.callbacks.signal) {
        this.callbacks.signal(data);
      }
    });
  }

  on(event, callback) {
    this.callbacks[event] = callback;
  }

  send(data) {
    this.socket.send(JSON.stringify(data));
  }

  joinRoom(room) {
    this.send({ room, from: this.peerId });
  }
}
