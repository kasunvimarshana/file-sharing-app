class P2PTorrentApp {
    constructor() {
        this.p2pClient = new P2PClient();
        this.torrentManager = new TorrentManager(this.p2pClient);
        this.webrtcManager = new WebRTCManager();
        
        this.selectedFiles = [];
        this.activeTorrents = new Map();
        
        this.init();
    }
    
    init() {
        this.setupEventHandlers();
        this.setupP2PEventHandlers();
        this.startStatsUpdate();
        this.log('Application initialized', 'info');
    }
    
    setupEventHandlers() {
        // File input handler
        document.getElementById('fileInput').addEventListener('change', (event) => {
            this.selectedFiles = Array.from(event.target.files);
            this.updateCreateTorrentButton();
            this.log(`Selected ${this.selectedFiles.length} file(s)`, 'info');
        });
        
        // Create torrent button
        document.getElementById('createTorrent').addEventListener('click', () => {
            this.createTorrent();
        });
        
        // Download torrent button
        document.getElementById('downloadTorrent').addEventListener('click', () => {
            const hash = document.getElementById('torrentHash').value.trim();
            if (hash) {
                this.downloadTorrent(hash);
            }
        });
        
        // Torrent hash input
        document.getElementById('torrentHash').addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                const hash = event.target.value.trim();
                if (hash) {
                    this.downloadTorrent(hash);
                }
            }
        });
    }
    
    setupP2PEventHandlers() {
        this.p2pClient.on('connected', () => {
            this.log('Connected to signaling server', 'success');
        });
        
        this.p2pClient.on('disconnected', () => {
            this.log('Disconnected from signaling server', 'warning');
        });
        
        this.p2pClient.on('peer-connected', (peerId) => {
            this.log(`Connected to peer: ${peerId.substring(0, 8)}...`, 'success');
            this.updatePeerList();
        });
        
        this.p2pClient.on('peer-disconnected', (peerId) => {
            this.log(`Disconnected from peer: ${peerId.substring(0, 8)}...`, 'warning');
            this.updatePeerList();
        });
        
        this.p2pClient.on('file-added', (data) => {
            this.log(`Sharing file: ${data.fileName}`, 'info');
            this.updateActiveTransfers();
        });
        
        this.p2pClient.on('download-started', (data) => {
            this.log(`Started download: ${data.fileName}`, 'info');
            this.updateActiveTransfers();
        });
        
        this.p2pClient.on('download-complete', (data) => {
            this.log(`Download complete: ${data.fileName}`, 'success');
            this.updateActiveTransfers();
        });
        
        this.p2pClient.on('chunk-received', (data) => {
            this.updateActiveTransfers();
        });
        
        this.p2pClient.on('chunk-sent', (data) => {
            this.updateActiveTransfers();
        });
    }
    
    updateCreateTorrentButton() {
        const button = document.getElementById('createTorrent');
        button.disabled = this.selectedFiles.length === 0;
    }
    
    async createTorrent() {
        if (this.selectedFiles.length === 0) return;
        
        try {
            this.log('Creating torrent...', 'info');
            const torrent = await this.torrentManager.createTorrent(this.selectedFiles);
            
            this.activeTorrents.set(torrent.hash, torrent);
            
            this.log(`Torrent created: ${torrent.hash}`, 'success');
            this.log(`Share this hash: ${torrent.hash}`, 'info');
            
            // Clear file input
            document.getElementById('fileInput').value = '';
            this.selectedFiles = [];
            this.updateCreateTorrentButton();
            
            this.updateActiveTransfers();
            
        } catch (error) {
            this.log(`Error creating torrent: ${error.message}`, 'error');
        }
    }
    
    downloadTorrent(hash) {
        try {
            this.log(`Starting download for hash: ${hash}`, 'info');
            
            if (this.torrentManager.startDownload(hash)) {
                document.getElementById('torrentHash').value = '';
                this.updateActiveTransfers();
            } else {
                this.log('Failed to start download', 'error');
            }
            
        } catch (error) {
            this.log(`Error starting download: ${error.message}`, 'error');
        }
    }
    
    updateStats() {
        const stats = this.p2pClient.getStats();
        const webrtcStats = this.webrtcManager.getConnectionStats();
        const connectedPeers = this.p2pClient.getConnectedPeers();
        
        document.getElementById('peerCount').textContent = connectedPeers.length;
        document.getElementById('uploadSpeed').textContent = this.formatSpeed(stats.uploadSpeed);
        document.getElementById('downloadSpeed').textContent = this.formatSpeed(stats.downloadSpeed);
        document.getElementById('totalFiles').textContent = this.activeTorrents.size;
    }
    
    updatePeerList() {
        const peerList = document.getElementById('peerList');
        const connectedPeers = this.p2pClient.getConnectedPeers();
        
        if (connectedPeers.length === 0) {
            peerList.innerHTML = '<div style="text-align: center; opacity: 0.6; padding: 20px;">No peers connected</div>';
            return;
        }
        
        peerList.innerHTML = connectedPeers.map(peer => `
            <div class="peer-item">
                <span>Peer: ${peer.peerId.substring(0, 12)}...</span>
                <span class="peer-status status-${peer.status}">${peer.status}</span>
            </div>
        `).join('');
    }
    
    updateActiveTransfers() {
        const transfersContainer = document.getElementById('activeTransfers');
        const activeTorrents = this.torrentManager.getActiveTorrents();
        
        if (activeTorrents.length === 0) {
            transfersContainer.innerHTML = '<div style="text-align: center; opacity: 0.6; padding: 20px;">No active transfers</div>';
            return;
        }
        
        transfersContainer.innerHTML = activeTorrents.map(torrent => {
            if (torrent.type === 'upload') {
                return this.renderUploadTorrent(torrent);
            } else {
                return this.renderDownloadTorrent(torrent);
            }
        }).join('');
    }
    
    renderUploadTorrent(torrent) {
        return `
            <div class="file-item">
                <div class="file-name">📤 Sharing: ${torrent.files.map(f => f.name).join(', ')}</div>
                <div class="file-info">
                    <span>Size: ${this.formatBytes(torrent.totalSize)}</span>
                    <span>Peers: ${torrent.peers}</span>
                    <span>Hash: ${torrent.hash.substring(0, 16)}...</span>
                </div>
                <div class="chunk-grid">
                    ${Array(20).fill().map(() => '<div class="chunk chunk-complete"></div>').join('')}
                </div>
            </div>
        `;
    }
    
    renderDownloadTorrent(torrent) {
        const progress = torrent.progress || { progress: 0, downloadedChunks: 0, totalChunks: 1 };
        const chunks = Array(20).fill().map((_, i) => {
            const chunkProgress = (i + 1) / 20;
            if (chunkProgress <= progress.progress / 100) {
                return '<div class="chunk chunk-complete"></div>';
            } else {
                return '<div class="chunk chunk-missing"></div>';
            }
        });
        
        return `
            <div class="file-item">
                <div class="file-name">📥 Downloading: ${torrent.fileName}</div>
                <div class="file-info">
                    <span>Size: ${this.formatBytes(torrent.fileSize)}</span>
                    <span>Progress: ${progress.progress.toFixed(1)}%</span>
                    <span>Peers: ${torrent.peers}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress.progress}%"></div>
                </div>
                <div class="chunk-grid">
                    ${chunks.join('')}
                </div>
            </div>
        `;
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    formatSpeed(bytesPerSecond) {
        return this.formatBytes(bytesPerSecond) + '/s';
    }
    
    log(message, type = 'info') {
        const logContainer = document.getElementById('logContainer');
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
        
        // Keep only last 100 log entries
        while (logContainer.children.length > 100) {
            logContainer.removeChild(logContainer.firstChild);
        }
    }
    
    startStatsUpdate() {
        setInterval(() => {
            this.updateStats();
        }, 1000);
        
        // Update transfers less frequently
        setInterval(() => {
            this.updateActiveTransfers();
        }, 2000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.p2pApp = new P2PTorrentApp();
});