import React from 'react';
import { Activity, Upload, Download, Users, Share2, TrendingUp, Clock, HardDrive } from 'lucide-react';

export function Dashboard({ networkStats, peers, torrents }) {
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

  const activeTorrents = torrents.filter(t => t.status === 'downloading' || t.status === 'seeding');
  const completedTorrents = torrents.filter(t => t.status === 'seeding');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <div className="flex items-center space-x-2 text-green-400">
          <Activity className="w-5 h-5 animate-pulse" />
          <span className="text-sm">System Active</span>
        </div>
      </div>

      {/* Network Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-300 text-sm font-medium">Download Speed</p>
              <p className="text-2xl font-bold text-white">{formatSpeed(networkStats.downloadSpeed)}</p>
            </div>
            <Download className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-300 text-sm font-medium">Upload Speed</p>
              <p className="text-2xl font-bold text-white">{formatSpeed(networkStats.uploadSpeed)}</p>
            </div>
            <Upload className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-300 text-sm font-medium">Connected Peers</p>
              <p className="text-2xl font-bold text-white">{networkStats.connectedPeers}</p>
            </div>
            <Users className="w-8 h-8 text-purple-400" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 border border-cyan-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-cyan-300 text-sm font-medium">Active Torrents</p>
              <p className="text-2xl font-bold text-white">{activeTorrents.length}</p>
            </div>
            <Share2 className="w-8 h-8 text-cyan-400" />
          </div>
        </div>
      </div>

      {/* Activity Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-cyan-400" />
            Recent Activity
          </h3>
          <div className="space-y-3">
            {activeTorrents.slice(0, 5).map((torrent, index) => (
              <div key={torrent.hash} className="flex items-center justify-between py-2 border-b border-white/5 last:border-b-0">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    torrent.status === 'downloading' ? 'bg-blue-400 animate-pulse' : 'bg-green-400'
                  }`}></div>
                  <div>
                    <p className="text-white text-sm font-medium truncate max-w-[200px]">
                      {torrent.name}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {torrent.status === 'downloading' ? 'Downloading' : 'Seeding'} • {torrent.progress.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white text-sm">{formatBytes(torrent.size)}</p>
                  {torrent.status === 'downloading' && (
                    <p className="text-blue-400 text-xs">{formatSpeed(torrent.downloadSpeed)}</p>
                  )}
                </div>
              </div>
            ))}
            {activeTorrents.length === 0 && (
              <p className="text-gray-400 text-center py-8">No active torrents</p>
            )}
          </div>
        </div>

        {/* Network Health */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-green-400" />
            Network Health
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Peer Connectivity</span>
                <span className="text-white">{Math.min(networkStats.connectedPeers * 25, 100)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-green-500 to-green-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(networkStats.connectedPeers * 25, 100)}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Upload Efficiency</span>
                <span className="text-white">
                  {networkStats.uploadSpeed > 0 ? Math.min((networkStats.uploadSpeed / 1024) * 10, 100).toFixed(0) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-blue-400 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${networkStats.uploadSpeed > 0 ? Math.min((networkStats.uploadSpeed / 1024) * 10, 100) : 0}%` 
                  }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Seeding Ratio</span>
                <span className="text-white">{completedTorrents.length > 0 ? '1.0' : '0.0'}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-purple-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${completedTorrents.length > 0 ? 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-cyan-400">{formatBytes(networkStats.totalTransferred || 0)}</p>
                <p className="text-sm text-gray-400">Total Transferred</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-400">{torrents.length}</p>
                <p className="text-sm text-gray-400">Total Files</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}