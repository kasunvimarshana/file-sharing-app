export class SignalingService {
    constructor(localId, onMessage) {
        this.localId = localId;
        this.onMessage = onMessage;

        this.socket = new WebSocket('ws://localhost:8081');
        this.socket.addEventListener('open', () => {
            this.socket.send(JSON.stringify({ register: this.localId }));
        });
        this.socket.addEventListener('message', (event) => {
            const data = JSON.parse(event.data);
            if (data && data.to === this.localId) {
                this.onMessage(data);
            }
        });
    }

    send(data) {
        this.socket.send(JSON.stringify(data));
    }
}
