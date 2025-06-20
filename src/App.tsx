import React, { useState, useEffect, useRef } from 'react';
import { Upload, Download, Users, Share2, Shield, Zap } from 'lucide-react';
import FileUpload from './components/FileUpload';
import PeerNetwork from './components/PeerNetwork';
import FileList from './components/FileList';
import TransferStatus from './components/TransferStatus';
import { P2PManager } from './utils/p2p-manager';
import { SignalingClient } from './utils/signaling-client';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [peerId, setPeerId] = useState('');
  const [peers, setPeers] = useState([]);
  const [files, setFiles] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const p2pManagerRef = useRef(null);
  const signalingClientRef = useRef(null);

  useEffect(() => {
    // Initialize P2P system
    const initializeP2P = async () => {
      try {
        // Use environment variable for signaling server URL, fallback to localhost for local development
        const baseUrl = import.meta.env.VITE_SIGNALING_SERVER_URL || 'ws://localhost:8080';
        const signalingServerUrl = `${baseUrl}/ws`;

        console.debug(`signalingServerUrl : ${signalingServerUrl}`);
        
        signalingClientRef.current = new SignalingClient(signalingServerUrl);
        p2pManagerRef.current = new P2PManager(signalingClientRef.current);

        // Set up event listeners
        signalingClientRef.current.on('connected', (id) => {
          setPeerId(id);
          setIsConnected(true);
        });

        signalingClientRef.current.on('peer-joined', (peer) => {
          setPeers(prev => [...prev.filter(p => p.id !== peer.id), peer]);
        });

        signalingClientRef.current.on('peer-left', (peerId) => {
          setPeers(prev => prev.filter(p => p.id !== peerId));
        });

        p2pManagerRef.current.on('file-shared', (file) => {
          setFiles(prev => [...prev, file]);
        });

        p2pManagerRef.current.on('transfer-progress', (transfer) => {
          setTransfers(prev => {
            const index = prev.findIndex(t => t.id === transfer.id);
            if (index >= 0) {
              const newTransfers = [...prev];
              newTransfers[index] = transfer;
              return newTransfers;
            }
            return [...prev, transfer];
          });
        });

        await signalingClientRef.current.connect();
      } catch (error) {
        console.error('Failed to initialize P2P system:', error);
      }
    };

    initializeP2P();

    return () => {
      if (signalingClientRef.current) {
        signalingClientRef.current.disconnect();
      }
      if (p2pManagerRef.current) {
        p2pManagerRef.current.cleanup();
      }
    };
  }, []);

  const handleFileUpload = async (file) => {
    if (p2pManagerRef.current) {
      await p2pManagerRef.current.shareFile(file);
    }
  };

  const handleFileDownload = async (fileId) => {
    if (p2pManagerRef.current) {
      await p2pManagerRef.current.downloadFile(fileId);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      {/* Header */}
      <header className="border-b border-gray-700/50 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg">
                <Share2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  P2P Torrent
                </h1>
                <p className="text-sm text-gray-400">Decentralized File Sharing</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-300">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {peerId && (
                <div className="px-3 py-1 bg-gray-800 rounded-full text-xs font-mono text-gray-300">
                  ID: {peerId.slice(0, 8)}...
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Upload & Files */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gradient-to-r from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <Users className="w-8 h-8 text-blue-400" />
                  <div>
                    <p className="text-2xl font-bold text-white">{peers.length}</p>
                    <p className="text-sm text-blue-200">Active Peers</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-emerald-600/20 to-emerald-800/20 border border-emerald-500/30 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <Upload className="w-8 h-8 text-emerald-400" />
                  <div>
                    <p className="text-2xl font-bold text-white">{files.length}</p>
                    <p className="text-sm text-emerald-200">Shared Files</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-purple-600/20 to-purple-800/20 border border-purple-500/30 rounded-xl p-4">
                <div className="flex items-center space-x-3">
                  <Download className="w-8 h-8 text-purple-400" />
                  <div>
                    <p className="text-2xl font-bold text-white">{transfers.filter(t => t.type === 'download').length}</p>
                    <p className="text-sm text-purple-200">Downloads</p>
                  </div>
                </div>
              </div>
            </div>

            {/* File Upload */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <Shield className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-semibold text-white">Share Files</h2>
              </div>
              <FileUpload onFileUpload={handleFileUpload} />
            </div>

            {/* File List */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <Zap className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg font-semibold text-white">Available Files</h2>
              </div>
              <FileList files={files} onDownload={handleFileDownload} />
            </div>
          </div>

          {/* Right Column - Network & Transfers */}
          <div className="space-y-6">
            {/* Peer Network */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Peer Network</h2>
              <PeerNetwork peers={peers} currentPeerId={peerId} />
            </div>

            {/* Transfer Status */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Active Transfers</h2>
              <TransferStatus transfers={transfers} />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-700/50 bg-gray-900/50 backdrop-blur-sm mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-gray-400">
            <p className="text-sm">
              Powered by WebRTC • Decentralized • Secure • Open Source
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;