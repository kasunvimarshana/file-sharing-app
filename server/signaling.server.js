import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.static(path.join(__dirname, '../app')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 8080;

// Map peerId -> WebSocket
const peers = new Map();

wss.on('connection', (ws) => {
  let peerId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.register) {
        peerId = data.register;
        peers.set(peerId, ws);
        console.log(`Peer registered: ${peerId}`);
        return;
      }

      // Relay signaling data to intended peer
      if (data.to && peers.has(data.to)) {
        peers.get(data.to).send(JSON.stringify(data));
      }
    } catch (err) {
      console.error('Failed to parse message', err);
    }
  });

  ws.on('close', () => {
    if (peerId) {
      peers.delete(peerId);
      console.log(`Peer disconnected: ${peerId}`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Signaling server listening at http://localhost:${PORT}`);
});
