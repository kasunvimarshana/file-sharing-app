class P2PClient {
    constructor() {
        this.peerId = this.generatePeerId();
        this.socket = null;
        this.peers = new Map();
        this.files = new Map();
        this.chunks = new Map();
        this.downloads = new Map();
        this.uploads = new Map();
        
        this.stats = {
            uploadSpeed: 0,
            downloadSpeed: 0,
            bytesUploaded: 0,
            bytesDownloaded: 0
        };
        
        this.eventHandlers = new Map();
        
        this.init();
    }
    
    generatePeerId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 20; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    async init() {
        try {
            this.socket = io('ws://localhost:3001');
            this.setupSocketHandlers();
            this.emit('client-ready');
        } catch (error) {
            console.error('Failed to initialize P2P client:', error);
            this.emit('error', error);
        }
    }
    
    setupSocketHandlers() {
        this.socket.on('connect', () => {
            console.log('Connected to signaling server');
            this.socket.emit('join-room', 'main');
            this.emit('connected');
        });
        
        this.socket.on('room-peers', (peers) => {
            console.log('Room peers:', peers);
            peers.forEach(peerId => this.connectToPeer(peerId));
        });
        
        this.socket.on('peer-joined', (peerId) => {
            console.log('New peer joined:', peerId);
            this.connectToPeer(peerId);
        });
        
        this.socket.on('peer-left', (peerId) => {
            console.log('Peer left:', peerId);
            this.disconnectFromPeer(peerId);
        });
        
        this.socket.on('webrtc-offer', async (data) => {
            await this.handleOffer(data);
        });
        
        this.socket.on('webrtc-answer', async (data) => {
            await this.handleAnswer(data);
        });
        
        this.socket.on('webrtc-ice-candidate', async (data) => {
            await this.handleIceCandidate(data);
        });
        
        this.socket.on('file-request', (data) => {
            this.handleFileRequest(data);
        });
        
        this.socket.on('file-response', (data) => {
            this.handleFileResponse(data);
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from signaling server');
            this.emit('disconnected');
        });
    }
    
    async connectToPeer(peerId) {
        if (this.peers.has(peerId)) return;
        
        const peer = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });
        
        const dataChannel = peer.createDataChannel('p2p-data', {
            ordered: false,
            maxRetransmits: 0
        });
        
        // Initialize peer data with ICE candidate queue
        this.peers.set(peerId, {
            connection: peer,
            dataChannel: null,
            status: 'connecting',
            iceCandidateQueue: [],
            remoteDescriptionSet: false
        });
        
        this.setupPeerHandlers(peer, peerId, dataChannel);
        
        peer.ondatachannel = (event) => {
            const channel = event.channel;
            this.setupDataChannelHandlers(channel, peerId);
        };
        
        try {
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            
            this.socket.emit('webrtc-offer', {
                target: peerId,
                offer: offer
            });
        } catch (error) {
            console.error('Error creating offer:', error);
            this.peers.delete(peerId);
        }
    }
    
    async handleOffer(data) {
        const { offer, sender } = data;
        
        if (this.peers.has(sender)) return;
        
        const peer = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });
        
        // Initialize peer data with ICE candidate queue
        this.peers.set(sender, {
            connection: peer,
            dataChannel: null,
            status: 'connecting',
            iceCandidateQueue: [],
            remoteDescriptionSet: false
        });
        
        this.setupPeerHandlers(peer, sender, null);
        
        peer.ondatachannel = (event) => {
            const channel = event.channel;
            this.setupDataChannelHandlers(channel, sender);
            
            const peerData = this.peers.get(sender);
            if (peerData) {
                peerData.dataChannel = channel;
            }
        };
        
        try {
            await peer.setRemoteDescription(offer);
            
            // Mark remote description as set and process queued ICE candidates
            const peerData = this.peers.get(sender);
            if (peerData) {
                peerData.remoteDescriptionSet = true;
                await this.processQueuedIceCandidates(sender);
            }
            
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            
            this.socket.emit('webrtc-answer', {
                target: sender,
                answer: answer
            });
        } catch (error) {
            console.error('Error handling offer:', error);
            this.peers.delete(sender);
        }
    }
    
    async handleAnswer(data) {
        const { answer, sender } = data;
        const peerData = this.peers.get(sender);
        
        if (!peerData) return;
        
        try {
            await peerData.connection.setRemoteDescription(answer);
            
            // Mark remote description as set and process queued ICE candidates
            peerData.remoteDescriptionSet = true;
            await this.processQueuedIceCandidates(sender);
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }
    
    async handleIceCandidate(data) {
        const { candidate, sender } = data;
        const peerData = this.peers.get(sender);
        
        if (!peerData) return;
        
        // If remote description is not set yet, queue the ICE candidate
        if (!peerData.remoteDescriptionSet) {
            peerData.iceCandidateQueue.push(candidate);
            return;
        }
        
        try {
            await peerData.connection.addIceCandidate(candidate);
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    }
    
    async processQueuedIceCandidates(peerId) {
        const peerData = this.peers.get(peerId);
        if (!peerData || !peerData.remoteDescriptionSet) return;
        
        // Process all queued ICE candidates
        for (const candidate of peerData.iceCandidateQueue) {
            try {
                await peerData.connection.addIceCandidate(candidate);
            } catch (error) {
                console.error('Error adding queued ICE candidate:', error);
            }
        }
        
        // Clear the queue
        peerData.iceCandidateQueue = [];
    }
    
    setupPeerHandlers(peer, peerId, dataChannel) {
        peer.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('webrtc-ice-candidate', {
                    target: peerId,
                    candidate: event.candidate
                });
            }
        };
        
        peer.onconnectionstatechange = () => {
            const peerData = this.peers.get(peerId);
            if (peerData) {
                peerData.status = peer.connectionState;
                
                if (peer.connectionState === 'connected') {
                    console.log('Connected to peer:', peerId);
                    this.emit('peer-connected', peerId);
                } else if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') {
                    console.log('Disconnected from peer:', peerId);
                    this.disconnectFromPeer(peerId);
                }
            }
        };
        
        if (dataChannel) {
            this.setupDataChannelHandlers(dataChannel, peerId);
            const peerData = this.peers.get(peerId);
            if (peerData) {
                peerData.dataChannel = dataChannel;
            }
        }
    }
    
    setupDataChannelHandlers(channel, peerId) {
        channel.onopen = () => {
            console.log('Data channel opened with peer:', peerId);
            const peerData = this.peers.get(peerId);
            if (peerData) {
                peerData.status = 'connected';
            }
            this.emit('peer-ready', peerId);
        };
        
        channel.onmessage = (event) => {
            this.handleDataChannelMessage(event.data, peerId);
        };
        
        channel.onerror = (error) => {
            console.error('Data channel error:', error);
        };
        
        channel.onclose = () => {
            console.log('Data channel closed with peer:', peerId);
        };
    }
    
    handleDataChannelMessage(data, peerId) {
        try {
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'chunk-request':
                    this.handleChunkRequest(message, peerId);
                    break;
                case 'chunk-data':
                    this.handleChunkData(message, peerId);
                    break;
                case 'file-info':
                    this.handleFileInfo(message, peerId);
                    break;
                default:
                    console.log('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Error handling data channel message:', error);
        }
    }
    
    handleChunkRequest(message, peerId) {
        const { fileHash, chunkIndex } = message;
        const file = this.files.get(fileHash);
        
        if (file && file.chunks[chunkIndex]) {
            this.sendChunkData(peerId, fileHash, chunkIndex, file.chunks[chunkIndex]);
        }
    }
    
    handleChunkData(message, peerId) {
        const { fileHash, chunkIndex, data } = message;
        
        const download = this.downloads.get(fileHash);
        if (download && !download.chunks[chunkIndex]) {
            // Convert base64 back to Uint8Array
            const chunkData = new Uint8Array(atob(data).split('').map(c => c.charCodeAt(0)));
            download.chunks[chunkIndex] = chunkData;
            download.receivedChunks++;
            
            this.stats.bytesDownloaded += chunkData.length;
            this.emit('chunk-received', { fileHash, chunkIndex, peerId });
            
            // Check if download is complete
            if (download.receivedChunks === download.totalChunks) {
                this.completeDownload(fileHash);
            }
        }
    }
    
    handleFileInfo(message, peerId) {
        const { fileHash, fileName, fileSize, totalChunks } = message;
        this.emit('file-info', { fileHash, fileName, fileSize, totalChunks, peerId });
    }
    
    sendChunkData(peerId, fileHash, chunkIndex, chunkData) {
        const peerData = this.peers.get(peerId);
        if (!peerData || !peerData.dataChannel || peerData.dataChannel.readyState !== 'open') {
            return;
        }
        
        // Convert Uint8Array to base64 for transmission
        const base64Data = btoa(String.fromCharCode(...chunkData));
        
        const message = {
            type: 'chunk-data',
            fileHash,
            chunkIndex,
            data: base64Data
        };
        
        try {
            peerData.dataChannel.send(JSON.stringify(message));
            this.stats.bytesUploaded += chunkData.length;
            this.emit('chunk-sent', { fileHash, chunkIndex, peerId });
        } catch (error) {
            console.error('Error sending chunk data:', error);
        }
    }
    
    requestChunk(peerId, fileHash, chunkIndex) {
        const peerData = this.peers.get(peerId);
        if (!peerData || !peerData.dataChannel || peerData.dataChannel.readyState !== 'open') {
            return false;
        }
        
        const message = {
            type: 'chunk-request',
            fileHash,
            chunkIndex
        };
        
        try {
            peerData.dataChannel.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error('Error requesting chunk:', error);
            return false;
        }
    }
    
    broadcastFileInfo(fileHash, fileName, fileSize, totalChunks) {
        const message = {
            type: 'file-info',
            fileHash,
            fileName,
            fileSize,
            totalChunks
        };
        
        for (const [peerId, peerData] of this.peers) {
            if (peerData.dataChannel && peerData.dataChannel.readyState === 'open') {
                try {
                    peerData.dataChannel.send(JSON.stringify(message));
                } catch (error) {
                    console.error('Error broadcasting file info:', error);
                }
            }
        }
    }
    
    disconnectFromPeer(peerId) {
        const peerData = this.peers.get(peerId);
        if (peerData) {
            if (peerData.connection) {
                peerData.connection.close();
            }
            this.peers.delete(peerId);
            this.emit('peer-disconnected', peerId);
        }
    }
    
    completeDownload(fileHash) {
        const download = this.downloads.get(fileHash);
        if (!download) return;
        
        // Combine all chunks into a single file
        const totalSize = download.chunks.reduce((sum, chunk) => sum + (chunk ? chunk.length : 0), 0);
        const fileData = new Uint8Array(totalSize);
        let offset = 0;
        
        for (const chunk of download.chunks) {
            if (chunk) {
                fileData.set(chunk, offset);
                offset += chunk.length;
            }
        }
        
        // Create blob and download link
        const blob = new Blob([fileData]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = download.fileName;
        a.click();
        URL.revokeObjectURL(url);
        
        this.downloads.delete(fileHash);
        this.emit('download-complete', { fileHash, fileName: download.fileName });
    }
    
    addFile(file, chunks) {
        const fileHash = this.generateFileHash(file.name + file.size + file.lastModified);
        
        this.files.set(fileHash, {
            file,
            chunks,
            fileName: file.name,
            fileSize: file.size,
            totalChunks: chunks.length
        });
        
        this.broadcastFileInfo(fileHash, file.name, file.size, chunks.length);
        this.emit('file-added', { fileHash, fileName: file.name });
        
        return fileHash;
    }
    
    startDownload(fileHash, fileName, fileSize, totalChunks) {
        if (this.downloads.has(fileHash)) return;
        
        const download = {
            fileHash,
            fileName,
            fileSize,
            totalChunks,
            chunks: new Array(totalChunks).fill(null),
            receivedChunks: 0,
            peers: new Set()
        };
        
        this.downloads.set(fileHash, download);
        this.emit('download-started', { fileHash, fileName });
        
        // Start requesting chunks from available peers
        this.requestNextChunks(fileHash);
    }
    
    requestNextChunks(fileHash) {
        const download = this.downloads.get(fileHash);
        if (!download) return;
        
        const availablePeers = Array.from(this.peers.keys()).filter(peerId => {
            const peerData = this.peers.get(peerId);
            return peerData && peerData.dataChannel && peerData.dataChannel.readyState === 'open';
        });
        
        if (availablePeers.length === 0) return;
        
        // Find missing chunks and request them
        for (let i = 0; i < download.totalChunks; i++) {
            if (!download.chunks[i]) {
                const peerId = availablePeers[i % availablePeers.length];
                this.requestChunk(peerId, fileHash, i);
            }
        }
    }
    
    generateFileHash(input) {
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }
    
    getConnectedPeers() {
        return Array.from(this.peers.entries())
            .filter(([_, peerData]) => peerData.status === 'connected')
            .map(([peerId, peerData]) => ({ peerId, status: peerData.status }));
    }
    
    getStats() {
        return { ...this.stats };
    }
    
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }
    
    emit(event, data) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error('Error in event handler:', error);
                }
            });
        }
    }
}