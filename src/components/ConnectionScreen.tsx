import React, { useState, useEffect } from 'react';
import { Monitor, Users, Copy, Check, ArrowRight, Wifi, RefreshCw, AlertCircle } from 'lucide-react';

interface ConnectionScreenProps {
  onConnect: (remoteId?: string) => void;
  connectionId: string;
  isConnecting: boolean;
  error?: string;
}

export const ConnectionScreen: React.FC<ConnectionScreenProps> = ({
  onConnect,
  connectionId,
  isConnecting,
  error
}) => {
  const [remoteId, setRemoteId] = useState('');
  const [copied, setCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [connectionHistory, setConnectionHistory] = useState<string[]>([]);

  useEffect(() => {
    // Load connection history from localStorage
    const history = JSON.parse(localStorage.getItem('connection-history') || '[]');
    setConnectionHistory(history.slice(0, 5)); // Show last 5 connections
  }, []);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(connectionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy ID:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = connectionId;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnect = () => {
    if (remoteId.trim()) {
      const id = remoteId.trim().toUpperCase();
      
      // Save to connection history
      const history = JSON.parse(localStorage.getItem('connection-history') || '[]');
      const newHistory = [id, ...history.filter(h => h !== id)].slice(0, 10);
      localStorage.setItem('connection-history', JSON.stringify(newHistory));
      
      onConnect(id);
    }
  };

  const handleHostSession = () => {
    onConnect();
  };

  const handleHistoryConnect = (id: string) => {
    setRemoteId(id);
    onConnect(id);
  };

  const formatConnectionId = (id: string) => {
    // Format as XXX-XXX-XXX for better readability
    return id.replace(/(.{3})/g, '$1-').slice(0, -1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-500 rounded-3xl mb-6">
            <Monitor className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Remote Desktop</h1>
          <p className="text-xl text-blue-200">Secure peer-to-peer remote access</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="max-w-2xl mx-auto mb-8 bg-red-500/20 border border-red-500/30 rounded-lg p-4 flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-200">{error}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Host Session */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 hover:border-white/30 transition-all duration-300">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500 rounded-2xl mb-4">
                <Monitor className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Share Your Screen</h2>
              <p className="text-blue-200">Allow others to connect to your desktop</p>
            </div>

            <div className="space-y-6">
              <div className="bg-black/20 rounded-lg p-4">
                <label className="block text-sm font-medium text-blue-200 mb-2">
                  Your Connection ID
                </label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-white/10 rounded-lg px-4 py-3 font-mono text-xl text-white border border-white/20 text-center tracking-wider">
                    {formatConnectionId(connectionId)}
                  </div>
                  <button
                    onClick={handleCopyId}
                    className="p-3 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors group"
                    title="Copy ID"
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-white" />
                    ) : (
                      <Copy className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-blue-300 mt-2">
                  Share this ID with someone to let them connect to your screen
                </p>
              </div>

              <button
                onClick={handleHostSession}
                disabled={isConnecting}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white py-4 px-6 rounded-lg font-semibold text-lg transition-all duration-200 flex items-center justify-center space-x-2 hover:shadow-lg hover:shadow-blue-500/25"
              >
                {isConnecting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Starting Session...</span>
                  </>
                ) : (
                  <>
                    <Wifi className="w-5 h-5" />
                    <span>Start Session</span>
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-blue-300 hover:text-blue-200 text-sm flex items-center space-x-1 mx-auto"
                >
                  <span>Advanced Options</span>
                  <RefreshCw className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {showAdvanced && (
                <div className="bg-black/20 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-200">Quality</span>
                    <select className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm">
                      <option value="high">High (1080p)</option>
                      <option value="medium">Medium (720p)</option>
                      <option value="low">Low (480p)</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-200">Frame Rate</span>
                    <select className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm">
                      <option value="30">30 FPS</option>
                      <option value="60">60 FPS</option>
                      <option value="15">15 FPS</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Connect to Session */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 hover:border-white/30 transition-all duration-300">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-2xl mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Connect to Session</h2>
              <p className="text-green-200">Enter a connection ID to join</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-green-200 mb-2">
                  Remote Connection ID
                </label>
                <input
                  type="text"
                  value={remoteId}
                  onChange={(e) => setRemoteId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="XXX-XXX-XXX"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-lg text-center tracking-wider"
                  maxLength={11}
                />
              </div>

              {connectionHistory.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-green-200 mb-2">
                    Recent Connections
                  </label>
                  <div className="space-y-2">
                    {connectionHistory.map((id, index) => (
                      <button
                        key={index}
                        onClick={() => handleHistoryConnect(id)}
                        className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono text-left transition-colors"
                      >
                        {formatConnectionId(id)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={!remoteId.trim() || isConnecting}
                className="w-full bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 text-white py-4 px-6 rounded-lg font-semibold text-lg transition-all duration-200 flex items-center justify-center space-x-2 hover:shadow-lg hover:shadow-green-500/25"
              >
                {isConnecting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <span>Connect</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-white/60 text-sm mb-2">
            Secure peer-to-peer remote desktop sharing
          </p>
          <p className="text-white/40 text-xs">
            All connections are encrypted end-to-end using WebRTC
          </p>
        </div>
      </div>
    </div>
  );
};