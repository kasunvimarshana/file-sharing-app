import React, { useState, useEffect, useRef } from 'react';
import { Upload, Download, Users, Share2, Shield, Activity, FileText, Network } from 'lucide-react';
import { P2PClient } from './lib/p2p-client';
import { FileManager } from './components/FileManager';
import { PeerNetwork } from './components/PeerNetwork';
import { TorrentList } from './components/TorrentList';
import { Dashboard } from './components/Dashboard';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [peerId, setPeerId] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [peers, setPeers] = useState([]);
  const [torrents, setTorrents] = useState([]);
  const [networkStats, setNetworkStats] = useState({
    uploadSpeed: 0,
    downloadSpeed: 0,
    connectedPeers: 0,
    totalTransferred: 0
  });

  const p2pClientRef = useRef(null);

  useEffect(() => {
    initializeP2P();
    return () => {
      if (p2pClientRef.current) {
        p2pClientRef.current.disconnect();
      }
    };
  }, []);

  const initializeP2P = async () => {
    try {
      p2pClientRef.current = new P2PClient();
      
      // Set up event listeners
      p2pClientRef.current.on('connected', (id) => {
        setIsConnected(true);
        setPeerId(id);
      });

      p2pClientRef.current.on('disconnected', () => {
        setIsConnected(false);
        setPeerId('');
      });

      p2pClientRef.current.on('peers-updated', (peerList) => {
        setPeers(peerList);
        setNetworkStats(prev => ({ ...prev, connectedPeers: peerList.length }));
      });

      p2pClientRef.current.on('torrents-updated', (torrentList) => {
        setTorrents(torrentList);
      });

      p2pClientRef.current.on('stats-updated', (stats) => {
        setNetworkStats(prev => ({ ...prev, ...stats }));
      });

      await p2pClientRef.current.connect();
    } catch (error) {
      console.error('Failed to initialize P2P client:', error);
    }
  };

  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: Activity },
    { id: 'files', name: 'Files', icon: FileText },
    { id: 'network', name: 'Network', icon: Network },
    { id: 'torrents', name: 'Torrents', icon: Share2 }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard networkStats={networkStats} peers={peers} torrents={torrents} />;
      case 'files':
        return <FileManager p2pClient={p2pClientRef.current} torrents={torrents} />;
      case 'network':
        return <PeerNetwork peers={peers} networkStats={networkStats} />;
      case 'torrents':
        return <TorrentList torrents={torrents} p2pClient={p2pClientRef.current} />;
      default:
        return <Dashboard networkStats={networkStats} peers={peers} torrents={torrents} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-black/20 backdrop-blur-3xl"></div>
      <div className="fixed inset-0 bg-gradient-to-tr from-purple-500/10 via-transparent to-cyan-500/10"></div>
      
      {/* Navigation Header */}
      <header className="relative z-10 border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-xl">
                <Share2 className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                P2P Torrent System
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
                isConnected 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
                <span className="text-sm font-medium">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              
              {peerId && (
                <div className="px-3 py-2 bg-white/10 rounded-lg border border-white/20">
                  <span className="text-sm text-gray-300">ID: {peerId.slice(-8)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar Navigation */}
          <div className="col-span-12 lg:col-span-3">
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <nav className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                        activeTab === tab.id
                          ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-white border border-cyan-500/30'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{tab.name}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Quick Stats */}
              <div className="mt-8 space-y-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  Quick Stats
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Peers</span>
                    <span className="text-lg font-bold text-cyan-400">{networkStats.connectedPeers}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Torrents</span>
                    <span className="text-lg font-bold text-purple-400">{torrents.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Upload</span>
                    <span className="text-lg font-bold text-green-400">
                      {(networkStats.uploadSpeed / 1024).toFixed(1)} KB/s
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Download</span>
                    <span className="text-lg font-bold text-blue-400">
                      {(networkStats.downloadSpeed / 1024).toFixed(1)} KB/s
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-12 lg:col-span-9">
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 min-h-[600px]">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;