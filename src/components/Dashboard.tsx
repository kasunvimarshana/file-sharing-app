import React from 'react';
import { Activity, Upload, Download, Users, Share2, TrendingUp, Clock, HardDrive, Shield, Zap } from 'lucide-react';
import type { NetworkStats, Peer, TorrentFile } from '../types';
import { formatBytes, formatSpeed } from '../utils/validation';

interface DashboardProps {
  networkStats: NetworkStats;
  peers: Peer[];
  torrents: TorrentFile[];
}

export function Dashboard({ networkStats, peers, torrents }: DashboardProps) {
  const activeTorrents = torrents.filter(t => t.status === 'downloading' || t.status === 'seeding');
  const completedTorrents = torrents.filter(t => t.status === 'seeding');
  const downloadingTorrents = torrents.filter(t => t.status === 'downloading');

  const formatUptime = () => {
    const uptime = performance.now() / 1000; // seconds
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getNetworkHealth = () => {
    const peerScore = Math.min(networkStats.connectedPeers * 25, 100);
    const uploadScore = networkStats.uploadSpeed > 0 ? Math.min((networkStats.uploadSpeed / 1024) * 10, 100) : 0;
    const downloadScore = networkStats.downloadSpeed > 0 ? Math.min((networkStats.downloadSpeed / 1024) * 10, 100) : 0;
    return Math.round((peerScore + uploadScore + downloadScore) / 3);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-green-400">
            <Activity className="w-5 h-5 animate-pulse" />
            <span className="text-sm">System Active</span>
          </div>
          <div className="flex items-center space-x-2 text-cyan-400">
            <Shield className="w-5 h-5" />
            <span className="text-sm">Secure Connection</span>
          </div>
        </div>
      </div>

      {/* Network Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl p-4 hover:from-blue-500/30 hover:to-blue-600/30 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-300 text-sm font-medium">Download Speed</p>
              <p className="text-2xl font-bold text-white">{formatSpeed(networkStats.downloadSpeed)}</p>
              <p className="text-xs text-blue-200 mt-1">
                Total: {formatBytes(networkStats.totalDownloaded)}
              </p>
            </div>
            <Download className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-xl p-4 hover:from-green-500/30 hover:to-green-600/30 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-300 text-sm font-medium">Upload Speed</p>
              <p className="text-2xl font-bold text-white">{formatSpeed(networkStats.uploadSpeed)}</p>
              <p className="text-xs text-green-200 mt-1">
                Total: {formatBytes(networkStats.totalUploaded)}
              </p>
            </div>
            <Upload className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-xl p-4 hover:from-purple-500/30 hover:to-purple-600/30 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-300 text-sm font-medium">Connected Peers</p>
              <p className="text-2xl font-bold text-white">{networkStats.connectedPeers}</p>
              <p className="text-xs text-purple-200 mt-1">
                {networkStats.failedConnections} failed
              </p>
            </div>
            <Users className="w-8 h-8 text-purple-400" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 border border-cyan-500/30 rounded-xl p-4 hover:from-cyan-500/30 hover:to-cyan-600/30 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-cyan-300 text-sm font-medium">Active Torrents</p>
              <p className="text-2xl font-bold text-white">{activeTorrents.length}</p>
              <p className="text-xs text-cyan-200 mt-1">
                {downloadingTorrents.length} downloading
              </p>
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
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {activeTorrents.slice(0, 8).map((torrent) => (
              <div key={torrent.hash} className="flex items-center justify-between py-2 border-b border-white/5 last:border-b-0">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    torrent.status === 'downloading' ? 'bg-blue-400 animate-pulse' : 'bg-green-400'
                  }`}></div>
                  <div className="min-w-0 flex-1">
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
                  {torrent.status === 'seeding' && (
                    <p className="text-green-400 text-xs">{formatSpeed(torrent.uploadSpeed)}</p>
                  )}
                </div>
              </div>
            ))}
            {activeTorrents.length === 0 && (
              <div className="text-center py-8">
                <HardDrive className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400">No active torrents</p>
                <p className="text-gray-500 text-sm">Upload files to start sharing</p>
              </div>
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
            {/* Overall Health Score */}
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-white mb-2">{getNetworkHealth()}%</div>
              <div className="text-gray-400 text-sm">Overall Health Score</div>
              <div className="w-full bg-gray-700 rounded-full h-3 mt-3">
                <div 
                  className="bg-gradient-to-r from-green-500 to-green-400 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${getNetworkHealth()}%` }}
                ></div>
              </div>
            </div>

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
                <span className="text-white">
                  {completedTorrents.length > 0 && torrents.length > 0 
                    ? (completedTorrents.length / torrents.length * 100).toFixed(0) 
                    : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-purple-400 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${completedTorrents.length > 0 && torrents.length > 0 
                      ? (completedTorrents.length / torrents.length * 100) 
                      : 0}%` 
                  }}
                ></div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Zap className="w-4 h-4 text-yellow-400 mr-1" />
                </div>
                <p className="text-lg font-bold text-yellow-400">{formatUptime()}</p>
                <p className="text-xs text-gray-400">Uptime</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <HardDrive className="w-4 h-4 text-cyan-400 mr-1" />
                </div>
                <p className="text-lg font-bold text-cyan-400">{formatBytes(networkStats.totalTransferred || 0)}</p>
                <p className="text-xs text-gray-400">Transferred</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Share2 className="w-4 h-4 text-purple-400 mr-1" />
                </div>
                <p className="text-lg font-bold text-purple-400">{torrents.length}</p>
                <p className="text-xs text-gray-400">Total Files</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}