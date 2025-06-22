// client.js
const signalingUrl = `ws://${location.hostname}:8080`;
const ws = new WebSocket(signalingUrl);
const logArea = document.getElementById('log');
const peerId = Math.random().toString(36).substring(2, 9);
document.getElementById('myPeerId').textContent = peerId;

let peerConnection = null;
let dataChannel = null;
let isInitiator = false;
let selectedFile = null;

const pendingCandidates = []; // Buffer for candidates until remote description
let incomingChunks = [];

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'register', payload: { peerId } }));
};
ws.onmessage = async (event) => {
  const { type, payload } = JSON.parse(event.data);
  if (type === 'signal') {
    await handleSignal(payload);
  }
};

function log(msg) {
  logArea.textContent += msg + '\n';
}

document.getElementById('fileInput').onchange = e => {
  selectedFile = e.target.files[0];
  log(`Selected file: ${selectedFile.name} (${selectedFile.size} bytes)`);
};

document.getElementById('connectPeer').onclick = async () => {
  const targetId = document.getElementById('targetPeerId').value.trim();
  if (!targetId) return log('No target peer ID specified.');

  isInitiator = true;
  setupPeerConnection(targetId);
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  sendSignal(targetId, { offer });
};

document.getElementById('sendFile').onclick = async () => {
  if (!selectedFile || !dataChannel || dataChannel.readyState !== 'open') {
    return log('DataChannel not ready.');
  }
  log(`Sending file...`);

  const chunkSize = 16 * 1024;
  let offset = 0;

  while (offset < selectedFile.size) {
    const chunk = await selectedFile.slice(offset, offset + chunkSize).arrayBuffer();
    dataChannel.send(chunk);
    offset += chunkSize;
    await new Promise(r => setTimeout(r, 10));
  }
  dataChannel.send('EOF');
  log('File transfer completed.');
};

function setupPeerConnection(targetId) {
  if (peerConnection) {
    return;
  }

  peerConnection = new RTCPeerConnection();

  peerConnection.onicecandidate = e => {
    if (e.candidate) {
      sendSignal(targetId, { candidate: e.candidate });
    }
  };
  
  peerConnection.ondatachannel = e => {
    dataChannel = e.channel;
    dataChannel.binaryType = 'arraybuffer';
    dataChannel.onmessage = e => receiveData(e.data);
    dataChannel.onopen = () => log('DataChannel is open for receiving.');
  };
  
  if (isInitiator) {
    dataChannel = peerConnection.createDataChannel('fileTransfer');
    dataChannel.binaryType = 'arraybuffer';
    dataChannel.onopen = () => log('DataChannel is open for sending.');
    dataChannel.onmessage = e => receiveData(e.data);
  }
}

function sendSignal(targetId, data) {
  ws.send(JSON.stringify({ type: 'signal', payload: { targetId, ...data } }));
}

async function handleSignal({ senderId, offer, answer, candidate }) {
  if (!peerConnection) {
    setupPeerConnection(senderId);
  }

  if (offer) {
    isInitiator = false;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answerDesc = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answerDesc);
    sendSignal(senderId, { answer: peerConnection.localDescription });
    await flushCandidates();
  } else if (answer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    await flushCandidates();
  } else if (candidate) {
    if (peerConnection.remoteDescription) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      pendingCandidates.push(candidate);
    }
  }
}

async function flushCandidates() {
  for (const candidate of pendingCandidates) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
  pendingCandidates.length = 0;
}

function receiveData(data) {
  if (typeof data === 'string' && data === 'EOF') {
    log(`Received EOF, assembling file (${incomingChunks.length} chunks)...`);
    const blob = new Blob(incomingChunks);
    incomingChunks = [];
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `received_file`;
    a.click();
    log('File received and downloaded.');
  } else {
    incomingChunks.push(data);
    log(`Received chunk (${data.byteLength} bytes)`);
  }
}
