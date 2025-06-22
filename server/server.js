import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ⚡️ Create HTTP + WebSocket Server
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname, '../app')));

const server = app.listen(PORT, () => {
  console.log(`✅ App available at http://localhost:${PORT}`);
});

// ⚡️ WebSocket Signaling
const wss = new WebSocketServer({ server });
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

console.log(`✅ Signaling service running as part of HTTP server...`);
