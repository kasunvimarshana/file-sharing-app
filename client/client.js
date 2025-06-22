// Configuration
const SIGNALING_SERVER = `ws://${location.hostname}:8080`;
const CHUNK_SIZE = 16 * 1024; // 16KB chunks
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { 
    urls: `turn:${location.hostname}:3478?transport=udp`,
    username: "username",
    credential: "password"
  }
];

// DOM elements
const elements = {
  myPeerId: document.getElementById('myPeerId'),
  targetPeerId: document.getElementById('targetPeerId'),
  connectPeer: document.getElementById('connectPeer'),
  fileInput: document.getElementById('fileInput'),
  sendFile: document.getElementById('sendFile'),
  log: document.getElementById('log'),
  clearLog: document.getElementById('clearLog'),
  connectionStatus: document.getElementById('connectionStatus'),
  peerStatus: document.getElementById('peerStatus'),
  transferProgress: document.getElementById('transferProgress'),
  progressBar: document.getElementById('progressBar'),
  progressText: document.getElementById('progressText')
};

// Application state
const state = {
  peerId: generatePeerId(),
  ws: null,
  peerConnection: null,
  dataChannel: null,
  selectedFile: null,
  incomingChunks: [],
  incomingFileInfo: null,
  isConnecting: false,
  transferProgress: 0
};

// Utility functions
function generatePeerId() {
  return Math.random().toString(36).substring(2, 9);
}

function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const logMessage = `[${timestamp}] ${message}`;
  elements.log.textContent += logMessage + '\n';
  elements.log.scrollTop = elements.log.scrollHeight;
  
  if (type === 'error') {
    console.error(logMessage);
  } else {
    console.log(logMessage);
  }
}

function updateConnectionStatus(status, message) {
  elements.connectionStatus.className = `status ${status}`;
  elements.connectionStatus.textContent = message;
}

function updatePeerStatus(message, isError = false) {
  elements.peerStatus.innerHTML = isError ? 
    `<span style="color: red;">${message}</span>` : 
    `<span style="color: green;">${message}</span>`;
}

function updateProgress(percent) {
  elements.progressBar.style.width = `${percent}%`;
  elements.progressText.textContent = `${Math.round(percent)}%`;
}

function showProgress() {
  elements.transferProgress.style.display = 'block';
}

function hideProgress() {
  elements.transferProgress.style.display = 'none';
  updateProgress(0);
}

// WebSocket management
function connectToSignalingServer() {
  try {
    state.ws = new WebSocket(SIGNALING_SERVER);
    
    state.ws.onopen = () => {
      log('Connected to signaling server');
      updateConnectionStatus('connected', 'Connected to Signaling Server');
      
      // Register with the server
      state.ws.send(JSON.stringify({
        type: 'register',
        payload: { peerId: state.peerId }
      }));
    };
    
    state.ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        await handleSignalingMessage(data);
      } catch (error) {
        log(`Error parsing signaling message: ${error.message}`, 'error');
      }
    };
    
    state.ws.onclose = (event) => {
      log(`Signaling server connection closed: ${event.code} ${event.reason}`);
      updateConnectionStatus('disconnected', 'Disconnected from Signaling Server');
      
      // Attempt to reconnect after 3 seconds
      setTimeout(connectToSignalingServer, 3000);
    };
    
    state.ws.onerror = (error) => {
      log(`Signaling server error: ${error.message}`, 'error');
      updateConnectionStatus('disconnected', 'Signaling Server Error');
    };
    
  } catch (error) {
    log(`Failed to connect to signaling server: ${error.message}`, 'error');
    updateConnectionStatus('disconnected', 'Connection Failed');
  }
}

async function handleSignalingMessage(data) {
  const { type, payload } = data;
  
  switch (type) {
    case 'registered':
      log(`Registered with peer ID: ${payload.peerId}`);
      break;
      
    case 'signal':
      await handleWebRTCSignal(payload);
      break;
      
    case 'error':
      log(`Signaling error: ${payload.message}`, 'error');
      updatePeerStatus(payload.message, true);
      break;
      
    case 'pong':
      // Server is alive
      break;
      
    default:
      log(`Unknown signaling message type: ${type}`, 'error');
  }
}

// WebRTC management
function createPeerConnection(targetId, isInitiator = false) {
  try {
    state.peerConnection = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10
    });
    
    // ICE candidate handling
    state.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(targetId, { candidate: event.candidate });
      }
    };
    
    // Connection state monitoring
    state.peerConnection.onconnectionstatechange = () => {
      const connectionState = state.peerConnection.connectionState;
      log(`WebRTC connection state: ${connectionState}`);
      
      switch (connectionState) {
        case 'connected':
          updatePeerStatus('Peer connected successfully');
          state.isConnecting = false;
          break;
        case 'disconnected':
          updatePeerStatus('Peer disconnected', true);
          elements.sendFile.disabled = true;
          break;
        case 'failed':
          updatePeerStatus('Connection failed', true);
          state.isConnecting = false;
          elements.sendFile.disabled = true;
          break;
        case 'connecting':
          updatePeerStatus('Connecting to peer...');
          break;
      }
    };
    
    // ICE connection state monitoring
    state.peerConnection.oniceconnectionstatechange = () => {
      const iceState = state.peerConnection.iceConnectionState;
      log(`ICE connection state: ${iceState}`);
    };
    
    // Data channel handling
    state.peerConnection.ondatachannel = (event) => {
      setupDataChannel(event.channel);
    };
    
    if (isInitiator) {
      state.dataChannel = state.peerConnection.createDataChannel('fileTransfer', {
        ordered: true,
        maxRetransmits: 3
      });
      setupDataChannel(state.dataChannel);
    }
    
    log(`Peer connection created (initiator: ${isInitiator})`);
    
  } catch (error) {
    log(`Error creating peer connection: ${error.message}`, 'error');
    throw error;
  }
}

function setupDataChannel(channel) {
  state.dataChannel = channel;
  state.dataChannel.binaryType = 'arraybuffer';
  
  state.dataChannel.onopen = () => {
    log('Data channel opened');
    elements.sendFile.disabled = false;
    updatePeerStatus('Ready to transfer files');
  };
  
  state.dataChannel.onclose = () => {
    log('Data channel closed');
    elements.sendFile.disabled = true;
  };
  
  state.dataChannel.onmessage = (event) => {
    handleDataChannelMessage(event.data);
  };
  
  state.dataChannel.onerror = (error) => {
    log(`Data channel error: ${error}`, 'error');
  };
}

function sendSignal(targetId, data) {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify({
      type: 'signal',
      payload: { targetId, ...data }
    }));
  } else {
    log('Cannot send signal: WebSocket not connected', 'error');
  }
}

async function handleWebRTCSignal({ senderId, offer, answer, candidate }) {
  try {
    if (!state.peerConnection) {
      createPeerConnection(senderId, false);
    }
    
    if (offer) {
      log('Received offer from peer');
      await state.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await state.peerConnection.createAnswer();
      await state.peerConnection.setLocalDescription(answer);
      
      sendSignal(senderId, { answer: state.peerConnection.localDescription });
      log('Sent answer to peer');
      
    } else if (answer) {
      log('Received answer from peer');
      await state.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      
    } else if (candidate) {
      log('Received ICE candidate');
      await state.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
    
  } catch (error) {
    log(`Error handling WebRTC signal: ${error.message}`, 'error');
  }
}

// File transfer
async function sendFile() {
  if (!state.selectedFile || !state.dataChannel || state.dataChannel.readyState !== 'open') {
    log('Cannot send file: data channel not ready', 'error');
    return;
  }
  
  try {
    log(`Starting file transfer: ${state.selectedFile.name} (${state.selectedFile.size} bytes)`);
    
    // Send file metadata first
    const fileInfo = {
      name: state.selectedFile.name,
      size: state.selectedFile.size,
      type: state.selectedFile.type,
      chunks: Math.ceil(state.selectedFile.size / CHUNK_SIZE)
    };
    
    state.dataChannel.send(JSON.stringify({
      type: 'fileInfo',
      data: fileInfo
    }));
    
    showProgress();
    let offset = 0;
    let chunkIndex = 0;
    
    while (offset < state.selectedFile.size) {
      const chunk = await state.selectedFile.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
      
      // Send chunk with metadata
      const chunkData = JSON.stringify({
        type: 'fileChunk',
        index: chunkIndex,
        data: Array.from(new Uint8Array(chunk))
      });
      
      state.dataChannel.send(chunkData);
      
      offset += CHUNK_SIZE;
      chunkIndex++;
      
      const progress = (offset / state.selectedFile.size) * 100;
      updateProgress(Math.min(progress, 100));
      
      // Small delay to prevent overwhelming the data channel
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    // Send end marker
    state.dataChannel.send(JSON.stringify({ type: 'fileEnd' }));
    
    log('File transfer completed');
    hideProgress();
    
  } catch (error) {
    log(`Error sending file: ${error.message}`, 'error');
    hideProgress();
  }
}

function handleDataChannelMessage(data) {
  try {
    if (typeof data === 'string') {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'fileInfo':
          log(`Receiving file: ${message.data.name} (${message.data.size} bytes)`);
          state.incomingFileInfo = message.data;
          state.incomingChunks = new Array(message.data.chunks);
          showProgress();
          break;
          
        case 'fileChunk':
          if (state.incomingFileInfo) {
            state.incomingChunks[message.index] = new Uint8Array(message.data);
            
            const receivedChunks = state.incomingChunks.filter(chunk => chunk !== undefined).length;
            const progress = (receivedChunks / state.incomingFileInfo.chunks) * 100;
            updateProgress(progress);
            
            log(`Received chunk ${message.index + 1}/${state.incomingFileInfo.chunks}`);
          }
          break;
          
        case 'fileEnd':
          completeFileReception();
          break;
      }
    }
  } catch (error) {
    log(`Error handling data channel message: ${error.message}`, 'error');
  }
}

function completeFileReception() {
  try {
    if (!state.incomingFileInfo || !state.incomingChunks.length) {
      log('Error: No file info or chunks received', 'error');
      return;
    }
    
    // Combine all chunks
    const totalSize = state.incomingChunks.reduce((size, chunk) => size + (chunk ? chunk.length : 0), 0);
    const fileData = new Uint8Array(totalSize);
    
    let offset = 0;
    for (const chunk of state.incomingChunks) {
      if (chunk) {
        fileData.set(chunk, offset);
        offset += chunk.length;
      }
    }
    
    // Create and download file
    const blob = new Blob([fileData], { type: state.incomingFileInfo.type });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = state.incomingFileInfo.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    
    log(`File received and saved: ${state.incomingFileInfo.name}`);
    hideProgress();
    
    // Reset state
    state.incomingChunks = [];
    state.incomingFileInfo = null;
    
  } catch (error) {
    log(`Error completing file reception: ${error.message}`, 'error');
    hideProgress();
  }
}

// Event handlers
async function handleConnectPeer() {
  const targetId = elements.targetPeerId.value.trim();
  
  if (!targetId) {
    updatePeerStatus('Please enter a target peer ID', true);
    return;
  }
  
  if (targetId === state.peerId) {
    updatePeerStatus('Cannot connect to yourself', true);
    return;
  }
  
  if (state.isConnecting) {
    log('Already connecting to a peer');
    return;
  }
  
  try {
    state.isConnecting = true;
    updatePeerStatus('Initiating connection...');
    
    createPeerConnection(targetId, true);
    
    const offer = await state.peerConnection.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false
    });
    
    await state.peerConnection.setLocalDescription(offer);
    sendSignal(targetId, { offer });
    
    log(`Connection offer sent to peer: ${targetId}`);
    
  } catch (error) {
    log(`Error connecting to peer: ${error.message}`, 'error');
    updatePeerStatus('Connection failed', true);
    state.isConnecting = false;
  }
}

function handleFileSelect(event) {
  state.selectedFile = event.target.files[0];
  
  if (state.selectedFile) {
    log(`File selected: ${state.selectedFile.name} (${(state.selectedFile.size / 1024 / 1024).toFixed(2)} MB)`);
    
    if (state.dataChannel && state.dataChannel.readyState === 'open') {
      elements.sendFile.disabled = false;
    }
  } else {
    elements.sendFile.disabled = true;
  }
}

function clearLog() {
  elements.log.textContent = '';
}

// Initialize application
function initialize() {
  // Display peer ID
  elements.myPeerId.textContent = state.peerId;
  log(`Generated peer ID: ${state.peerId}`);
  
  // Set up event listeners
  elements.connectPeer.addEventListener('click', handleConnectPeer);
  elements.fileInput.addEventListener('change', handleFileSelect);
  elements.sendFile.addEventListener('click', sendFile);
  elements.clearLog.addEventListener('click', clearLog);
  
  // Allow connecting on Enter key
  elements.targetPeerId.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      handleConnectPeer();
    }
  });
  
  // Connect to signaling server
  updateConnectionStatus('connecting', 'Connecting to Signaling Server...');
  connectToSignalingServer();
  
  // Periodic connection health check
  setInterval(() => {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify({ type: 'ping', payload: {} }));
    }
  }, 30000);
  
  log('Application initialized');
}

// Start the application when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (state.ws) {
    state.ws.close();
  }
  if (state.peerConnection) {
    state.peerConnection.close();
  }
});