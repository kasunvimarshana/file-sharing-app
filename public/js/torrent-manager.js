class TorrentManager {
    constructor(p2pClient) {
        this.p2pClient = p2pClient;
        this.chunkSize = 64 * 1024; // 64KB chunks
        this.torrents = new Map();
        this.activeDownloads = new Map();
        this.activeUploads = new Map();
    }
    
    async createTorrent(files) {
        const torrentData = {
            files: [],
            totalSize: 0,
            createdAt: Date.now(),
            chunks: []
        };
        
        for (const file of files) {
            const fileChunks = await this.chunkFile(file);
            const fileHash = this.p2pClient.generateFileHash(file.name + file.size);
            
            torrentData.files.push({
                name: file.name,
                size: file.size,
                hash: fileHash,
                chunks: fileChunks.length
            });
            
            torrentData.totalSize += file.size;
            torrentData.chunks.push(...fileChunks);
            
            // Add file to P2P client
            this.p2pClient.addFile(file, fileChunks);
        }
        
        const torrentHash = this.generateTorrentHash(torrentData);
        this.torrents.set(torrentHash, torrentData);
        
        return {
            hash: torrentHash,
            data: torrentData
        };
    }
    
    async chunkFile(file) {
        return new Promise((resolve) => {
            const chunks = [];
            const reader = new FileReader();
            let offset = 0;
            
            const readChunk = () => {
                if (offset >= file.size) {
                    resolve(chunks);
                    return;
                }
                
                const slice = file.slice(offset, offset + this.chunkSize);
                reader.readAsArrayBuffer(slice);
            };
            
            reader.onload = (event) => {
                chunks.push(new Uint8Array(event.target.result));
                offset += this.chunkSize;
                readChunk();
            };
            
            readChunk();
        });
    }
    
    generateTorrentHash(torrentData) {
        const hashInput = JSON.stringify({
            files: torrentData.files.map(f => ({ name: f.name, size: f.size })),
            totalSize: torrentData.totalSize,
            createdAt: torrentData.createdAt
        });
        
        return this.p2pClient.generateFileHash(hashInput);
    }
    
    startDownload(torrentHash) {
        // In a real implementation, this would fetch torrent metadata from peers
        // For now, we'll simulate with a basic file download
        const fileName = `file_${torrentHash.substring(0, 8)}.dat`;
        const fileSize = 1024 * 1024; // 1MB default
        const totalChunks = Math.ceil(fileSize / this.chunkSize);
        
        this.p2pClient.startDownload(torrentHash, fileName, fileSize, totalChunks);
        
        this.activeDownloads.set(torrentHash, {
            fileName,
            fileSize,
            totalChunks,
            downloadedChunks: 0,
            startTime: Date.now(),
            peers: new Set()
        });
        
        return true;
    }
    
    pauseDownload(torrentHash) {
        // Implementation for pausing downloads
        this.activeDownloads.delete(torrentHash);
    }
    
    resumeDownload(torrentHash) {
        // Implementation for resuming downloads
        return this.startDownload(torrentHash);
    }
    
    getDownloadProgress(torrentHash) {
        const download = this.activeDownloads.get(torrentHash);
        if (!download) return null;
        
        return {
            fileName: download.fileName,
            fileSize: download.fileSize,
            downloadedChunks: download.downloadedChunks,
            totalChunks: download.totalChunks,
            progress: (download.downloadedChunks / download.totalChunks) * 100,
            peers: download.peers.size,
            speed: this.calculateDownloadSpeed(torrentHash)
        };
    }
    
    calculateDownloadSpeed(torrentHash) {
        // Simple speed calculation based on recent chunk transfers
        return Math.floor(Math.random() * 500) + 50; // Simulated for demo
    }
    
    getActiveTorrents() {
        const torrents = [];
        
        for (const [hash, data] of this.torrents) {
            torrents.push({
                hash,
                type: 'upload',
                files: data.files,
                totalSize: data.totalSize,
                peers: this.p2pClient.getConnectedPeers().length
            });
        }
        
        for (const [hash, data] of this.activeDownloads) {
            torrents.push({
                hash,
                type: 'download',
                fileName: data.fileName,
                fileSize: data.fileSize,
                progress: this.getDownloadProgress(hash),
                peers: data.peers.size
            });
        }
        
        return torrents;
    }
}