export interface Peer {
  id: string;
  connected: boolean;
  lastSeen: number;
  connection?: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  metadata?: PeerMetadata;
}

export interface PeerMetadata {
  userAgent?: string;
  capabilities?: string[];
  bandwidth?: number;
}

export interface TorrentFile {
  hash: string;
  name: string;
  size: number;
  type: string;
  chunks: number;
  status: TorrentStatus;
  progress: number;
  seeders: number;
  leechers: number;
  downloadSpeed: number;
  uploadSpeed: number;
  uploadedAt?: number;
  announcedAt?: number;
  completedAt?: number;
  error?: string;
}

export type TorrentStatus = 'available' | 'downloading' | 'seeding' | 'paused' | 'error' | 'completed';

export interface NetworkStats {
  uploadSpeed: number;
  downloadSpeed: number;
  connectedPeers: number;
  totalTransferred: number;
  totalUploaded: number;
  totalDownloaded: number;
  activeConnections: number;
  failedConnections: number;
}

export interface ChunkData {
  fileHash: string;
  chunkIndex: number;
  data: ArrayBuffer;
  checksum?: string;
}

export interface FileInfo {
  name: string;
  size: number;
  hash: string;
  type: string;
  chunks: number;
  checksum: string;
  uploadedAt: number;
}

export interface SignalingMessage {
  type: string;
  peerId?: string;
  targetPeerId?: string;
  roomId?: string;
  data?: any;
  timestamp: number;
}

export interface ConnectionConfig {
  iceServers: RTCIceServer[];
  maxConnections: number;
  chunkSize: number;
  timeout: number;
  retryAttempts: number;
}

// export interface AppError {
//   code: string;
//   message: string;
//   details?: any;
//   timestamp: number;
// }

export class AppError extends Error {
  code: string;
  // message: string;
  details?: any;
  timestamp: number;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();
  }
}