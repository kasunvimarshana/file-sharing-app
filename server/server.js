import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname, '../app')));

const server = app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });
const clients = new Map();

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message.toString());
    } catch {
      console.warn('Invalid JSON');
      return;
    }

    if (data.register) {
      clients.set(data.register, ws);
      console.log(`[SIGNALING] Client registered: ${data.register}`);
      return;
    }

    if (data.to && clients.has(data.to)) {
      clients.get(data.to).send(JSON.stringify(data));
    }
  });

  ws.on('close', () => {
    for (const [id, clientWs] of clients.entries()) {
      if (clientWs === ws) {
        clients.delete(id);
        console.log(`[SIGNALING] Client disconnected: ${id}`);
        break;
      }
    }
  });
});

console.log('✅ WebSocket signaling server running...');
