import React from 'react';
import { Users, Wifi, WifiOff, Globe, Activity } from 'lucide-react';
import type { Peer } from '../types/torrent';

interface PeerStatsProps {
  peers: Peer[];
}

export function PeerStats({ peers }: PeerStatsProps) {
  const connectedPeers = peers.filter(peer => peer.connected);
  const totalUploaded = peers.reduce((sum, peer) => sum + peer.uploaded, 0);
  const totalDownloaded = peers.reduce((sum, peer) => sum + peer.downloaded, 0);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <Users className="w-6 h-6 text-purple-400" />
        Peer Network
      </h2>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <Wifi className="w-5 h-5" />
            <span className="font-semibold">Connected</span>
          </div>
          <p className="text-2xl font-bold text-white">{connectedPeers.length}</p>
          <p className="text-sm text-gray-400">of {peers.length} total</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Activity className="w-5 h-5" />
            <span className="font-semibold">Downloaded</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatBytes(totalDownloaded)}</p>
          <p className="text-sm text-gray-400">total received</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <Activity className="w-5 h-5" />
            <span className="font-semibold">Uploaded</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatBytes(totalUploaded)}</p>
          <p className="text-sm text-gray-400">total sent</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-orange-400 mb-2">
            <Globe className="w-5 h-5" />
            <span className="font-semibold">Ratio</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {totalDownloaded > 0 ? (totalUploaded / totalDownloaded).toFixed(2) : '∞'}
          </p>
          <p className="text-sm text-gray-400">upload/download</p>
        </div>
      </div>

      {/* Peer List */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Active Peers</h3>
        </div>
        
        {peers.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No peers connected</p>
            <p className="text-sm">Start downloading a torrent to connect to peers</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700 max-h-64 overflow-y-auto">
            {peers.map((peer) => (
              <div key={peer.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    peer.connected ? 'bg-green-400' : 'bg-red-400'
                  }`} />
                  <div>
                    <p className="text-white font-mono text-sm">
                      {peer.id.substring(0, 20)}...
                    </p>
                    <p className="text-gray-400 text-xs">
                      {peer.ip === 'webrtc' ? 'WebRTC' : `${peer.ip}:${peer.port}`}
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-blue-400">
                      ↓ {formatBytes(peer.downloaded)}
                    </div>
                    <div className="text-green-400">
                      ↑ {formatBytes(peer.uploaded)}
                    </div>
                  </div>
                  <p className="text-gray-400 text-xs mt-1">
                    {formatTime(peer.lastSeen)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}