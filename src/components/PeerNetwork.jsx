import React, { useEffect, useRef } from 'react';
import { Users, Globe, Wifi, WifiOff, Clock, TrendingUp } from 'lucide-react';

export function PeerNetwork({ peers, networkStats }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current && peers.length > 0) {
      drawNetworkGraph();
    }
  }, [peers]);

  const drawNetworkGraph = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Set canvas size
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.3;
    
    // Draw center node (current peer)
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
    ctx.fillStyle = '#00D9FF';
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw connected peers
    peers.forEach((peer, index) => {
      const angle = (index * 2 * Math.PI) / peers.length;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      // Draw connection line
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = peer.connected ? '#10B981' : '#6B7280';
      ctx.lineWidth = 2;
      ctx.setLineDash(peer.connected ? [] : [5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw peer node
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, 2 * Math.PI);
      ctx.fillStyle = peer.connected ? '#10B981' : '#6B7280';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Add animation for active connections
      if (peer.connected) {
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, 2 * Math.PI);
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    });
    
    // Add labels
    ctx.font = '12px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('You', centerX, centerY + 35);
  };

  const formatUptime = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const connectedPeers = peers.filter(peer => peer.connected);
  const disconnectedPeers = peers.filter(peer => !peer.connected);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Peer Network</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-green-400">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm">{connectedPeers.length} Connected</span>
          </div>
          {disconnectedPeers.length > 0 && (
            <div className="flex items-center space-x-2 text-gray-400">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <span className="text-sm">{disconnectedPeers.length} Offline</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Network Graph */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Globe className="w-5 h-5 mr-2 text-cyan-400" />
            Network Topology
          </h3>
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="w-full h-64 bg-gray-900/20 rounded-lg"
              style={{ minHeight: '256px' }}
            />
            {peers.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Users className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-400">No peers connected</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Network Statistics */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-green-400" />
            Network Statistics
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Total Peers</span>
              <span className="text-xl font-bold text-white">{peers.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Active Connections</span>
              <span className="text-xl font-bold text-green-400">{connectedPeers.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Connection Success Rate</span>
              <span className="text-xl font-bold text-cyan-400">
                {peers.length > 0 ? Math.round((connectedPeers.length / peers.length) * 100) : 0}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Average Latency</span>
              <span className="text-xl font-bold text-purple-400">~50ms</span>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10">
            <h4 className="text-md font-semibold text-white mb-3">Connection Quality</h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Stability</span>
                  <span className="text-white">95%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-gradient-to-r from-green-500 to-green-400 h-2 rounded-full w-[95%]"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Throughput</span>
                  <span className="text-white">78%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-2 rounded-full w-[78%]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Peer List */}
      <div className="bg-white/5 border border-white/10 rounded-xl">
        <div className="p-6 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Users className="w-5 h-5 mr-2 text-purple-400" />
            Connected Peers ({peers.length})
          </h3>
        </div>
        
        {peers.length > 0 ? (
          <div className="divide-y divide-white/5">
            {peers.map((peer, index) => (
              <div key={peer.id} className="p-4 hover:bg-white/5 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-lg ${
                      peer.connected 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {peer.connected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="text-white font-medium">
                        Peer {peer.id.slice(-8)}
                      </h4>
                      <p className="text-sm text-gray-400">
                        {peer.connected ? 'Connected' : 'Disconnected'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-6 text-sm">
                    <div className="text-center">
                      <div className="text-white font-medium">WebRTC</div>
                      <div className="text-gray-400">Protocol</div>
                    </div>
                    <div className="text-center">
                      <div className="text-white font-medium">~25ms</div>
                      <div className="text-gray-400">Latency</div>
                    </div>
                    <div className="text-center">
                      <div className="text-white font-medium">
                        {peer.lastSeen ? formatUptime(peer.lastSeen) : '0m'}
                      </div>
                      <div className="text-gray-400">Uptime</div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs border ${
                      peer.connected 
                        ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                        : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    }`}>
                      {peer.connected ? 'Active' : 'Offline'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-400 mb-2">No peers connected</h3>
            <p className="text-gray-500">
              Waiting for peers to join the network...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}