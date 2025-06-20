export class P2PManager {
  constructor(signalingClient) {
    this.signalingClient = signalingClient;
    this.connections = new Map();
    this.sharedFiles = new Map();
    this.downloads = new Map();
    this.eventHandlers = new Map();
    
    this.setupSignalingHandlers();
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:localhost:3478' },
        { urls: 'turn:localhost:3478', username: 'user', credential: 'pass' }
      ]
    };
  }

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  emit(event, data) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  setupSignalingHandlers() {
    this.signalingClient.on('offer', this.handleOffer.bind(this));
    this.signalingClient.on('answer', this.handleAnswer.bind(this));
    this.signalingClient.on('ice-candidate', this.handleIceCandidate.bind(this));
    this.signalingClient.on('peer-joined', this.connectToPeer.bind(this));
  }

  async connectToPeer(peer) {
    try {
      const peerConnection = new RTCPeerConnection(this.rtcConfig);
      this.connections.set(peer.id, peerConnection);

      // Set up data channel
      const dataChannel = peerConnection.createDataChannel('fileTransfer', {
        ordered: true
      });
      this.setupDataChannel(dataChannel, peer.id);

      // Handle incoming data channels
      peerConnection.ondatachannel = (event) => {
        this.setupDataChannel(event.channel, peer.id);
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.signalingClient.send('ice-candidate', {
            target: peer.id,
            candidate: event.candidate
          });
        }
      };

      // Create and send offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      this.signalingClient.send('offer', {
        target: peer.id,
        offer: offer
      });

    } catch (error) {
      console.error('Failed to connect to peer:', error);
    }
  }

  async handleOffer(data) {
    try {
      const peerConnection = new RTCPeerConnection(this.rtcConfig);
      this.connections.set(data.from, peerConnection);

      // Handle incoming data channels
      peerConnection.ondatachannel = (event) => {
        this.setupDataChannel(event.channel, data.from);
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.signalingClient.send('ice-candidate', {
            target: data.from,
            candidate: event.candidate
          });
        }
      };

      await peerConnection.setRemoteDescription(data.offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      this.signalingClient.send('answer', {
        target: data.from,
        answer: answer
      });

    } catch (error) {
      console.error('Failed to handle offer:', error);
    }
  }

  async handleAnswer(data) {
    try {
      const peerConnection = this.connections.get(data.from);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(data.answer);
      }
    } catch (error) {
      console.error('Failed to handle answer:', error);
    }
  }

  async handleIceCandidate(data) {
    try {
      const peerConnection = this.connections.get(data.from);
      if (peerConnection) {
        await peerConnection.addIceCandidate(data.candidate);
      }
    } catch (error) {
      console.error('Failed to handle ICE candidate:', error);
    }
  }

  setupDataChannel(dataChannel, peerId) {
    dataChannel.onopen = () => {
      console.log(`Data channel opened with peer ${peerId}`);
    };

    dataChannel.onmessage = (event) => {
      this.handleDataChannelMessage(event.data, peerId);
    };

    dataChannel.onerror = (error) => {
      console.error(`Data channel error with peer ${peerId}:`, error);
    };

    dataChannel.onclose = () => {
      console.log(`Data channel closed with peer ${peerId}`);
    };

    // Store reference to data channel
    const peerConnection = this.connections.get(peerId);
    if (peerConnection) {
      peerConnection.dataChannel = dataChannel;
    }
  }

  async handleDataChannelMessage(data, peerId) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'file-list-request':
          this.sendFileList(peerId);
          break;
        case 'file-list':
          this.handleFileList(message.files, peerId);
          break;
        case 'file-request':
          this.handleFileRequest(message.fileId, peerId);
          break;
        case 'file-chunk':
          this.handleFileChunk(message, peerId);
          break;
        case 'file-info':
          this.handleFileInfo(message.fileInfo, peerId);
          break;
      }
    } catch (error) {
      console.error('Failed to handle data channel message:', error);
    }
  }

  async shareFile(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hash = await this.calculateFileHash(arrayBuffer);
      
      const fileInfo = {
        id: hash,
        name: file.name,
        size: file.size,
        type: file.type,
        hash: hash,
        timestamp: Date.now(),
        chunks: this.createFileChunks(arrayBuffer)
      };

      this.sharedFiles.set(hash, fileInfo);
      this.emit('file-shared', {
        id: hash,
        name: file.name,
        size: file.size,
        hash: hash,
        timestamp: Date.now(),
        seeders: 1
      });

      // Broadcast file availability to connected peers
      this.broadcastFileAvailability(fileInfo);

    } catch (error) {
      console.error('Failed to share file:', error);
    }
  }

  createFileChunks(arrayBuffer, chunkSize = 16384) {
    const chunks = [];
    for (let i = 0; i < arrayBuffer.byteLength; i += chunkSize) {
      chunks.push(arrayBuffer.slice(i, i + chunkSize));
    }
    return chunks;
  }

  async calculateFileHash(arrayBuffer) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  broadcastFileAvailability(fileInfo) {
    const message = JSON.stringify({
      type: 'file-info',
      fileInfo: {
        id: fileInfo.id,
        name: fileInfo.name,
        size: fileInfo.size,
        hash: fileInfo.hash,
        timestamp: fileInfo.timestamp
      }
    });

    this.connections.forEach((connection, peerId) => {
      if (connection.dataChannel && connection.dataChannel.readyState === 'open') {
        connection.dataChannel.send(message);
      }
    });
  }

  sendFileList(peerId) {
    const fileList = Array.from(this.sharedFiles.values()).map(file => ({
      id: file.id,
      name: file.name,
      size: file.size,
      hash: file.hash,
      timestamp: file.timestamp
    }));

    const message = JSON.stringify({
      type: 'file-list',
      files: fileList
    });

    const connection = this.connections.get(peerId);
    if (connection && connection.dataChannel && connection.dataChannel.readyState === 'open') {
      connection.dataChannel.send(message);
    }
  }

  handleFileList(files, peerId) {
    files.forEach(file => {
      this.emit('file-shared', {
        ...file,
        seeders: 1,
        peerId: peerId
      });
    });
  }

  handleFileInfo(fileInfo, peerId) {
    this.emit('file-shared', {
      ...fileInfo,
      seeders: 1,
      peerId: peerId
    });
  }

  async downloadFile(fileId) {
    try {
      // Find peers that have this file
      const availablePeers = [];
      for (const [peerId, connection] of this.connections) {
        if (connection.dataChannel && connection.dataChannel.readyState === 'open') {
          availablePeers.push(peerId);
        }
      }

      if (availablePeers.length === 0) {
        throw new Error('No peers available for download');
      }

      // Request file from first available peer
      const peerId = availablePeers[0];
      const message = JSON.stringify({
        type: 'file-request',
        fileId: fileId
      });

      const connection = this.connections.get(peerId);
      if (connection && connection.dataChannel) {
        connection.dataChannel.send(message);
        
        // Track download
        const downloadInfo = {
          id: fileId,
          progress: 0,
          status: 'downloading',
          speed: 0,
          peers: [peerId],
          startTime: Date.now()
        };
        
        this.downloads.set(fileId, downloadInfo);
        this.emit('transfer-progress', downloadInfo);
      }

    } catch (error) {
      console.error('Failed to download file:', error);
    }
  }

  handleFileRequest(fileId, peerId) {
    const fileInfo = this.sharedFiles.get(fileId);
    if (fileInfo) {
      // Send file chunks
      this.sendFileChunks(fileInfo, peerId);
    }
  }

  async sendFileChunks(fileInfo, peerId) {
    const connection = this.connections.get(peerId);
    if (!connection || !connection.dataChannel || connection.dataChannel.readyState !== 'open') {
      return;
    }

    try {
      for (let i = 0; i < fileInfo.chunks.length; i++) {
        const chunk = fileInfo.chunks[i];
        const message = JSON.stringify({
          type: 'file-chunk',
          fileId: fileInfo.id,
          chunkIndex: i,
          totalChunks: fileInfo.chunks.length,
          data: Array.from(new Uint8Array(chunk))
        });

        connection.dataChannel.send(message);
        
        // Add small delay to prevent overwhelming the connection
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } catch (error) {
      console.error('Failed to send file chunks:', error);
    }
  }

  handleFileChunk(message, peerId) {
    const { fileId, chunkIndex, totalChunks, data } = message;
    
    if (!this.downloads.has(fileId)) {
      this.downloads.set(fileId, {
        id: fileId,
        chunks: new Map(),
        totalChunks: totalChunks,
        receivedChunks: 0,
        progress: 0,
        status: 'downloading',
        startTime: Date.now()
      });
    }

    const download = this.downloads.get(fileId);
    download.chunks.set(chunkIndex, new Uint8Array(data));
    download.receivedChunks++;
    download.progress = (download.receivedChunks / totalChunks) * 100;

    // Calculate speed
    const elapsed = (Date.now() - download.startTime) / 1000;
    const bytesReceived = download.receivedChunks * 16384; // Approximate
    download.speed = bytesReceived / elapsed;

    this.emit('transfer-progress', download);

    // Check if download is complete
    if (download.receivedChunks === totalChunks) {
      this.completeDownload(fileId);
    }
  }

  completeDownload(fileId) {
    const download = this.downloads.get(fileId);
    if (!download) return;

    try {
      // Reconstruct file from chunks
      const sortedChunks = Array.from(download.chunks.entries())
        .sort(([a], [b]) => a - b)
        .map(([, chunk]) => chunk);

      const totalSize = sortedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const fileData = new Uint8Array(totalSize);
      let offset = 0;

      for (const chunk of sortedChunks) {
        fileData.set(chunk, offset);
        offset += chunk.length;
      }

      // Trigger download in browser
      const blob = new Blob([fileData]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `downloaded_${fileId.slice(0, 8)}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      download.status = 'completed';
      download.progress = 100;
      this.emit('transfer-progress', download);

    } catch (error) {
      console.error('Failed to complete download:', error);
      download.status = 'error';
      this.emit('transfer-progress', download);
    }
  }

  cleanup() {
    this.connections.forEach((connection) => {
      if (connection.dataChannel) {
        connection.dataChannel.close();
      }
      connection.close();
    });
    this.connections.clear();
    this.sharedFiles.clear();
    this.downloads.clear();
  }
}