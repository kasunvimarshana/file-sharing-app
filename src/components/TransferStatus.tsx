import React from 'react';
import { Download, Upload, Pause, Play, X, CheckCircle } from 'lucide-react';

const TransferStatus = ({ transfers }) => {
  const formatSpeed = (bytesPerSecond) => {
    if (!bytesPerSecond || bytesPerSecond === 0) return '0 B/s';
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let speed = bytesPerSecond;
    let unitIndex = 0;
    
    while (speed >= 1024 && unitIndex < units.length - 1) {
      speed /= 1024;
      unitIndex++;
    }
    
    return `${speed.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatTimeRemaining = (seconds) => {
    if (!seconds || seconds === Infinity) return '∞';
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
    return `${Math.ceil(seconds / 3600)}h`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-emerald-400';
      case 'downloading': 
      case 'uploading': return 'text-blue-400';
      case 'paused': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (transfer) => {
    switch (transfer.status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'downloading':
        return <Download className="w-4 h-4 text-blue-400" />;
      case 'uploading':
        return <Upload className="w-4 h-4 text-emerald-400" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-400" />;
      case 'error':
        return <X className="w-4 h-4 text-red-400" />;
      default:
        return <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />;
    }
  };

  if (transfers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-700/50 flex items-center justify-center">
          <Download className="w-6 h-6 opacity-50" />
        </div>
        <p>No active transfers</p>
        <p className="text-sm">Downloads and uploads will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transfers.map((transfer) => (
        <div
          key={transfer.id}
          className="p-4 bg-gray-700/30 border border-gray-600/50 rounded-lg"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {getStatusIcon(transfer)}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-white truncate">
                  {transfer.fileName}
                </h4>
                <p className={`text-xs ${getStatusColor(transfer.status)}`}>
                  {transfer.status.charAt(0).toUpperCase() + transfer.status.slice(1)}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {transfer.status === 'downloading' || transfer.status === 'uploading' ? (
                <button className="p-1 hover:bg-gray-600 rounded-full transition-colors">
                  <Pause className="w-3 h-3 text-gray-400" />
                </button>
              ) : transfer.status === 'paused' ? (
                <button className="p-1 hover:bg-gray-600 rounded-full transition-colors">
                  <Play className="w-3 h-3 text-gray-400" />
                </button>
              ) : null}
              
              <button className="p-1 hover:bg-gray-600 rounded-full transition-colors">
                <X className="w-3 h-3 text-gray-400" />
              </button>
            </div>
          </div>
          
          {/* Progress Bar */}
          {(transfer.status === 'downloading' || transfer.status === 'uploading') && (
            <>
              <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    transfer.type === 'download' 
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500' 
                      : 'bg-gradient-to-r from-emerald-500 to-green-500'
                  }`}
                  style={{ width: `${transfer.progress || 0}%` }}
                />
              </div>
              
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{Math.round(transfer.progress || 0)}%</span>
                <div className="flex items-center space-x-3">
                  <span>{formatSpeed(transfer.speed)}</span>
                  <span>ETA: {formatTimeRemaining(transfer.eta)}</span>
                </div>
              </div>
            </>
          )}
          
          {/* Peer Info */}
          {transfer.peers && transfer.peers.length > 0 && (
            <div className="mt-2 text-xs text-gray-400">
              Connected to {transfer.peers.length} peer{transfer.peers.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default TransferStatus;