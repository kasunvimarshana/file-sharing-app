export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  sessionId: string;
  remoteSessionId: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

export interface ChatMessage {
  id: string;
  text: string;
  timestamp: Date;
  sender: 'local' | 'remote';
}

export interface FileTransfer {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'transferring' | 'completed' | 'error';
  direction: 'sending' | 'receiving';
}

export interface Settings {
  quality: 'low' | 'medium' | 'high';
  audioEnabled: boolean;
  autoConnect: boolean;
  showPointer: boolean;
}