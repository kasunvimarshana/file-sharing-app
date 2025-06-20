import React, { useEffect, useRef } from 'react';
import { Users, Wifi, WifiOff } from 'lucide-react';

const PeerNetwork = ({ peers, currentPeerId }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peers.length === 0) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Set up gradient background
    const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height)/2);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.1)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Draw connections
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.3;
    
    // Draw center node (current peer)
    ctx.beginPath();
    ctx.arc(centerX, centerY, 12, 0, 2 * Math.PI);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw peer nodes and connections
    peers.forEach((peer, index) => {
      const angle = (index / peers.length) * 2 * Math.PI;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      // Draw connection line
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = peer.connected ? '#10b981' : '#6b7280';
      ctx.lineWidth = peer.connected ? 2 : 1;
      ctx.stroke();
      
      // Draw peer node
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.fillStyle = peer.connected ? '#3b82f6' : '#6b7280';
      ctx.fill();
      ctx.strokeStyle = peer.connected ? '#60a5fa' : '#9ca3af';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }, [peers, currentPeerId]);

  return (
    <div className="space-y-4">
      {/* Network Visualization */}
      <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
        <canvas
          ref={canvasRef}
          width={280}
          height={200}
          className="w-full h-auto"
        />
      </div>
      
      {/* Peer List */}
      <div className="space-y-2">
        {peers.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No peers connected</p>
            <p className="text-sm">Share the network to invite others</p>
          </div>
        ) : (
          peers.map((peer) => (
            <div
              key={peer.id}
              className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg border border-gray-600/50"
            >
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  peer.connected ? 'bg-emerald-500' : 'bg-gray-500'
                }`} />
                <div>
                  <p className="text-sm font-medium text-white">
                    Peer {peer.id.slice(0, 8)}...
                  </p>
                  <p className="text-xs text-gray-400">
                    {peer.connected ? 'Connected' : 'Connecting...'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {peer.connected ? (
                  <Wifi className="w-4 h-4 text-emerald-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-gray-500" />
                )}
                <span className="text-xs text-gray-400">
                  {peer.connectionType || 'P2P'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Network Stats */}
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg p-3">
          <p className="text-lg font-bold text-blue-400">{peers.filter(p => p.connected).length}</p>
          <p className="text-xs text-blue-200">Connected</p>
        </div>
        <div className="bg-purple-600/20 border border-purple-500/30 rounded-lg p-3">
          <p className="text-lg font-bold text-purple-400">{peers.length}</p>
          <p className="text-xs text-purple-200">Total Peers</p>
        </div>
      </div>
    </div>
  );
};

export default PeerNetwork;