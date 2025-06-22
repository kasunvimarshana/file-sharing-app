import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup Express HTTP Server
const app = express();
app.use(express.static(path.join(__dirname, '../app')));
const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
  console.log(`✅ HTTP Server listening on http://localhost:${PORT}`);
});

// Setup WebSocket Server for Signaling
const wss = new WebSocketServer({ server });

// Maps peerId -> websocket connection
const clients = new Map();
// Maps roomId -> Set of peerIds
const rooms = new Map();

wss.on('connection', (ws) => {
  let registeredId = null;

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message.toString());
    } catch {
      return;
    }

    // Registration message
    if (data.register) {
      registeredId = data.register;
      clients.set(registeredId, ws);
      console.log(`[SIGNAL] Registered: ${registeredId}`);
      return;
    }

    // Join room
    if (data.room && !data.to) {
      if (!rooms.has(data.room)) rooms.set(data.room, new Set());
      rooms.get(data.room).add(registeredId);
      console.log(`[SIGNAL] ${registeredId} joined room ${data.room}`);
      return;
    }

    // Relay message to specific peer
    if (data.to && clients.has(data.to)) {
      clients.get(data.to).send(JSON.stringify(data));
      return;
    }

    // Broadcast to room except sender
    if (data.room && data.broadcast) {
      const members = rooms.get(data.room);
      if (members) {
        for (const member of members) {
          if (member !== registeredId && clients.has(member)) {
            clients.get(member).send(JSON.stringify(data));
          }
        }
      }
    }
  });

  ws.on('close', () => {
    if (registeredId) {
      clients.delete(registeredId);
      // Remove from rooms
      for (const members of rooms.values()) {
        members.delete(registeredId);
      }
      console.log(`[SIGNAL] Disconnected: ${registeredId}`);
    }
  });
});
