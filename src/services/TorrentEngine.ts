import { TorrentParser } from '../utils/torrentParser';
import { TrackerClient } from './TrackerClient';
import { PeerConnectionManager } from './PeerConnection';
import { TorrentCrypto } from '../utils/crypto';
import type { TorrentFile, TorrentState, Piece, Peer } from '../types/torrent';

export class TorrentEngine {
  private torrents: Map<string, TorrentState> = new Map();
  private trackerClient: TrackerClient;
  private peerManager: PeerConnectionManager;
  private downloadProgressCallback?: (infoHash: string, progress: number) => void;
  private torrentUpdateCallback?: (infoHash: string, state: TorrentState) => void;
  private downloadLoops: Map<string, NodeJS.Timeout> = new Map();
  private statsUpdateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.trackerClient = new TrackerClient();
    this.peerManager = new PeerConnectionManager();
    
    this.peerManager.setPeerConnectedCallback(this.handlePeerConnected.bind(this));
    this.peerManager.setPeerDisconnectedCallback(this.handlePeerDisconnected.bind(this));
    this.peerManager.setPieceReceivedCallback(this.handlePieceReceived.bind(this));
    this.peerManager.setPeerMessageCallback(this.handlePeerMessage.bind(this));

    this.startStatsUpdate();
  }

  setDownloadProgressCallback(callback: (infoHash: string, progress: number) => void) {
    this.downloadProgressCallback = callback;
  }

  setTorrentUpdateCallback(callback: (infoHash: string, state: TorrentState) => void) {
    this.torrentUpdateCallback = callback;
  }

  async addTorrent(file: File): Promise<string> {
    try {
      const torrent = await TorrentParser.parseTorrentFile(file);
      
      // Validate torrent
      if (!await TorrentParser.validateTorrent(torrent)) {
        throw new Error('Invalid torrent file');
      }

      const pieces = TorrentParser.createPieces(torrent);
      
      const totalLength = torrent.info.length || 
        torrent.info.files?.reduce((sum, file) => sum + file.length, 0) || 0;

      const state: TorrentState = {
        torrent,
        pieces,
        peers: [],
        downloaded: 0,
        uploaded: 0,
        left: totalLength,
        status: 'stopped',
        downloadSpeed: 0,
        uploadSpeed: 0,
        eta: Infinity
      };

      this.torrents.set(torrent.infoHash, state);
      this.notifyTorrentUpdate(torrent.infoHash, state);
      
      console.log(`Added torrent: ${torrent.info.name} (${torrent.infoHash})`);
      return torrent.infoHash;
    } catch (error) {
      console.error('Failed to add torrent:', error);
      throw error;
    }
  }

  async startDownload(infoHash: string) {
    const state = this.torrents.get(infoHash);
    if (!state) {
      console.error('Torrent not found:', infoHash);
      return;
    }

    if (state.status === 'downloading') {
      console.log('Torrent already downloading:', infoHash);
      return;
    }

    console.log('Starting download for:', state.torrent.info.name);
    state.status = 'downloading';
    this.peerManager.setTorrent(state.torrent);
    
    // Announce to tracker
    try {
      const trackerResponse = await this.trackerClient.announce(
        state.torrent,
        state.downloaded,
        state.uploaded,
        state.left,
        'started'
      );

      console.log(`Tracker response: ${trackerResponse.peers.length} peers, ${trackerResponse.complete} seeders`);

      // Add tracker peers to state
      for (const trackerPeer of trackerResponse.peers) {
        const existingPeer = state.peers.find(p => p.id === trackerPeer.peerId);
        if (!existingPeer) {
          const peer: Peer = {
            id: trackerPeer.peerId,
            ip: trackerPeer.ip,
            port: trackerPeer.port,
            connected: false,
            uploaded: 0,
            downloaded: 0,
            lastSeen: Date.now()
          };
          state.peers.push(peer);
        }
      }

    } catch (error) {
      console.error('Failed to announce to tracker:', error);
    }

    // Join WebRTC swarm
    this.peerManager.joinSwarm(infoHash);
    
    this.notifyTorrentUpdate(infoHash, state);
    this.startDownloadLoop(infoHash);
  }

  async stopDownload(infoHash: string) {
    const state = this.torrents.get(infoHash);
    if (!state) return;

    console.log('Stopping download for:', state.torrent.info.name);
    state.status = 'stopped';
    
    // Clear download loop
    const loop = this.downloadLoops.get(infoHash);
    if (loop) {
      clearTimeout(loop);
      this.downloadLoops.delete(infoHash);
    }
    
    try {
      await this.trackerClient.announce(
        state.torrent,
        state.downloaded,
        state.uploaded,
        state.left,
        'stopped'
      );
    } catch (error) {
      console.error('Failed to announce stop to tracker:', error);
    }

    this.peerManager.leaveSwarm(infoHash);
    this.notifyTorrentUpdate(infoHash, state);
  }

  async removeTorrent(infoHash: string) {
    await this.stopDownload(infoHash);
    this.torrents.delete(infoHash);
    console.log('Removed torrent:', infoHash);
  }

  private startDownloadLoop(infoHash: string) {
    const loop = () => {
      const state = this.torrents.get(infoHash);
      if (!state || state.status !== 'downloading') return;

      // Check if download is complete
      const completedPieces = state.pieces.filter(p => p.downloaded && p.verified).length;
      const totalPieces = state.pieces.length;
      
      if (completedPieces === totalPieces && totalPieces > 0) {
        state.status = 'completed';
        state.left = 0;
        console.log('Download completed:', state.torrent.info.name);
        
        // Announce completion
        this.trackerClient.announce(
          state.torrent,
          state.downloaded,
          state.uploaded,
          state.left,
          'completed'
        ).catch(console.error);
        
        this.notifyTorrentUpdate(infoHash, state);
        return;
      }

      // Find pieces to download
      const neededPieces = state.pieces.filter(piece => 
        !piece.downloaded && 
        !piece.blocks.every(block => block.requested)
      );

      if (neededPieces.length > 0) {
        // Request pieces from connected peers
        const connectedPeers = state.peers.filter(peer => peer.connected);
        
        if (connectedPeers.length > 0) {
          const piecesToRequest = neededPieces.slice(0, Math.min(5, connectedPeers.length));
          
          for (let i = 0; i < piecesToRequest.length; i++) {
            const piece = piecesToRequest[i];
            const peer = connectedPeers[i % connectedPeers.length];
            this.requestPieceFromPeer(peer.id, piece);
          }
        }
      }

      // Schedule next iteration
      const timeout = setTimeout(loop, 2000); // Check every 2 seconds
      this.downloadLoops.set(infoHash, timeout);
    };

    loop();
  }

  private requestPieceFromPeer(peerId: string, piece: Piece) {
    // Request all blocks in the piece
    for (const block of piece.blocks) {
      if (!block.requested && !block.downloaded) {
        this.peerManager.requestPiece(peerId, piece.index, block.offset, block.length);
        block.requested = true;
      }
    }
  }

  private handlePeerConnected(peer: Peer) {
    console.log(`Peer connected: ${peer.id}`);
    
    // Add peer to all active torrents
    for (const [infoHash, state] of this.torrents) {
      if (state.status === 'downloading' || state.status === 'seeding') {
        const existingPeer = state.peers.find(p => p.id === peer.id);
        if (existingPeer) {
          existingPeer.connected = true;
          existingPeer.lastSeen = Date.now();
        } else {
          state.peers.push({ ...peer, connected: true });
        }
        this.notifyTorrentUpdate(infoHash, state);
      }
    }
  }

  private handlePeerDisconnected(peerId: string) {
    console.log(`Peer disconnected: ${peerId}`);
    
    for (const [infoHash, state] of this.torrents) {
      const peer = state.peers.find(p => p.id === peerId);
      if (peer) {
        peer.connected = false;
        peer.lastSeen = Date.now();
        this.notifyTorrentUpdate(infoHash, state);
      }
    }
  }

  private handlePeerMessage(peerId: string, message: any) {
    console.log(`Message from ${peerId}:`, message.type);
    
    // Handle different message types
    switch (message.type) {
      case 'have':
        this.handleHaveMessage(peerId, message);
        break;
      case 'bitfield':
        this.handleBitfieldMessage(peerId, message);
        break;
      case 'request':
        this.handlePieceRequest(peerId, message);
        break;
      case 'piece':
        this.handlePieceData(peerId, message);
        break;
    }
  }

  private handleHaveMessage(peerId: string, message: any) {
    // Update peer's available pieces
    for (const [infoHash, state] of this.torrents) {
      const peer = state.peers.find(p => p.id === peerId);
      if (peer) {
        // Mark that this peer has the piece
        console.log(`Peer ${peerId} has piece ${message.pieceIndex}`);
      }
    }
  }

  private handleBitfieldMessage(peerId: string, message: any) {
    // Update peer's complete bitfield
    console.log(`Received bitfield from ${peerId}`);
  }

  private handlePieceRequest(peerId: string, message: any) {
    const { infoHash, pieceIndex, offset, length } = message;
    console.log(`Peer ${peerId} requested piece ${pieceIndex}, offset ${offset}, length ${length}`);
    
    const state = this.torrents.get(infoHash);
    if (!state) return;

    const piece = state.pieces[pieceIndex];
    if (piece && piece.downloaded && piece.verified && piece.data) {
      // Send piece data
      const blockData = piece.data.slice(offset, offset + length);
      this.peerManager.sendToPeer(peerId, {
        type: 'piece',
        infoHash,
        pieceIndex,
        offset,
        data: Array.from(blockData)
      });

      // Update upload stats
      const peer = state.peers.find(p => p.id === peerId);
      if (peer) {
        peer.uploaded += blockData.length;
        state.uploaded += blockData.length;
      }
    }
  }

  private async handlePieceData(peerId: string, message: any) {
    const { infoHash, pieceIndex, offset, data } = message;
    
    const state = this.torrents.get(infoHash);
    if (!state) return;

    const piece = state.pieces[pieceIndex];
    if (!piece) return;

    // Find the corresponding block
    const block = piece.blocks.find(b => b.offset === offset);
    if (!block || block.downloaded) return;

    // Store block data
    block.data = new Uint8Array(data);
    block.downloaded = true;
    block.requested = false;

    // Update download stats
    const peer = state.peers.find(p => p.id === peerId);
    if (peer) {
      peer.downloaded += block.data.length;
      state.downloaded += block.data.length;
      state.left = Math.max(0, state.left - block.data.length);
    }

    // Check if piece is complete
    const allBlocksDownloaded = piece.blocks.every(b => b.downloaded);
    if (allBlocksDownloaded) {
      // Reconstruct piece data
      const pieceData = new Uint8Array(piece.length);
      let offset = 0;
      
      for (const block of piece.blocks) {
        if (block.data) {
          pieceData.set(block.data, offset);
          offset += block.data.length;
        }
      }

      // Verify piece hash
      const hash = await TorrentCrypto.sha1(pieceData);
      if (this.arraysEqual(hash, piece.hash)) {
        piece.data = pieceData;
        piece.downloaded = true;
        piece.verified = true;
        
        console.log(`Piece ${pieceIndex} completed and verified`);
        
        // Notify other peers that we have this piece
        this.broadcastHaveMessage(infoHash, pieceIndex);
        
        // Update progress
        const progress = state.downloaded / (state.downloaded + state.left);
        if (this.downloadProgressCallback) {
          this.downloadProgressCallback(infoHash, progress);
        }
      } else {
        console.error(`Piece ${pieceIndex} hash verification failed`);
        // Reset piece for re-download
        piece.blocks.forEach(block => {
          block.downloaded = false;
          block.requested = false;
          block.data = undefined;
        });
      }
    }

    this.notifyTorrentUpdate(infoHash, state);
  }

  private broadcastHaveMessage(infoHash: string, pieceIndex: number) {
    const state = this.torrents.get(infoHash);
    if (!state) return;

    const connectedPeers = state.peers.filter(p => p.connected);
    for (const peer of connectedPeers) {
      this.peerManager.sendToPeer(peer.id, {
        type: 'have',
        infoHash,
        pieceIndex
      });
    }
  }

  private async handlePieceReceived(piece: Piece) {
    // This method is called when a complete piece is received
    console.log(`Piece ${piece.index} received`);
  }

  private arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  private startStatsUpdate() {
    this.statsUpdateInterval = setInterval(() => {
      this.updateTorrentStats();
    }, 1000);
  }

  private updateTorrentStats() {
    for (const [infoHash, state] of this.torrents) {
      if (state.status === 'downloading') {
        // Calculate download/upload speeds (simplified)
        const connectedPeers = state.peers.filter(p => p.connected);
        
        // Estimate ETA
        if (state.downloadSpeed > 0 && state.left > 0) {
          state.eta = state.left / state.downloadSpeed;
        } else {
          state.eta = Infinity;
        }

        // Update speeds (this is a simplified calculation)
        state.downloadSpeed = connectedPeers.reduce((sum, peer) => sum + (peer.downloaded / 10), 0);
        state.uploadSpeed = connectedPeers.reduce((sum, peer) => sum + (peer.uploaded / 10), 0);
      }
    }
  }

  private notifyTorrentUpdate(infoHash: string, state: TorrentState) {
    if (this.torrentUpdateCallback) {
      // Create a deep copy to avoid reference issues
      const stateCopy = {
        ...state,
        peers: state.peers.map(peer => ({ ...peer })),
        pieces: state.pieces.map(piece => ({ ...piece }))
      };
      this.torrentUpdateCallback(infoHash, stateCopy);
    }
  }

  getTorrentState(infoHash: string): TorrentState | undefined {
    return this.torrents.get(infoHash);
  }

  getAllTorrents(): TorrentState[] {
    return Array.from(this.torrents.values());
  }

  async createTorrent(files: File[], announce: string, comment?: string): Promise<Uint8Array> {
    return await TorrentParser.createTorrentFile(files, announce, comment);
  }

  getTrackerClient(): TrackerClient {
    return this.trackerClient;
  }

  getPeerManager(): PeerConnectionManager {
    return this.peerManager;
  }

  destroy() {
    // Clear all download loops
    for (const timeout of this.downloadLoops.values()) {
      clearTimeout(timeout);
    }
    this.downloadLoops.clear();

    // Clear stats update
    if (this.statsUpdateInterval) {
      clearInterval(this.statsUpdateInterval);
      this.statsUpdateInterval = null;
    }

    // Disconnect peer manager
    this.peerManager.disconnect();
    
    // Clear torrents
    this.torrents.clear();
    
    console.log('TorrentEngine destroyed');
  }
}