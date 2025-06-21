class WebRTCManager {
    constructor() {
        this.connections = new Map();
        this.dataChannels = new Map();
        this.iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ];
        
        this.stats = {
            connectionsAttempted: 0,
            connectionsSuccessful: 0,
            connectionsActive: 0,
            bytesTransferred: 0
        };
    }
    
    async createConnection(peerId, isInitiator = false) {
        if (this.connections.has(peerId)) {
            return this.connections.get(peerId);
        }
        
        const connection = new RTCPeerConnection({
            iceServers: this.iceServers,
            iceCandidatePoolSize: 10
        });
        
        this.stats.connectionsAttempted++;
        
        // Set up connection event handlers
        this.setupConnectionHandlers(connection, peerId);
        
        // Create data channel if initiator
        if (isInitiator) {
            const dataChannel = connection.createDataChannel('p2p-channel', {
                ordered: false,
                maxRetransmits: 0
            });
            
            this.setupDataChannelHandlers(dataChannel, peerId);
            this.dataChannels.set(peerId, dataChannel);
        }
        
        // Handle incoming data channels
        connection.ondatachannel = (event) => {
            const dataChannel = event.channel;
            this.setupDataChannelHandlers(dataChannel, peerId);
            this.dataChannels.set(peerId, dataChannel);
        };
        
        this.connections.set(peerId, connection);
        return connection;
    }
    
    setupConnectionHandlers(connection, peerId) {
        connection.onconnectionstatechange = () => {
            console.log(`Connection state with ${peerId}: ${connection.connectionState}`);
            
            if (connection.connectionState === 'connected') {
                this.stats.connectionsSuccessful++;
                this.stats.connectionsActive++;
            } else if (connection.connectionState === 'disconnected' || 
                      connection.connectionState === 'failed') {
                this.stats.connectionsActive = Math.max(0, this.stats.connectionsActive - 1);
                this.connections.delete(peerId);
                this.dataChannels.delete(peerId);
            }
        };
        
        connection.oniceconnectionstatechange = () => {
            console.log(`ICE connection state with ${peerId}: ${connection.iceConnectionState}`);
        };
        
        connection.onicegatheringstatechange = () => {
            console.log(`ICE gathering state with ${peerId}: ${connection.iceGatheringState}`);
        };
    }
    
    setupDataChannelHandlers(dataChannel, peerId) {
        dataChannel.onopen = () => {
            console.log(`Data channel opened with ${peerId}`);
        };
        
        dataChannel.onclose = () => {
            console.log(`Data channel closed with ${peerId}`);
        };
        
        dataChannel.onerror = (error) => {
            console.error(`Data channel error with ${peerId}:`, error);
        };
        
        dataChannel.onmessage = (event) => {
            this.stats.bytesTransferred += event.data.length;
            // Message handling is delegated to the P2P client
        };
    }
    
    async createOffer(peerId) {
        const connection = await this.createConnection(peerId, true);
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        return offer;
    }
    
    async createAnswer(peerId, offer) {
        const connection = await this.createConnection(peerId, false);
        await connection.setRemoteDescription(offer);
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        return answer;
    }
    
    async handleAnswer(peerId, answer) {
        const connection = this.connections.get(peerId);
        if (connection) {
            await connection.setRemoteDescription(answer);
        }
    }
    
    async addIceCandidate(peerId, candidate) {
        const connection = this.connections.get(peerId);
        if (connection) {
            await connection.addIceCandidate(candidate);
        }
    }
    
    sendData(peerId, data) {
        const dataChannel = this.dataChannels.get(peerId);
        if (dataChannel && dataChannel.readyState === 'open') {
            try {
                dataChannel.send(data);
                this.stats.bytesTransferred += data.length;
                return true;
            } catch (error) {
                console.error('Error sending data:', error);
                return false;
            }
        }
        return false;
    }
    
    closeConnection(peerId) {
        const connection = this.connections.get(peerId);
        if (connection) {
            connection.close();
        }
        
        const dataChannel = this.dataChannels.get(peerId);
        if (dataChannel) {
            dataChannel.close();
        }
        
        this.connections.delete(peerId);
        this.dataChannels.delete(peerId);
    }
    
    getConnectionStats() {
        return {
            ...this.stats,
            activeConnections: this.connections.size,
            activeDataChannels: this.dataChannels.size
        };
    }
    
    getConnectedPeers() {
        const peers = [];
        for (const [peerId, connection] of this.connections) {
            peers.push({
                peerId,
                connectionState: connection.connectionState,
                iceConnectionState: connection.iceConnectionState,
                hasDataChannel: this.dataChannels.has(peerId)
            });
        }
        return peers;
    }
}