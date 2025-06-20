<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Advanced P2P File Sharing</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .drag-over {
            border-color: #4F46E5;
            background-color: #EEF2FF;
        }
        .log-entry {
            padding: 8px;
            margin: 4px 0;
            border-radius: 4px;
            font-family: monospace;
        }
        .log-entry.info {
            background-color: #EFF6FF;
            color: #1E40AF;
        }
        .log-entry.success {
            background-color: #ECFDF5;
            color: #065F46;
        }
        .log-entry.warning {
            background-color: #FFFBEB;
            color: #92400E;
        }
        .log-entry.error {
            background-color: #FEE2E2;
            color: #B91C1C;
        }
        .toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 6px;
            color: white;
            opacity: 0;
            transition: opacity 0.3s ease;
            z-index: 1000;
        }
        .toast.show {
            opacity: 1;
        }
        .toast.info {
            background-color: #3B82F6;
        }
        .toast.success {
            background-color: #10B981;
        }
        .toast.warning {
            background-color: #F59E0B;
        }
        .toast.error {
            background-color: #EF4444;
        }
        .status-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            display: inline-block;
            margin-right: 8px;
            background-color: #10B981;
        }
        .progress-bar {
            height: 8px;
            background-color: #E5E7EB;
            border-radius: 4px;
            margin-top: 8px;
            overflow: hidden;
        }
        .progress-fill {
            height: 100%;
            background-color: #4F46E5;
            transition: width 0.3s ease;
        }
        .peer-item, .file-item {
            transition: all 0.2s ease;
        }
        .peer-item:hover, .file-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        #fileDropArea {
            transition: all 0.2s ease;
        }
        pre {
            background-color: #1E293B;
            color: #F8FAFC;
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            max-height: 200px;
        }
        .copy-btn {
            margin-top: 8px;
            padding: 4px 8px;
            background-color: #4F46E5;
            color: white;
            border-radius: 4px;
            cursor: pointer;
            border: none;
            font-size: 12px;
        }
        .copy-btn:hover {
            background-color: #4338CA;
        }
    </style>
</head>
<body class="bg-gray-50 min-h-screen">
    <div class="container mx-auto px-4 py-8">
        <header class="mb-8">
            <h1 class="text-3xl font-bold text-gray-800 mb-2">Advanced P2P File Sharing</h1>
            <p class="text-gray-600">A secure peer-to-peer file sharing application using WebRTC</p>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Connection Panel -->
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-xl font-semibold mb-4 flex items-center">
                    <span class="mr-2">🔗</span> Connection Status
                    <span id="connectionText" class="ml-auto px-3 py-1 rounded-full text-sm font-medium">Disconnected</span>
                </h2>
                
                <div class="mb-4">
                    <p class="text-gray-600 mb-1">Your Peer ID:</p>
                    <div id="myPeerId" class="bg-gray-100 p-3 rounded font-mono break-all"></div>
                </div>
                
                <div class="flex justify-between mb-4">
                    <div>
                        <p class="text-gray-600">Peers:</p>
                        <p id="peerCount" class="font-medium">0 connected</p>
                    </div>
                    <div>
                        <p class="text-gray-600">Downloads:</p>
                        <p id="downloadCount" class="font-medium">0 active</p>
                    </div>
                    <div>
                        <p class="text-gray-600">Shared Files:</p>
                        <p id="uploadCount" class="font-medium">0 files</p>
                    </div>
                </div>

                <div class="mb-6">
                    <p class="text-gray-600 mb-2">Network Stats:</p>
                    <div class="grid grid-cols-2 gap-2">
                        <div class="bg-gray-100 p-2 rounded">
                            <p class="text-xs text-gray-500">Upload</p>
                            <p id="uploadSpeed" class="font-medium">0 B/s</p>
                            <p id="totalUploaded" class="text-sm text-gray-600">0 B</p>
                        </div>
                        <div class="bg-gray-100 p-2 rounded">
                            <p class="text-xs text-gray-500">Download</p>
                            <p id="downloadSpeed" class="font-medium">0 B/s</p>
                            <p id="totalDownloaded" class="text-sm text-gray-600">0 B</p>
                        </div>
                    </div>
                </div>

                <div class="space-y-4">
                    <button id="createOfferBtn" class="w-full bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700 transition">
                        Create Connection Offer
                    </button>
                    
                    <div>
                        <label for="offerInput" class="block text-sm font-medium text-gray-700 mb-1">Paste Offer:</label>
                        <textarea id="offerInput" rows="4" class="w-full border border-gray-300 rounded p-2 text-sm"></textarea>
                        <button id="connectBtn" class="w-full bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700 transition mt-2">
                            Process Offer
                        </button>
                    </div>
                    
                    <div id="answerDisplay" style="display: none;">
                        <p class="text-sm font-medium text-gray-700 mb-1">Your Answer:</p>
                    </div>
                    
                    <div>
                        <label for="answerInput" class="block text-sm font-medium text-gray-700 mb-1">Paste Answer:</label>
                        <textarea id="answerInput" rows="4" class="w-full border border-gray-300 rounded p-2 text-sm"></textarea>
                        <button id="finalizeBtn" class="w-full bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700 transition mt-2">
                            Finalize Connection
                        </button>
                    </div>
                    
                    <div id="offerDisplay" style="display: none;">
                        <p class="text-sm font-medium text-gray-700 mb-1">Your Offer:</p>
                    </div>
                </div>
            </div>

            <!-- File Sharing Panel -->
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-xl font-semibold mb-4 flex items-center">
                    <span class="mr-2">📁</span> File Sharing
                </h2>
                
                <div id="fileDropArea" class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center mb-6 cursor-pointer">
                    <div class="flex flex-col items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p class="text-gray-600 mb-1">Drag & drop files here or click to select</p>
                        <p class="text-sm text-gray-500">Files will be shared with all connected peers</p>
                    </div>
                    <input type="file" id="fileInput" class="hidden" multiple>
                </div>
                
                <div class="mb-6">
                    <h3 class="font-medium text-gray-700 mb-2">Available Files:</h3>
                    <div id="availableFiles" class="space-y-3">
                        <p class="text-gray-500">Connect to peers to discover available files...</p>
                    </div>
                </div>
                
                <div>
                    <h3 class="font-medium text-gray-700 mb-2">Connected Peers:</h3>
                    <div id="peerList" class="space-y-3">
                        <p class="text-gray-500">No peers connected. Use the connection section above to join the network.</p>
                    </div>
                </div>
            </div>

            <!-- Logs Panel -->
            <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-xl font-semibold mb-4 flex items-center">
                    <span class="mr-2">📜</span> Activity Logs
                </h2>
                
                <div class="flex justify-between mb-4">
                    <button id="clearLogsBtn" class="text-sm text-indigo-600 hover:text-indigo-800">
                        Clear Logs
                    </button>
                </div>
                
                <div id="logEntries" class="space-y-1 max-h-96 overflow-y-auto"></div>
            </div>
        </div>
    </div>

    <script>
        class AdvancedP2PNode {
            constructor() {
                this.peerId = this.generateSecurePeerId();
                this.peers = new Map();
                this.connections = new Map();
                this.dataChannels = new Map();
                this.sharedFiles = new Map();
                this.downloadingFiles = new Map();
                this.fileChunks = new Map();
                this.pendingOffers = new Map();
                this.connectionStats = new Map();
                
                // Enhanced configuration
                this.chunkSize = 32 * 1024; // 32KB chunks for better performance
                this.maxChunksPerRequest = 8;
                this.maxConcurrentDownloads = 3;
                this.heartbeatInterval = 30000; // 30 seconds
                this.connectionTimeout = 60000; // 60 seconds
                
                // Statistics tracking
                this.stats = {
                    totalUploaded: 0,
                    totalDownloaded: 0,
                    uploadSpeed: 0,
                    downloadSpeed: 0,
                    sessionStart: Date.now()
                };
                
                this.init();
            }
            
            generateSecurePeerId() {
                const timestamp = Date.now().toString(36);
                const random = Array.from(crypto.getRandomValues(new Uint8Array(12)))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
                return `peer_${timestamp}_${random}`;
            }
            
            init() {
                this.log('🚀 Advanced P2P Node initializing...', 'info');
                this.updatePeerIdDisplay();
                this.setupEventListeners();
                this.startHeartbeat();
                this.startStatsUpdate();
                this.updateUI();
                this.log('✅ Node initialization complete', 'success');
            }
            
            updatePeerIdDisplay() {
                document.getElementById('myPeerId').innerHTML = `
                    ${this.peerId}
                    <button class="copy-btn" onclick="p2pNode.copyToClipboard('myPeerId')">Copy</button>
                `;
            }
            
            log(message, type = 'info') {
                const logEntries = document.getElementById('logEntries');
                const entry = document.createElement('div');
                entry.className = `log-entry ${type}`;
                entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
                logEntries.appendChild(entry);
                logEntries.scrollTop = logEntries.scrollHeight;
                
                // Keep only last 200 entries
                while (logEntries.children.length > 200) {
                    logEntries.removeChild(logEntries.firstChild);
                }
                
                console.log(`[P2P] ${message}`);
                
                // Show toast for important events
                if (type === 'success' || type === 'error' || type === 'warning') {
                    this.showToast(message, type);
                }
            }
            
            showToast(message, type = 'info') {
                const toast = document.createElement('div');
                toast.className = `toast ${type}`;
                toast.textContent = message;
                document.body.appendChild(toast);
                
                setTimeout(() => toast.classList.add('show'), 100);
                setTimeout(() => {
                    toast.classList.remove('show');
                    setTimeout(() => document.body.removeChild(toast), 300);
                }, 3000);
            }
            
            startHeartbeat() {
                setInterval(() => {
                    this.peers.forEach((peer, peerId) => {
                        if (peer.connected) {
                            this.sendMessage(peerId, {
                                type: 'heartbeat',
                                timestamp: Date.now()
                            });
                        }
                    });
                }, this.heartbeatInterval);
            }
            
            startStatsUpdate() {
                setInterval(() => {
                    this.updateStats();
                }, 1000);
            }
            
            updateStats() {
                const now = Date.now();
                const timeWindow = 5000; // 5 second window
                
                let recentUploaded = 0;
                let recentDownloaded = 0;
                
                this.connectionStats.forEach(stats => {
                    const recentTransfers = stats.transfers.filter(t => now - t.timestamp < timeWindow);
                    recentUploaded += recentTransfers.filter(t => t.type === 'upload').reduce((sum, t) => sum + t.bytes, 0);
                    recentDownloaded += recentTransfers.filter(t => t.type === 'download').reduce((sum, t) => sum + t.bytes, 0);
                });
                
                this.stats.uploadSpeed = recentUploaded / (timeWindow / 1000);
                this.stats.downloadSpeed = recentDownloaded / (timeWindow / 1000);
                
                this.updateStatsDisplay();
            }
            
            updateStatsDisplay() {
                document.getElementById('totalUploaded').textContent = this.formatBytes(this.stats.totalUploaded);
                document.getElementById('totalDownloaded').textContent = this.formatBytes(this.stats.totalDownloaded);
                document.getElementById('uploadSpeed').textContent = this.formatBytes(this.stats.uploadSpeed) + '/s';
                document.getElementById('downloadSpeed').textContent = this.formatBytes(this.stats.downloadSpeed) + '/s';
            }
            
            recordTransfer(peerId, type, bytes) {
                if (!this.connectionStats.has(peerId)) {
                    this.connectionStats.set(peerId, {
                        transfers: [],
                        totalUploaded: 0,
                        totalDownloaded: 0
                    });
                }
                
                const stats = this.connectionStats.get(peerId);
                stats.transfers.push({
                    type,
                    bytes,
                    timestamp: Date.now()
                });
                
                // Keep only recent transfers
                const cutoff = Date.now() - 60000; // 1 minute
                stats.transfers = stats.transfers.filter(t => t.timestamp > cutoff);
                
                if (type === 'upload') {
                    stats.totalUploaded += bytes;
                    this.stats.totalUploaded += bytes;
                } else {
                    stats.totalDownloaded += bytes;
                    this.stats.totalDownloaded += bytes;
                }
            }
            
            setupEventListeners() {
                document.getElementById('createOfferBtn').addEventListener('click', () => this.createOffer());
                document.getElementById('connectBtn').addEventListener('click', () => this.handleOffer());
                document.getElementById('finalizeBtn').addEventListener('click', () => this.handleAnswer());
                document.getElementById('clearLogsBtn').addEventListener('click', () => {
                    document.getElementById('logEntries').innerHTML = '';
                });
                
                const fileInput = document.getElementById('fileInput');
                const fileDropArea = document.getElementById('fileDropArea');
                
                fileDropArea.addEventListener('click', () => fileInput.click());
 fileInput.addEventListener('change', (e) => this.handleFileSelection(e.target.files));
                
                fileDropArea.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    fileDropArea.classList.add('drag-over');
                });
                
                fileDropArea.addEventListener('dragleave', (e) => {
                    if (!fileDropArea.contains(e.relatedTarget)) {
                        fileDropArea.classList.remove('drag-over');
                    }
                });
                
                fileDropArea.addEventListener('drop', (e) => {
                    e.preventDefault();
                    fileDropArea.classList.remove('drag-over');
                    this.handleFileSelection(e.dataTransfer.files);
                });
            }
            
            async createOffer() {
                try {
                    this.log('Creating WebRTC offer...', 'info');
                    
                    const connection = new RTCPeerConnection({
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' }
                        ]
                    });
                    
                    const dataChannel = connection.createDataChannel('fileTransfer', {
                        ordered: true,
                        maxPacketLifeTime: 3000
                    });
                    
                    this.setupDataChannel(dataChannel);
                    
                    const offer = await connection.createOffer();
                    await connection.setLocalDescription(offer);
                    
                    await new Promise((resolve) => {
                        if (connection.iceGatheringState === 'complete') {
                            resolve();
                        } else {
                            connection.addEventListener('icegatheringstatechange', () => {
                                if (connection.iceGatheringState === 'complete') {
                                    resolve();
                                }
                            });
                        }
                    });
                    
                    const offerData = {
                        type: 'offer',
                        peerId: this.peerId,
                        offer: connection.localDescription,
                        timestamp: Date.now()
                    };
                    
                    const tempPeerId = `temp_${Date.now()}`;
                    this.connections.set(tempPeerId, connection);
                    this.pendingOffers.set(tempPeerId, offerData);
                    
                    this.displayOffer(JSON.stringify(offerData, null, 2));
                    this.log('✅ Offer created successfully', 'success');
                    
                } catch (error) {
                    this.log(`❌ Failed to create offer: ${error.message}`, 'error');
                }
            }
            
            displayOffer(offerJson) {
                const offerDisplay = document.getElementById('offerDisplay');
                offerDisplay.innerHTML = `
                    <pre>${offerJson}</pre>
                    <button class="copy-btn" onclick="p2pNode.copyToClipboard('offerDisplay')">Copy</button>
                `;
                offerDisplay.style.display = 'block';
            }
            
            async handleOffer() {
                try {
                    const offerInput = document.getElementById('offerInput').value.trim();
                    if (!offerInput) {
                        this.log('❌ Please paste an offer first', 'error');
                        return;
                    }
                    
                    this.log('Processing received offer...', 'info');
                    
                    const offerData = JSON.parse(offerInput);
                    const remotePeerId = offerData.peerId;
                    
                    const connection = new RTCPeerConnection({
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' }
                        ]
                    });
                    
                    connection.addEventListener('datachannel', (event) => {
                        this.log(`📡 Data channel received: ${event.channel.label}`, 'info');
                        this.setupDataChannel(event.channel);
                    });
                    
                    await connection.setRemoteDescription(offerData.offer);
                    const answer = await connection.createAnswer();
                    await connection.setLocalDescription(answer);
                    
                    await new Promise((resolve) => {
                        if (connection.iceGatheringState === 'complete') {
                            resolve();
                        } else {
                            connection.addEventListener('icegatheringstatechange', () => {
                                if (connection.iceGatheringState === 'complete') {
                                    resolve();
                                }
                            });
                        }
                    });
                    
                    const answerData = {
                        type: 'answer',
                        peerId: this.peerId,
                        answer: connection.localDescription,
                        timestamp: Date.now()
                    };
                    
                    this.connections.set(remotePeerId, connection);
                    this.setupConnectionEvents(connection, remotePeerId);
                    
                    this.displayAnswer(JSON.stringify(answerData, null, 2));
                    this.log('✅ Answer created successfully', 'success');
                    
                } catch (error) {
                    this.log(`❌ Failed to process offer: ${error.message}`, 'error');
                }
            }
            
            displayAnswer(answerJson) {
                const answerDisplay = document.getElementById('answerDisplay');
                answerDisplay.innerHTML = `
                    <pre>${answerJson}</pre>
                    <button class="copy-btn" onclick="p2pNode.copyToClipboard('answerDisplay')">Copy</button>
                `;
                answerDisplay.style.display = 'block';
            }
            
            async handleAnswer() {
                try {
                    const answerInput = document.getElementById('answerInput').value.trim();
                    if (!answerInput) {
                        this.log('❌ Please paste an answer first', 'error');
                        return;
                    }
                    
                    this.log('Processing received answer...', 'info');
                    
                    const answerData = JSON.parse(answerInput);
                    const remotePeerId = answerData.peerId;
                    
                    let connection = null;
                    let tempPeerId = null;
                    
                    for (const [id, conn] of this.connections.entries()) {
                        if (id.startsWith('temp_')) {
                            connection = conn;
                            tempPeerId = id;
                            break;
                        }
                    }
                    
                    if (!connection) {
                        this.log('❌ No pending offer found', 'error');
                        return;
                    }
                    
                    await connection.setRemoteDescription(answerData.answer);
                    
                    this.connections.delete(tempPeerId);
                    this.connections.set(remotePeerId, connection);
                    this.pendingOffers.delete(tempPeerId);
                    
                    this.setupConnectionEvents(connection, remotePeerId);
                    
                    this.log('✅ Connection finalized successfully', 'success');
                    
                } catch (error) {
                    this.log(`❌ Failed to process answer: ${error.message}`, 'error');
                }
            }
            
            setupConnectionEvents(connection, peerId) {
                connection.addEventListener('connectionstatechange', () => {
                    this.log(`Connection state changed: ${connection.connectionState}`, 'info');
                    if (connection.connectionState === 'connected') {
                        this.addPeer(peerId, connection);
                        this.log(`🤝 Connected to peer: ${peerId}`, 'success');
                    } else if (connection.connectionState === 'disconnected' || connection.connectionState === 'failed') {
                        this.removePeer(peerId);
                        this.log(`❌ Disconnected from peer: ${peerId}`, 'warning');
                    }
                });
                
                connection.addEventListener('iceconnectionstatechange', () => {
                    this.log(`ICE connection state: ${connection.iceConnectionState}`, 'info');
                });
            }
            
            setupDataChannel(channel) {
                if (this.dataChannels.has(channel.label)) {
                    this.log(`📡 Data channel already exists: ${channel.label}`, 'warning');
                    return;
                }
                
                channel.addEventListener('open', () => {
                    this.log(`📡 Data channel opened: ${channel.label}`, 'success');
                });
                
                channel.addEventListener('close', () => {
                    this.log(`📡 Data channel closed: ${channel.label}`, 'warning');
                    this.dataChannels.delete(channel.label);
                });
                
                channel.addEventListener('error', (error) => {
                    this.log(`📡 Data channel error: ${error}`, 'error');
                });
                
                channel.addEventListener('message', (event) => {
                    this.handleDataChannelMessage(event.data, channel);
                });
                
                this.dataChannels.set(channel.label, channel);
            }
            
            handleDataChannelMessage(data, channel) {
                try {
                    const message = JSON.parse(data);
                    
                    switch (message.type) {
                        case 'file-list':
                            this.handleFileListUpdate(message.files, message.peerId);
                            break;
                        case 'file-request':
                            this.handleFileRequest(message, channel);
                            break;
                        case 'file-chunk':
                            this.handleFileChunk(message);
                            break;
                        case 'heartbeat':
                            this.handleHeartbeat(message);
                            break;
                        case 'file-info':
                            this.handleFileInfo(message);
                            break;
                        default:
                            this.log(`Unknown message type: ${message.type}`, 'warning');
                    }
                } catch (error) {
                    this.log(`Failed to parse message: ${error.message}`, 'error');
                }
            }
            
            addPeer(peerId, connection) {
                this.peers.set(peerId, {
                    connection,
                    connected: true,
                    lastSeen: Date.now(),
                    files: new Map()
                });
                
                this.shareFileList(peerId);
                this.updateUI();
            }
            
            removePeer(peerId) {
                this.peers.delete(peerId);
                this.connections.delete(peerId);
                this.dataChannels.delete(peerId);
                this.connectionStats.delete(peerId);
                this.updateUI();
            }
            
            shareFileList(peerId) {
                const fileList = Array.from(this.sharedFiles.values()).map(file => ({
                    id: file.id,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified
                }));
                
                this.sendMessage(peerId, {
                    type: 'file-list',
                    files: fileList,
                    peerId: this.peerId
                });
            }
            
            sendMessage(peerId, message) {
                const channel = this.dataChannels.get(peerId);
                if (channel && channel.readyState === 'open') {
                    try {
                        channel.send(JSON.stringify(message));
                        return true;
                    } catch (error) {
                        this.log(`Failed to send message to ${peerId}: ${error.message}`, 'error');
                        return false;
                    }
                }
                return false;
            }
            
            handleFileSelection(files) {
                Array.from(files).forEach(file => {
                    const fileId = this.generateFileId(file);
                    this.sharedFiles.set(fileId, {
                        id: fileId,
                        file: file,
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        lastModified: file.lastModified,
                        chunks: this.createFileChunks(file)
                    });
                    
                    this.log(`📁 Added file: ${file.name} (${this.formatBytes(file.size)})`, 'success');
                });
                
                this.updateSharedFilesUI();
                this.broadcastFileList();
            }
            
            generateFileId(file) {
                return `${file.name}_${file.size}_${file.lastModified}_${Math.random().toString(36).substr(2, 9)}`;
            }
            
            createFileChunks(file) {
                const chunks = [];
                const totalChunks = Math.ceil(file.size / this.chunkSize);
                
                for (let i = 0; i < totalChunks; i++) {
                    const start = i * this.chunkSize;
                    const end = Math.min(start + this.chunkSize, file.size);
                    chunks.push({
                        index: i,
                        start,
                        end,
                        size: end - start
                    });
                }
                
                return chunks;
            }
            
            broadcastFileList() {
                this.peers.forEach((peer, peerId) => {
                    if (peer.connected) {
                        this.shareFileList(peerId);
                    }
                });
            }
            
            handleFileListUpdate(files, peerId) {
                const peer = this.peers.get(peerId);
                if (peer) {
                    peer.files.clear();
                    files.forEach(file => {
                        peer.files.set(file.id, file);
                    });
                    this.updateAvailableFilesUI();
                    this.log(`📋 Updated file list from ${peerId} (${files.length} files)`, 'info');
                }
            }
            
            async handleFileRequest(message, channel) {
                const { fileId, chunkIndex } = message;
                const sharedFile = this.sharedFiles.get(fileId);
                
                if (!sharedFile) {
                    this.log(`❌ Requested file not found: ${fileId}`, 'error');
                    return;
                }
                
                const chunk = sharedFile.chunks[chunkIndex];
                if (!chunk) {
                    this.log(`❌ Requested chunk not found: ${chunkIndex}`, 'error');
                    return;
                }
                
                try {
                    const blob = sharedFile.file.slice(chunk.start, chunk.end);
                    const arrayBuffer = await blob.arrayBuffer();
                    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
                    
                    const response = {
                        type: 'file-chunk',
                        fileId,
                        chunkIndex,
                        data: base64Data,
                        totalChunks: sharedFile.chunks.length
                    };
                    
                    channel.send(JSON.stringify(response));
                    this.recordTransfer(message.peerId, 'upload', chunk.size);
                    
                } catch (error) {
                    this.log(`❌ Failed to send chunk: ${error.message}`, 'error');
                }
            }
            
            handleFileChunk(message) {
                const { fileId, chunkIndex, data, totalChunks } = message;
                
                if (!this.downloadingFiles.has(fileId)) {
                    this.log(`❌ Unexpected chunk for file: ${fileId}`, 'error');
                    return;
                }
                
                const download = this.downloadingFiles.get(fileId);
                
                const binaryString = atob(data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                download.chunks[chunkIndex] = bytes;
                download.receivedChunks++;
                
                this.recordTransfer(download.peerId, 'download', bytes.length);
                
                const progress = (download.receivedChunks / totalChunks) * 100;
                this.updateDownloadProgress(fileId, progress);
                
                if (download.receivedChunks === totalChunks) {
                    this.completeDownload(fileId);
                }
                
                this.log(`📦 Received chunk ${chunkIndex + 1}/${totalChunks} for ${download.fileName}`, 'info');
            }
            
            async downloadFile(fileId, fileName, fileSize, peerId) {
                if (this.downloadingFiles.has(fileId)) {
                    this.log(`❌ File is already being downloaded: ${fileName}`, 'warning');
                    return;
                }
                
                const totalChunks = Math.ceil(fileSize / this.chunkSize);
                const download = {
                    fileId,
                    fileName,
                    fileSize,
                    peerId,
                    totalChunks,
                    receivedChunks: 0,
                    chunks: new Array(totalChunks),
                    startTime: Date.now()
                };
                
                this.downloadingFiles.set(fileId, download);
                this.addDownloadUI(fileId, fileName, fileSize);
                
                this.log(`📥 Starting download: ${fileName} (${this.formatBytes(fileSize)})`, 'info');
                
                for (let i = 0; i < totalChunks; i++) {
                    this.sendMessage(peerId, {
                        type: 'file-request',
                        fileId,
                        chunkIndex: i,
                        peerId: this.peerId
                    });
                }
            }
            
            completeDownload(fileId) {
                const download = this.downloadingFiles.get(fileId);
                if (!download) return;
                
                const totalSize = download.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
                const combined = new Uint8Array(totalSize);
                let offset = 0;
                
                for (const chunk of download.chunks) {
                    combined.set(chunk, offset);
                    offset += chunk.length;
                }
                
                const blob = new Blob([combined]);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = download.fileName;
                a.click();
                
                URL.revokeObjectURL(url);
                
                this.downloadingFiles.delete(fileId);
                this.removeDownloadUI(fileId);
                
                const duration = Date.now() - download.startTime;
                this.log(`✅ Download completed: ${download.fileName} (${this.formatBytes(download.fileSize)} in ${(duration/1000).toFixed(1)}s)`, 'success');
            }
            
            handleHeartbeat(message) {
                const peerId = message.peerId;
                const peer = this.peers.get(peerId);
                if (peer) {
                    peer.lastSeen = Date.now();
                }
            }
            
            updateUI() {
                this.updateConnectionStatus();
                this.updatePeersList();
                this.updateCounters();
            }
            
            updateConnectionStatus() {
                const connectedPeers = Array.from(this.peers.values()).filter(p => p.connected).length;
                const connectionText = document.getElementById('connectionText');
                const peerCount = document.getElementById('peerCount');
                
                if (connectedPeers > 0) {
                    connectionText.textContent = 'Connected';
                    connectionText.style.color = '#28a745';
                } else {
                    connectionText.textContent = 'Disconnected';
                    connectionText.style.color = '#dc3545';
                }
                
                peerCount.textContent = `${connectedPeers} connected`;
            }
            
            updatePeersList() {
                const peerList = document.getElementById('peerList');
                const connectedPeers = Array.from(this.peers.entries()).filter(([_, peer]) => peer.connected);
                
                if (connectedPeers.length === 0) {
                    peerList.innerHTML = '<p>No peers connected. Use the connection section above to join the network.</p>';
                    return;
                }
                
                peerList.innerHTML = connectedPeers.map(([peerId, peer]) => `
                    <div class="peer-item">
                        <div class="peer-info">
                            <div class="peer-status">
                                <div class="status-indicator"></div>
                                <span class="peer-id">${peerId}</span>
                            </div>
                            <div class="peer-details">
                                Files: ${peer.files.size} • Last seen: ${this.formatTime(peer.lastSeen)}
                            </div>
                        </div>
                        <div class="peer-actions">
                            <button class="btn btn-danger" onclick="p2pNode.disconnectPeer('${peerId}')">Disconnect</button>
                        </div>
                    </div>
                `).join('');
            }
            
            updateCounters() {
                document.getElementById('downloadCount').textContent = `${this.downloadingFiles.size} active`;
                document.getElementById('uploadCount').textContent = `${this.sharedFiles.size} files`;
            }
            
            updateSharedFilesUI() {
                const sharedFilesDiv = document.getElementById('sharedFiles');
                const files = Array.from(this.sharedFiles.values());
                
                if (files.length === 0) {
                    sharedFilesDiv.innerHTML = '<h4>Your Shared Files:</h4><p>No files shared yet.</p>';
                    return;
                }
                
                sharedFilesDiv.innerHTML = `
                    <h4>Your Shared Files:</h4>
                    ${files.map(file => `
                        <div class="file-item">
                            <div class="file-info">
                                <div class="file-name">${file.name}</div>
                                <div class="file-details">
                                    ${this.formatBytes(file.size)} • ${file.type || 'Unknown type'}
                                </div>
                            </div>
                            <div class="file-actions">
                                <button class="btn btn-danger" onclick="p2pNode.removeSharedFile('${file.id}')">Remove</button>
                            </div>
                        </div>
                    `).join('')}
                `;
            }
            
            updateAvailableFilesUI() {
                const availableFilesDiv = document.getElementById('availableFiles');
                const allFiles = [];
                
                this.peers.forEach((peer, peerId) => {
                    peer.files.forEach(file => {
                        allFiles.push({ ...file, peerId });
                    });
                });
                
                if (allFiles.length === 0) {
                    availableFilesDiv.innerHTML = '<p>Connect to peers to discover available files...</p>';
                    return;
                }
                
                availableFilesDiv.innerHTML = allFiles.map(file => `
                    <div class="file-item">
                        <div class="file-info">
                            <div class="file-name">${file.name}</div>
                            <div class="file-details">
                                ${this.formatBytes(file.size)} • From: ${file.peerId}
                            </div>
                        </div>
                        <div class="file-actions">
                            <button class="btn btn-primary" onclick="p2pNode.downloadFile('${file.id}', '${file.name}', ${file.size}, '${file.peerId}')">Download</button>
                        </div>
                    </div>
                `).join('');
            }
            
            addDownloadUI(fileId, fileName, fileSize) {
                const availableFilesDiv = document.getElementById('availableFiles');
                const downloadItem = document.createElement('div');
                downloadItem.className = 'file-item';
                downloadItem.id = `download-${fileId}`;
                downloadItem.innerHTML = `
                    <div class="file-info">
                        <div class="file-name">📥 ${fileName}</div>
                        <div class="file-details">
                            ${this.formatBytes(fileSize)} • Downloading...
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: 0%"></div>
                        </div>
                    </div>
                    <div class="file-actions">
                        <button class="btn btn-danger" onclick="p2pNode.cancelDownload('${fileId}')">Cancel</button>
                    </div>
                `;
                availableFilesDiv.appendChild(downloadItem);
            }
            
            updateDownloadProgress(fileId, progress) {
                const downloadItem = document.getElementById(`download-${fileId}`);
                if (downloadItem) {
                    const progressFill = downloadItem.querySelector('.progress-fill');
                    if (progressFill) {
                        progressFill.style.width = `${progress}%`;
                    }
                }
            }
            
            removeDownloadUI(fileId) {
                const downloadItem = document.getElementById(`download-${fileId}`);
                if (downloadItem) {
                    downloadItem.remove();
                }
            }
            
            removeSharedFile(fileId) {
                this.sharedFiles.delete(fileId);
                this.updateSharedFilesUI();
                this.broadcastFileList();
                this.log(`🗑️ Removed shared file: ${fileId}`, 'info');
            }
            
            cancelDownload(fileId) {
                this.downloadingFiles.delete(fileId);
                this.removeDownloadUI(fileId);
                this.log(`❌ Cancelled download: ${fileId}`, 'warning');
            }
            
            disconnectPeer(peerId) {
                const connection = this.connections.get(peerId);
                if (connection) {
                    connection.close();
                }
                this.removePeer(peerId);
                this.log(`🔌 Disconnected from peer: ${peerId}`, 'info');
            }
            
            formatBytes(bytes) {
                if (bytes === 0) return '0 B';
                const k = 1024;
                const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            }
            
            formatTime(timestamp) {
                const diff = Date.now() - timestamp;
                const seconds = Math.floor(diff / 1000);
                
                if (seconds < 60) return `${seconds}s ago`;
                const minutes = Math.floor(seconds / 60);
                if (minutes < 60) return `${minutes}m ago`;
                const hours = Math.floor(minutes / 60);
                return `${hours}h ago`;
            }
            
            copyToClipboard(elementId) {
                const element = document.getElementById(elementId);
                const text = element.tagName.toUpperCase() === 'PRE' ? element.textContent : element.innerText.split('\n')[0];
                
                navigator.clipboard.writeText(text).then(() => {
                    this.showToast('Copied to clipboard!', 'success');
                }).catch(err => {
                    this.log(`Failed to copy: ${err.message}`, 'error');
                });
            }
        }
        
        // Initialize the P2P node when the page loads
        let p2pNode;

        document.addEventListener('DOMContentLoaded', () => {
            p2pNode = new AdvancedP2PNode();
        });
    </script>
</body>
</html>
