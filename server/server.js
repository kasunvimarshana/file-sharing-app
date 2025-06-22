import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ HTTP Server
const app = express();
app.use(express.static(path.join(__dirname, '../app')));
const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

// ✅ WebSocket Signaling
const wss = new WebSocketServer({ server });
const clients = new Map();
const rooms = new Map();

// ✅ Main Signaling Logic
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message.toString());
    } catch {
      return;
    }

    // ✅ Registration
    if (data.register) {
      clients.set(data.register, ws);
      console.log(`[SIGNALING] Client registered: ${data.register}`);
      return;
    }

    // ✅ Join Room
    if (data.room && data.from && !data.to && !data.broadcast && !data.offer) {
      if (!rooms.has(data.room)) {
        rooms.set(data.room, new Set());
      }
      rooms.get(data.room).add(data.from);
      console.log(`[SIGNALING] Client ${data.from} joined room ${data.room}`);
      return;
    }

    // ✅ Direct Signaling
    if (data.to && clients.has(data.to)) {
      clients.get(data.to).send(JSON.stringify(data));
    }

    // ✅ Room Broadcast
    if (data.room && data.broadcast) {
      const roomMembers = rooms.get(data.room);
      if (roomMembers) {
        for (const memberId of roomMembers) {
          if (memberId !== data.from && clients.has(memberId)) {
            clients.get(memberId).send(JSON.stringify(data));
          }
        }
      }
    }
  });

  // ✅ Cleanup
  ws.on('close', () => {
    for (const [id, clientWs] of clients.entries()) {
      if (clientWs === ws) {
        clients.delete(id);
        break;
      }
    }
  });
});
