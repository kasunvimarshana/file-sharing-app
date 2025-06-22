import React, { useState } from 'react';
import { Play, Square, Copy, Wifi, WifiOff } from 'lucide-react';
import { ConnectionState } from '../types';

interface ConnectionPanelProps {
  connectionState: ConnectionState;
  onStartScreenShare: () => void;
  onConnectToRemote: (sessionId: string) => void;
  onDisconnect: () => void;
}

export const ConnectionPanel: React.FC<ConnectionPanelProps> = ({
  connectionState,
  onStartScreenShare,
  onConnectToRemote,
  onDisconnect,
}) => {
  const [remoteId, setRemoteId] = useState('');

  const handleCopySessionId = () => {
    navigator.clipboard.writeText(connectionState.sessionId);
  };

  const handleConnect = () => {
    if (remoteId.trim()) {
      onConnectToRemote(remoteId.trim());
    }
  };

  const getStatusColor = () => {
    switch (connectionState.status) {
      case 'connected': return 'text-green-400';
      case 'connecting': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusText = () => {
    switch (connectionState.status) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'error': return 'Connection Error';
      default: return 'Disconnected';
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Connection</h2>
        <div className="flex items-center space-x-2">
          {connectionState.status === 'connected' ? (
            <Wifi className="w-5 h-5 text-green-400" />
          ) : (
            <WifiOff className="w-5 h-5 text-gray-400" />
          )}
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {/* Share Screen Section */}
        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-white mb-3">Share Your Screen</h3>
          
          {connectionState.sessionId && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Your Session ID
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={connectionState.sessionId}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-md font-mono text-lg"
                />
                <button
                  onClick={handleCopySessionId}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Share this ID with someone to let them connect to your screen
              </p>
            </div>
          )}

          {connectionState.status === 'disconnected' ? (
            <button
              onClick={onStartScreenShare}
              className="flex items-center space-x-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              <Play className="w-5 h-5" />
              <span>Start Screen Share</span>
            </button>
          ) : (
            <button
              onClick={onDisconnect}
              className="flex items-center space-x-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              <Square className="w-5 h-5" />
              <span>Stop Sharing</span>
            </button>
          )}
        </div>

        {/* Connect to Remote Section */}
        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-white mb-3">Connect to Remote Screen</h3>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Remote Session ID
            </label>
            <input
              type="text"
              value={remoteId}
              onChange={(e) => setRemoteId(e.target.value)}
              placeholder="Enter session ID..."
              className="w-full px-3 py-2 bg-gray-600 text-white rounded-md font-mono text-lg placeholder-gray-400"
              disabled={connectionState.status === 'connecting'}
            />
          </div>

          <button
            onClick={handleConnect}
            disabled={!remoteId.trim() || connectionState.status === 'connecting'}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            <Wifi className="w-5 h-5" />
            <span>
              {connectionState.status === 'connecting' ? 'Connecting...' : 'Connect'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};