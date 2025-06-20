import React, { useState, useEffect } from 'react';
import { Zap, Activity, Shield, Globe } from 'lucide-react';
import { TorrentUpload } from './components/TorrentUpload';
import { TorrentList } from './components/TorrentList';
import { PeerStats } from './components/PeerStats';
import { TorrentEngine } from './services/TorrentEngine';
import type { TorrentState, Peer } from './types/torrent';

const torrentEngine = new TorrentEngine();

function App() {
  const [torrents, setTorrents] = useState<TorrentState[]>([]);
  const [allPeers, setAllPeers] = useState<Peer[]>([]);
  const [systemStats, setSystemStats] = useState({
    totalDownloaded: 0,
    totalUploaded: 0,
    downloadSpeed: 0,
    uploadSpeed: 0
  });

  useEffect(() => {
    // Set up torrent engine callbacks
    torrentEngine.setTorrentUpdateCallback((infoHash, state) => {
      setTorrents(prev => {
        const index = prev.findIndex(t => t.torrent.infoHash === infoHash);
        return index >= 0 
          ? prev.map((t, i) => i === index ? state : t)
          : [...prev, state];
      });
    });

    torrentEngine.setDownloadProgressCallback((infoHash, progress) => {
      console.log(`Download progress for ${infoHash}: ${(progress * 100).toFixed(1)}%`);
    });

    // Update system stats periodically
    const statsInterval = setInterval(() => {
      const stats = torrents.reduce((acc, torrent) => ({
        totalDownloaded: acc.totalDownloaded + torrent.downloaded,
        totalUploaded: acc.totalUploaded + torrent.uploaded,
        downloadSpeed: acc.downloadSpeed + torrent.downloadSpeed,
        uploadSpeed: acc.uploadSpeed + torrent.uploadSpeed
      }), { totalDownloaded: 0, totalUploaded: 0, downloadSpeed: 0, uploadSpeed: 0 });
      
      setSystemStats(stats);
      
      // Collect all peers
      const peers = torrents.flatMap(t => t.peers);
      setAllPeers(peers);
    }, 1000);

    return () => {
      clearInterval(statsInterval);
      torrentEngine.destroy();
    };
  }, [torrents]);

  const handleTorrentAdd = async (file: File) => {
    try {
      await torrentEngine.addTorrent(file);
    } catch (error) {
      console.error('Failed to add torrent:', error);
      alert('Failed to add torrent. Please check the file format.');
    }
  };

  const handleTorrentCreate = async (files: File[], announce: string, comment?: string) => {
    try {
      const torrentData = await torrentEngine.createTorrent(files, announce, comment);
      
      // Download the created torrent file
      const blob = new Blob([torrentData], { type: 'application/x-bittorrent' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${files.length === 1 ? files[0].name : 'MultiFile'}.torrent`;
      a.click();
      URL.revokeObjectURL(url);
      
      alert('Torrent file created and downloaded successfully!');
    } catch (error) {
      console.error('Failed to create torrent:', error);
      alert('Failed to create torrent. Please try again.');
    }
  };

  const handleStart = async (infoHash: string) => {
    await torrentEngine.startDownload(infoHash);
  };

  const handleStop = async (infoHash: string) => {
    await torrentEngine.stopDownload(infoHash);
  };

  const handleRemove = async (infoHash: string) => {
    await torrentEngine.removeTorrent(infoHash);
    setTorrents(prev => prev.filter(t => t.torrent.infoHash !== infoHash));
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">P2P Torrent System</h1>
                <p className="text-sm text-gray-400">Decentralized File Sharing</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-green-400">
                <Shield className="w-5 h-5" />
                <span className="text-sm font-medium">Secure</span>
              </div>
              <div className="flex items-center gap-2 text-blue-400">
                <Globe className="w-5 h-5" />
                <span className="text-sm font-medium">Decentralized</span>
              </div>
              <div className="flex items-center gap-2 text-purple-400">
                <Activity className="w-5 h-5" />
                <span className="text-sm font-medium">
                  {allPeers.filter(p => p.connected).length} Peers
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* System Stats Bar */}
      <div className="bg-gray-800/50 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Downloaded:</span>
              <span className="text-blue-400 font-semibold">
                {formatBytes(systemStats.totalDownloaded)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Uploaded:</span>
              <span className="text-green-400 font-semibold">
                {formatBytes(systemStats.totalUploaded)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Down Speed:</span>
              <span className="text-blue-400 font-semibold">
                {formatSpeed(systemStats.downloadSpeed)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Up Speed:</span>
              <span className="text-green-400 font-semibold">
                {formatSpeed(systemStats.uploadSpeed)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Torrent Management */}
          <div className="lg:col-span-2 space-y-8">
            <TorrentUpload 
              onTorrentAdd={handleTorrentAdd}
              onTorrentCreate={handleTorrentCreate}
            />
            <TorrentList
              torrents={torrents}
              onStart={handleStart}
              onStop={handleStop}
              onRemove={handleRemove}
            />
          </div>

          {/* Right Column - Peer Stats */}
          <div>
            <PeerStats peers={allPeers} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-black/30 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-gray-400 text-sm">
            <p>P2P Torrent System v1.0 - Built with React, WebRTC, and Node.js</p>
            <p className="mt-1">Implementing BitTorrent protocol for decentralized file sharing</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;