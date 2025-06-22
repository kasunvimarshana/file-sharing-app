// server.js
const http = require('http');
const WebSocket = require('ws');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const peers = new Map(); // peerId -> ws

wss.on('connection', ws => {
  let peerId;
  
  ws.on('message', raw => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch { return; }

    const { type, payload } = data;

    switch (type) {
      case 'register':
        peerId = payload.peerId;
        peers.set(peerId, ws);
        break;
      case 'signal':
        const targetWs = peers.get(payload.targetId);
        if (targetWs) {
          targetWs.send(JSON.stringify({ type: 'signal', payload: { ...payload, senderId: peerId } }));
        }
        break;
    }
  });

  ws.on('close', () => {
    if (peerId) peers.delete(peerId);
  });
});

server.listen(8080, () => console.log('Signaling server listening on http://localhost:8080'));
