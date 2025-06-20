import React from 'react';
import { Download, Upload, Users, Clock, Play, Pause, Trash2 } from 'lucide-react';
import type { TorrentState } from '../types/torrent';

interface TorrentListProps {
  torrents: TorrentState[];
  onStart: (infoHash: string) => void;
  onStop: (infoHash: string) => void;
  onRemove: (infoHash: string) => void;
}

export function TorrentList({ torrents, onStart, onStop, onRemove }: TorrentListProps) {
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

  const formatTime = (seconds: number): string => {
    if (seconds === Infinity || isNaN(seconds)) return '∞';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'downloading': return 'text-blue-400';
      case 'seeding': return 'text-green-400';
      case 'completed': return 'text-emerald-400';
      case 'stopped': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getProgress = (torrent: TorrentState): number => {
    const total = torrent.downloaded + torrent.left;
    return total > 0 ? (torrent.downloaded / total) * 100 : 0;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <Download className="w-6 h-6 text-green-400" />
        Active Torrents
      </h2>
      
      {torrents.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Download className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No torrents added yet</p>
          <p className="text-sm">Upload a .torrent file or create a new torrent to get started</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {torrents.map((torrent) => {
            const progress = getProgress(torrent);
            
            return (
              <div key={torrent.torrent.infoHash} className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-green-400/50 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white truncate">
                      {torrent.torrent.info.name}
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                      {formatBytes(torrent.downloaded + torrent.left)} • 
                      <span className={`ml-1 ${getStatusColor(torrent.status)}`}>
                        {torrent.status.toUpperCase()}
                      </span>
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    {torrent.status === 'stopped' || torrent.status === 'completed' ? (
                      <button
                        onClick={() => onStart(torrent.torrent.infoHash)}
                        className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                        title="Start Download"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onStop(torrent.torrent.infoHash)}
                        className="p-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors"
                        title="Pause Download"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    )}
                    
                    <button
                      onClick={() => onRemove(torrent.torrent.infoHash)}
                      className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                      title="Remove Torrent"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>{progress.toFixed(1)}% complete</span>
                    <span>{formatBytes(torrent.downloaded)} / {formatBytes(torrent.downloaded + torrent.left)}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-green-500 to-green-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-blue-400">
                    <Download className="w-4 h-4" />
                    <span>{formatSpeed(torrent.downloadSpeed)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <Upload className="w-4 h-4" />
                    <span>{formatSpeed(torrent.uploadSpeed)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-purple-400">
                    <Users className="w-4 h-4" />
                    <span>{torrent.peers.length} peers</span>
                  </div>
                  <div className="flex items-center gap-2 text-orange-400">
                    <Clock className="w-4 h-4" />
                    <span>{formatTime(torrent.eta)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}