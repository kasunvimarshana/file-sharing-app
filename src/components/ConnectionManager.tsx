import React, { useState } from 'react';
import { Monitor, Users, Wifi, Shield, Clock, Globe } from 'lucide-react';

interface ConnectionManagerProps {
  onViewChange: (view: 'host' | 'connect') => void;
}

const ConnectionManager: React.FC<ConnectionManagerProps> = ({ onViewChange }) => {
  const [connectionId, setConnectionId] = useState('');
  const [isGeneratingId, setIsGeneratingId] = useState(false);

  const generateSessionId = () => {
    setIsGeneratingId(true);
    // Simulate ID generation
    setTimeout(() => {
      const id = Math.random().toString(36).substring(2, 12).toUpperCase();
      setConnectionId(id);
      setIsGeneratingId(false);
    }, 1000);
  };

  const startHosting = () => {
    if (connectionId) {
      onViewChange('host');
    } else {
      generateSessionId();
    }
  };

  return (
    <div className="flex-1 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Welcome Section */}
        <div className="text-center mb-12">
          <div className="mb-6">
            <Monitor className="w-20 h-20 text-blue-500 mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-white mb-2">RemoteDesk Pro</h1>
            <p className="text-xl text-gray-400">Secure, Fast, and Reliable Remote Desktop Solution</p>
          </div>
        </div>

        {/* Main Actions */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Host Session */}
          <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 hover:border-blue-500 transition-colors">
            <div className="text-center">
              <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Monitor className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Share Your Screen</h3>
              <p className="text-gray-400 mb-6">Allow others to connect to your desktop</p>
              
              {connectionId && (
                <div className="bg-gray-700 rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-400 mb-2">Your Session ID:</p>
                  <div className="text-2xl font-mono text-blue-400 tracking-wider">{connectionId}</div>
                  <p className="text-xs text-gray-500 mt-2">Share this ID with others to connect</p>
                </div>
              )}

              <button
                onClick={startHosting}
                disabled={isGeneratingId}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-colors"
              >
                {isGeneratingId ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generating ID...
                  </span>
                ) : connectionId ? (
                  'Start Hosting'
                ) : (
                  'Generate Session ID'
                )}
              </button>
            </div>
          </div>

          {/* Connect to Session */}
          <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 hover:border-green-500 transition-colors">
            <div className="text-center">
              <div className="bg-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Connect to Desktop</h3>
              <p className="text-gray-400 mb-6">Enter a session ID to connect to a remote desktop</p>
              
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Enter Session ID"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-green-500 transition-colors"
                  value={connectionId}
                  onChange={(e) => setConnectionId(e.target.value.toUpperCase())}
                />
              </div>

              <button
                onClick={() => onViewChange('connect')}
                disabled={!connectionId.trim()}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-colors"
              >
                Connect
              </button>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <Shield className="w-8 h-8 text-blue-500 mx-auto mb-3" />
            <h4 className="text-lg font-semibold text-white mb-2">Secure Connection</h4>
            <p className="text-gray-400 text-sm">End-to-end encrypted peer-to-peer connections</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <Wifi className="w-8 h-8 text-green-500 mx-auto mb-3" />
            <h4 className="text-lg font-semibold text-white mb-2">Direct Connection</h4>
            <p className="text-gray-400 text-sm">No servers required, connects directly between devices</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <Clock className="w-8 h-8 text-purple-500 mx-auto mb-3" />
            <h4 className="text-lg font-semibold text-white mb-2">Real-time</h4>
            <p className="text-gray-400 text-sm">Low latency screen sharing and file transfer</p>
          </div>
        </div>

        {/* Recent Connections */}
        <div className="mt-12">
          <h3 className="text-xl font-bold text-white mb-4">Recent Connections</h3>
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="text-center text-gray-400">
              <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No recent connections</p>
              <p className="text-sm mt-1">Your connection history will appear here</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionManager;