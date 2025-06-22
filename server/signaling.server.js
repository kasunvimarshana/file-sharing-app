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

const PORT = process.env.PORT || 8080;

const wss = new WebSocketServer({ server });

// Maps peerId -> websocket connection
const peers = new Map();

wss.on('connection', (ws) => {
  let peerId = null;

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.register) {
        peerId = data.register;
        peers.set(peerId, ws);
        console.log(`Peer registered: ${peerId}`);
        return;
      }
      if (data.to && peers.has(data.to)) {
        peers.get(data.to).send(JSON.stringify(data));
      }
    } catch (e) {
      console.error('Failed to parse message:', e);
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
  console.log(`Server running at http://localhost:${PORT}`);
});
