export interface TorrentFile {
  announce: string;
  announceList?: string[][];
  info: {
    name: string;
    pieceLength: number;
    pieces: Uint8Array;
    length?: number;
    files?: Array<{
      length: number;
      path: string[];
    }>;
  };
  infoHash: string;
  creationDate?: number;
  comment?: string;
  createdBy?: string;
}

export interface Peer {
  id: string;
  ip: string;
  port: number;
  connected: boolean;
  uploaded: number;
  downloaded: number;
  lastSeen: number;
}

export interface Piece {
  index: number;
  length: number;
  hash: Uint8Array;
  data?: Uint8Array;
  downloaded: boolean;
  verified: boolean;
  blocks: Block[];
}

export interface Block {
  offset: number;
  length: number;
  data?: Uint8Array;
  downloaded: boolean;
  requested: boolean;
}

export interface TorrentState {
  torrent: TorrentFile;
  pieces: Piece[];
  peers: Peer[];
  downloaded: number;
  uploaded: number;
  left: number;
  status: 'stopped' | 'downloading' | 'seeding' | 'completed';
  downloadSpeed: number;
  uploadSpeed: number;
  eta: number;
}

export interface TrackerResponse {
  interval: number;
  peers: Array<{
    peerId: string;
    ip: string;
    port: number;
  }>;
  complete: number;
  incomplete: number;
}