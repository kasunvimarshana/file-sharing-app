import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8081 });
const clients = new Map();

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message.toString());

        if (data.register) {
            clients.set(data.register, ws);
            console.log(`[SIGNALING] Client registered: ${data.register}`);
            return;
        }

        if (data.to && clients.has(data.to)) {
            clients.get(data.to).send(JSON.stringify(data));
        }
    });
});

console.log(`✅ Signaling server running at ws://localhost:8081`);
