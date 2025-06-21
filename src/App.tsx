import React, { useState, useEffect, useRef } from 'react';
import { Upload, Download, Users, Wifi, Settings, FileText, Share2, AlertCircle, Play, Pause, X, CheckCircle } from 'lucide-react';
import { FileManager } from './js/file-manager';
import { PeerConnectionManager } from './js/peer-connection';
import { createHash } from './js/hash.js';

interface FileInfo {
  id: string;
  name: string;
  size: number;
  hash: string;
  pieces: any[];
  pieceCount: number;
  addedAt: number;
  available: boolean;
  mimeType?: string;
}

interface DownloadProgress {
  fileHash: string;
  fileName: string;
  totalSize: number;
  downloadedBytes: number;
  completedPieces: number;
  totalPieces: number;
  progress: number;
  speed: number;
  peers: number;
  status: 'downloading' | 'paused' | 'completed' | 'error';
}

interface PeerInfo {
  peerId: string;
  joinedAt: number;
  connectionState: string;
}

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [peerId, setPeerId] = useState('');
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [downloads, setDownloads] = useState<DownloadProgress[]>([]);
  const [activeTab, setActiveTab] = useState('files');
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileManagerRef = useRef<FileManager | null>(null);
  const peerManagerRef = useRef<PeerConnectionManager | null>(null);

  // Initialize connection on component mount
  useEffect(() => {
    initializeSystem();
    return () => {
      cleanup();
    };
  }, []);

  const initializeSystem = async () => {
    try {
      addLog('Initializing P2P system...', 'info');
      
      // Generate peer ID
      const generatedPeerId = generatePeerId();
      setPeerId(generatedPeerId);
      
      // Initialize file manager
      const fileManager = new FileManager();
      fileManagerRef.current = fileManager;
      
      // Set up file manager event handlers
      fileManager.onFileAdded = (fileInfo: FileInfo) => {
        setFiles(prev => [...prev, fileInfo]);
        addLog(`File added: ${fileInfo.name}`, 'success');
      };
      
      fileManager.onFileRemoved = (fileHash: string) => {
        setFiles(prev => prev.filter(f => f.hash !== fileHash));
        addLog('File removed from library', 'info');
      };
      
      fileManager.onDownloadProgress = (progress: DownloadProgress) => {
        setDownloads(prev => {
          const existing = prev.find(d => d.fileHash === progress.fileHash);
          if (existing) {
            return prev.map(d => d.fileHash === progress.fileHash ? progress : d);
          } else {
            return [...prev, progress];
          }
        });
      };
      
      fileManager.onDownloadComplete = (fileInfo: FileInfo, downloadUrl: string) => {
        setDownloads(prev => prev.filter(d => d.fileHash !== fileInfo.hash));
        addLog(`Download completed: ${fileInfo.name}`, 'success');
        
        // Trigger download in browser
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = fileInfo.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      
      fileManager.onError = (message: string, error: Error) => {
        addLog(`File Manager Error: ${message}`, 'error');
      };
      
      // Connect to signaling server
      await connectToSignalingServer(generatedPeerId);
      
    } catch (error) {
      addLog(`System initialization failed: ${(error as Error).message}`, 'error');
      setConnectionStatus('Initialization Failed');
    }
  };

  const cleanup = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (peerManagerRef.current) {
      peerManagerRef.current.destroy();
    }
  };

  const generatePeerId = () => {
    const randomBytes = new Uint8Array(20);
    crypto.getRandomValues(randomBytes);
    return Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const connectToSignalingServer = (peerId: string) => {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket('ws://localhost:8080');
      wsRef.current = ws;

      ws.onopen = async () => {
        addLog('Connected to signaling server', 'success');
        setConnectionStatus('Connected to Signaling Server');
        
        // Initialize peer connection manager
        const peerManager = new PeerConnectionManager(
          peerId,
          ws,
          ['localhost:3478'],
          ['localhost:3479']
        );
        peerManagerRef.current = peerManager;
        
        // Set up peer manager event handlers
        peerManager.onConnectionStateChange = (peerId: string, state: string) => {
          setPeers(prev => {
            const existing = prev.find(p => p.peerId === peerId);
            if (existing) {
              return prev.map(p => p.peerId === peerId ? { ...p, connectionState: state } : p);
            } else if (state === 'connected') {
              return [...prev, { peerId, joinedAt: Date.now(), connectionState: state }];
            }
            return prev;
          });
          
          if (state === 'connected') {
            addLog(`Peer connected: ${peerId.substring(0, 8)}...`, 'success');
          } else if (state === 'disconnected' || state === 'failed') {
            addLog(`Peer disconnected: ${peerId.substring(0, 8)}...`, 'warning');
            setPeers(prev => prev.filter(p => p.peerId !== peerId));
          }
        };
        
        peerManager.onDataChannelMessage = (peerId: string, message: any) => {
          handlePeerMessage(peerId, message);
        };
        
        peerManager.onError = (message: string, error: Error) => {
          addLog(`Peer Manager Error: ${message}`, 'error');
        };
        
        // Authenticate with server
        const challenge = Math.random().toString(36);
        // const response = btoa(challenge + 'secret-key'); // Simplified auth
        const response = await createHash(challenge + 'secret-key');
        
        ws.send(JSON.stringify({
          type: 'authenticate',
          challenge: challenge,
          response: response
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleSignalingMessage(message);
        } catch (error) {
          addLog(`Failed to parse message: ${(error as Error).message}`, 'error');
        }
      };

      ws.onclose = () => {
        addLog('Disconnected from signaling server', 'warning');
        setConnectionStatus('Disconnected');
        setIsConnected(false);
        
        // Attempt reconnection after 5 seconds
        setTimeout(() => {
          if (!isConnected) {
            addLog('Attempting to reconnect...', 'info');
            connectToSignalingServer(peerId);
          }
        }, 5000);
      };

      ws.onerror = (error) => {
        addLog(`WebSocket error: Connection failed`, 'error');
        reject(error);
      };

      // Resolve after successful connection
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          resolve();
        } else {
          reject(new Error('Connection timeout'));
        }
      }, 5000);
    });
  };

  const handleSignalingMessage = (message: any) => {
    switch (message.type) {
      case 'welcome':
        addLog(`Assigned peer ID: ${message.peerId.substring(0, 8)}...`, 'success');
        setPeerId(message.peerId);
        break;
      
      case 'auth-success':
        addLog('Authentication successful', 'success');
        setIsConnected(true);
        setConnectionStatus('Authenticated');
        break;
      
      case 'auth-failed':
        addLog(`Authentication failed: ${message.reason}`, 'error');
        setConnectionStatus('Authentication Failed');
        break;
      
      case 'peer-list':
        const peerList = message.peers.map((peer: any) => ({
          peerId: peer.peerId,
          joinedAt: peer.joinedAt,
          connectionState: 'available'
        }));
        setPeers(peerList);
        addLog(`Received peer list: ${message.peers.length} peers`, 'info');
        break;
      
      case 'peer-joined':
        addLog(`Peer joined room: ${message.peerId.substring(0, 8)}...`, 'info');
        // Attempt to connect to new peer
        if (peerManagerRef.current) {
          peerManagerRef.current.connectToPeer(message.peerId);
        }
        break;
      
      case 'peer-left':
        addLog(`Peer left room: ${message.peerId.substring(0, 8)}...`, 'info');
        setPeers(prev => prev.filter(p => p.peerId !== message.peerId));
        break;
      
      case 'file-available':
        addLog(`File available: ${message.fileName} from ${message.peerId.substring(0, 8)}...`, 'info');
        break;
      
      case 'error':
        addLog(`Server error: ${message.message}`, 'error');
        break;
      
      default:
        console.log('Unknown message type:', message.type);
    }
  };

  const handlePeerMessage = (peerId: string, message: any) => {
    if (!fileManagerRef.current) return;
    
    switch (message.type) {
      case 'block-request':
        fileManagerRef.current.handlePieceRequest(
          peerId,
          message.fileHash,
          message.pieceIndex,
          message.blockOffset,
          message.blockSize
        );
        break;
      
      case 'block-response':
        fileManagerRef.current.handleReceivedBlock(
          message.fileHash,
          message.pieceIndex,
          message.blockOffset,
          message.blockData
        );
        break;
      
      case 'file-info':
        addLog(`Received file info: ${message.fileName} from ${peerId.substring(0, 8)}...`, 'info');
        break;
      
      default:
        console.log('Unknown peer message type:', message.type);
    }
  };

  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-99), { timestamp, message, type }]);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    selectedFiles.forEach(file => {
      addFileToLibrary(file);
    });
  };

  const addFileToLibrary = async (file: File) => {
    if (!fileManagerRef.current) return;
    
    try {
      addLog(`Processing file: ${file.name}`, 'info');
      
      const fileInfo = await fileManagerRef.current.addFile(file);
      if (fileInfo && isConnected && wsRef.current) {
        // Announce file to network
        wsRef.current.send(JSON.stringify({
          type: 'file-announce',
          fileName: file.name,
          fileSize: file.size,
          fileHash: fileInfo.hash,
          pieceHashes: fileInfo.pieces.map(p => p.hash)
        }));
      }
    } catch (error) {
      addLog(`Failed to process file: ${(error as Error).message}`, 'error');
    }
  };

  const removeFile = (fileId: string) => {
    if (!fileManagerRef.current) return;
    
    const file = files.find(f => f.id === fileId);
    if (file) {
      fileManagerRef.current.removeFile(file.hash);
    }
  };

  const pauseDownload = (fileHash: string) => {
    // Implementation for pausing download
    addLog('Download paused', 'info');
  };

  const resumeDownload = (fileHash: string) => {
    // Implementation for resuming download
    addLog('Download resumed', 'info');
  };

  const cancelDownload = (fileHash: string) => {
    if (!fileManagerRef.current) return;
    
    fileManagerRef.current.cancelDownload(fileHash);
    setDownloads(prev => prev.filter(d => d.fileHash !== fileHash));
    addLog('Download cancelled', 'info');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number) => {
    return formatFileSize(bytesPerSecond) + '/s';
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Connected': case 'Authenticated': return 'text-green-600';
      case 'Connecting': return 'text-yellow-600';
      case 'Disconnected': case 'Connection Failed': case 'Authentication Failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      default: return 'text-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Share2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">P2P File Sharing</h1>
                <p className="text-sm text-gray-300">Decentralized File Distribution</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                <span className={`text-sm font-medium ${getStatusColor(connectionStatus)}`}>
                  {connectionStatus}
                </span>
              </div>
              
              <div className="flex items-center space-x-2 text-sm text-gray-300">
                <Users className="w-4 h-4" />
                <span>{peers.length} Peers</span>
              </div>
              
              {peerId && (
                <div className="text-xs font-mono text-gray-400 bg-white/10 px-2 py-1 rounded">
                  ID: {peerId.substring(0, 8)}...
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <nav className="space-y-2">
              {[
                { id: 'files', label: 'My Files', icon: FileText },
                { id: 'downloads', label: 'Downloads', icon: Download },
                { id: 'network', label: 'Network', icon: Wifi },
                { id: 'logs', label: 'System Logs', icon: Settings }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 text-left rounded-lg transition-all duration-200 ${
                    activeTab === id
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'text-gray-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{label}</span>
                </button>
              ))}
            </nav>

            {/* Quick Actions */}
            <div className="mt-8 p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
              <h3 className="font-semibold text-white mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  <Upload className="w-4 h-4" />
                  <span>Add Files</span>
                </button>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeTab === 'files' && (
              <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                <div className="p-6 border-b border-white/10">
                  <h2 className="text-xl font-semibold text-white">My Files</h2>
                  <p className="text-sm text-gray-300 mt-1">Files available for sharing</p>
                </div>
                
                <div className="p-6">
                  {files.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-400 mb-4">No files in your library</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Add Your First File</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {files.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-4 border border-white/10 rounded-lg hover:bg-white/5 transition-colors duration-200">
                          <div className="flex-1">
                            <h3 className="font-medium text-white">{file.name}</h3>
                            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-400">
                              <span>{formatFileSize(file.size)}</span>
                              <span>{file.pieceCount} pieces</span>
                              <span>Added {formatTime(file.addedAt)}</span>
                            </div>
                            <div className="mt-2 font-mono text-xs text-gray-500">
                              Hash: {file.hash.substring(0, 32)}...
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${file.available ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                            <span className="text-sm text-gray-300">
                              {file.available ? 'Available' : 'Unavailable'}
                            </span>
                            <button
                              onClick={() => removeFile(file.id)}
                              className="ml-4 text-red-400 hover:text-red-300 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'downloads' && (
              <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                <div className="p-6 border-b border-white/10">
                  <h2 className="text-xl font-semibold text-white">Downloads</h2>
                  <p className="text-sm text-gray-300 mt-1">Files being downloaded from peers</p>
                </div>
                
                <div className="p-6">
                  {downloads.length === 0 ? (
                    <div className="text-center py-12">
                      <Download className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-400">No active downloads</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {downloads.map((download) => (
                        <div key={download.fileHash} className="p-4 border border-white/10 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium text-white">{download.fileName}</h3>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-300">{download.progress.toFixed(1)}%</span>
                              <button
                                onClick={() => download.status === 'downloading' ? pauseDownload(download.fileHash) : resumeDownload(download.fileHash)}
                                className="text-blue-400 hover:text-blue-300"
                              >
                                {download.status === 'downloading' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => cancelDownload(download.fileHash)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${download.progress}%` }}
                            ></div>
                          </div>
                          <div className="flex items-center justify-between mt-2 text-sm text-gray-400">
                            <span>{download.peers} peers</span>
                            <span>{formatSpeed(download.speed)}</span>
                            <span>{formatFileSize(download.downloadedBytes)} / {formatFileSize(download.totalSize)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'network' && (
              <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                <div className="p-6 border-b border-white/10">
                  <h2 className="text-xl font-semibold text-white">Network Status</h2>
                  <p className="text-sm text-gray-300 mt-1">Connected peers and network information</p>
                </div>
                
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="text-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <div className="text-2xl font-bold text-blue-400">{peers.length}</div>
                      <div className="text-sm text-gray-400">Connected Peers</div>
                    </div>
                    <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                      <div className="text-2xl font-bold text-green-400">{files.length}</div>
                      <div className="text-sm text-gray-400">Shared Files</div>
                    </div>
                    <div className="text-center p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                      <div className="text-2xl font-bold text-purple-400">{downloads.length}</div>
                      <div className="text-sm text-gray-400">Active Transfers</div>
                    </div>
                  </div>

                  {peers.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-400">No peers connected</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <h3 className="font-medium text-white">Connected Peers</h3>
                      {peers.map((peer, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border border-white/10 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                              <Users className="w-4 h-4 text-gray-300" />
                            </div>
                            <div>
                              <div className="font-mono text-sm text-white">ID: {peer.peerId?.substring(0, 16)}...</div>
                              <div className="text-xs text-gray-400">
                                Joined {formatTime(peer.joinedAt)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${peer.connectionState === 'connected' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                            <span className="text-sm text-gray-300 capitalize">{peer.connectionState}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                <div className="p-6 border-b border-white/10">
                  <h2 className="text-xl font-semibold text-white">System Logs</h2>
                  <p className="text-sm text-gray-300 mt-1">Real-time system events and messages</p>
                </div>
                
                <div className="p-6">
                  <div className="bg-black/50 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-sm">
                    {logs.length === 0 ? (
                      <div className="text-gray-500">No logs available</div>
                    ) : (
                      <div className="space-y-1">
                        {logs.map((log, index) => (
                          <div key={index} className="flex items-start space-x-2">
                            <span className="text-gray-500 whitespace-nowrap">{log.timestamp}</span>
                            <span className={getLogColor(log.type)}>{log.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 flex items-center space-x-2 text-sm text-gray-400">
                    <AlertCircle className="w-4 h-4" />
                    <span>Showing last 100 log entries</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;