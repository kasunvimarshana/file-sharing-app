import React, { useState } from 'react';
import { Share2, Download, Upload, Pause, Play, Trash2, Info, Users, Clock } from 'lucide-react';

export function TorrentList({ torrents, p2pClient }) {
  const [selectedTorrent, setSelectedTorrent] = useState(null);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond) => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'seeding':
        return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'downloading':
        return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      case 'paused':
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'available':
        return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
      case 'error':
        return 'text-red-400 bg-red-500/20 border-red-500/30';
      default:
        return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'seeding':
        return <Upload className="w-4 h-4" />;
      case 'downloading':
        return <Download className="w-4 h-4" />;
      case 'paused':
        return <Pause className="w-4 h-4" />;
      case 'available':
        return <Share2 className="w-4 h-4" />;
      default:
        return <Share2 className="w-4 h-4" />;
    }
  };

  const handleDownload = (torrent) => {
    if (p2pClient && torrent.status === 'available') {
      p2pClient.downloadFile(torrent.hash);
    }
  };

  const activeTorrents = torrents.filter(t => t.status === 'downloading' || t.status === 'seeding');
  const availableTorrents = torrents.filter(t => t.status === 'available');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Torrents</h2>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2 text-green-400">
            <Upload className="w-4 h-4" />
            <span>{torrents.filter(t => t.status === 'seeding').length} Seeding</span>
          </div>
          <div className="flex items-center space-x-2 text-blue-400">
            <Download className="w-4 h-4" />
            <span>{torrents.filter(t => t.status === 'downloading').length} Downloading</span>
          </div>
          <div className="flex items-center space-x-2 text-gray-400">
            <Share2 className="w-4 h-4" />
            <span>{availableTorrents.length} Available</span>
          </div>
        </div>
      </div>

      {/* Active Torrents */}
      {activeTorrents.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Play className="w-5 h-5 mr-2 text-cyan-400" />
              Active Torrents ({activeTorrents.length})
            </h3>
          </div>
          <div className="divide-y divide-white/5">
            {activeTorrents.map((torrent) => (
              <div key={torrent.hash} className="p-4 hover:bg-white/5 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg ${getStatusColor(torrent.status).replace('text-', 'bg-').replace('bg-', 'bg-').replace('-400', '-500/20')}`}>
                      {getStatusIcon(torrent.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium truncate">
                        {torrent.name}
                      </h4>
                      <div className="flex items-center space-x-4 mt-1 text-sm">
                        <span className="text-gray-400">{formatBytes(torrent.size)}</span>
                        <span className={`px-2 py-1 rounded-full border text-xs ${getStatusColor(torrent.status)}`}>
                          {torrent.status}
                        </span>
                        <span className="text-gray-400">
                          {torrent.seeders || 0} seeders • {torrent.leechers || 0} leechers
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    {/* Progress */}
                    <div className="w-32">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Progress</span>
                        <span className="text-white">{torrent.progress.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            torrent.status === 'downloading' 
                              ? 'bg-gradient-to-r from-blue-500 to-blue-400'
                              : 'bg-gradient-to-r from-green-500 to-green-400'
                          }`}
                          style={{ width: `${torrent.progress}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Speed */}
                    <div className="text-center min-w-[80px]">
                      <div className="text-sm text-white font-medium">
                        {torrent.status === 'downloading' 
                          ? formatSpeed(torrent.downloadSpeed || 0)
                          : formatSpeed(torrent.uploadSpeed || 0)
                        }
                      </div>
                      <div className="text-xs text-gray-400">
                        {torrent.status === 'downloading' ? 'Down' : 'Up'}
                      </div>
                    </div>

                    {/* ETA */}
                    <div className="text-center min-w-[60px]">
                      <div className="text-sm text-white font-medium">
                        {torrent.status === 'downloading' && torrent.progress < 100 ? '∞' : '—'}
                      </div>
                      <div className="text-xs text-gray-400">ETA</div>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedTorrent(torrent)}
                        className="p-2 bg-gray-500/20 text-gray-400 rounded-lg hover:bg-gray-500/30 transition-colors duration-200"
                        title="Info"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Torrents */}
      {availableTorrents.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Share2 className="w-5 h-5 mr-2 text-purple-400" />
              Available Downloads ({availableTorrents.length})
            </h3>
          </div>
          <div className="divide-y divide-white/5">
            {availableTorrents.map((torrent) => (
              <div key={torrent.hash} className="p-4 hover:bg-white/5 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="p-2 bg-gray-500/20 text-gray-400 rounded-lg">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-medium">
                        {torrent.name}
                      </h4>
                      <div className="flex items-center space-x-4 mt-1 text-sm">
                        <span className="text-gray-400">{formatBytes(torrent.size)}</span>
                        <span className="text-gray-400">
                          {torrent.seeders || 0} seeders available
                        </span>
                        {torrent.announcedAt && (
                          <span className="text-gray-400">
                            Added {formatTime(torrent.announcedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 text-sm">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-400">{torrent.seeders || 0}</span>
                    </div>
                    <button
                      onClick={() => handleDownload(torrent)}
                      className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {torrents.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
          <Share2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-400 mb-2">No torrents available</h3>
          <p className="text-gray-500">
            Upload files to start sharing, or wait for peers to announce files
          </p>
        </div>
      )}

      {/* Torrent Details Modal */}
      {selectedTorrent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-white/20 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Torrent Details</h3>
                <button
                  onClick={() => setSelectedTorrent(null)}
                  className="text-gray-400 hover:text-white transition-colors duration-200"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm text-gray-400">Name</label>
                <p className="text-white font-medium">{selectedTorrent.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Size</label>
                  <p className="text-white">{formatBytes(selectedTorrent.size)}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Status</label>
                  <p className={`${getStatusColor(selectedTorrent.status).split(' ')[0]} font-medium`}>
                    {selectedTorrent.status}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Progress</label>
                  <p className="text-white">{selectedTorrent.progress.toFixed(1)}%</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Hash</label>
                  <p className="text-white font-mono text-sm break-all">
                    {selectedTorrent.hash.substring(0, 16)}...
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Seeders</label>
                  <p className="text-green-400">{selectedTorrent.seeders || 0}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Leechers</label>
                  <p className="text-blue-400">{selectedTorrent.leechers || 0}</p>
                </div>
              </div>
              {selectedTorrent.uploadedAt && (
                <div>
                  <label className="text-sm text-gray-400">Added</label>
                  <p className="text-white">{formatTime(selectedTorrent.uploadedAt)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}