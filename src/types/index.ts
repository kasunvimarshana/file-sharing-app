export interface Connection {
  id: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  isHost: boolean;
  remoteId?: string;
  startTime?: Date;
  quality?: 'low' | 'medium' | 'high';
  latency?: number;
}

export interface ConnectionMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'connect' | 'disconnect' | 'mouse' | 'keyboard' | 'control';
  data: any;
  from: string;
  to: string;
  timestamp: number;
}

export interface ScreenData {
  width: number;
  height: number;
  stream?: MediaStream;
}

export interface MouseEvent {
  type: 'click' | 'move' | 'scroll' | 'drag';
  x: number;
  y: number;
  button?: number;
  deltaX?: number;
  deltaY?: number;
}

export interface KeyboardEvent {
  type: 'keydown' | 'keyup' | 'keypress';
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export interface ControlMessage {
  type: 'request-control' | 'grant-control' | 'deny-control' | 'release-control';
  data?: any;
}