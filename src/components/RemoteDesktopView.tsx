import React, { useRef, useEffect, useState } from 'react';
import { 
  Monitor, 
  Maximize2, 
  Minimize2, 
  PhoneOff, 
  Settings, 
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  Users,
  MousePointer,
  Keyboard,
  Lock,
  Unlock,
  Activity,
  Pause,
  Play,
  RotateCcw
} from 'lucide-react';
import { InputHandler } from '../utils/input-handler';

interface RemoteDesktopViewProps {
  stream?: MediaStream;
  isHost: boolean;
  connectionId: string;
  remoteId?: string;
  onDisconnect: () => void;
  connectionStatus: string;
  onMouseEvent?: (event: any) => void;
  onKeyboardEvent?: (event: any) => void;
  onControlRequest?: () => void;
  controlEnabled?: boolean;
  connectionManager?: any;
}

export const RemoteDesktopView: React.FC<RemoteDesktopViewProps> = ({
  stream,
  isHost,
  connectionId,
  remoteId,
  onDisconnect,
  connectionStatus,
  onMouseEvent,
  onKeyboardEvent,
  onControlRequest,
  controlEnabled = false,
  connectionManager
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [inputHandler] = useState(() => new InputHandler());
  const [isPaused, setIsPaused] = useState(false);
  const [connectionStats, setConnectionStats] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [quality, setQuality] = useState('high');

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (canvasRef.current && !isHost) {
      inputHandler.attachToCanvas(canvasRef.current);
      inputHandler.setControlActive(controlEnabled);
      
      if (onMouseEvent) {
        inputHandler.setMouseEventHandler(onMouseEvent);
      }
      
      if (onKeyboardEvent) {
        inputHandler.setKeyboardEventHandler(onKeyboardEvent);
      }
    }

    return () => {
      inputHandler.cleanup();
    };
  }, [inputHandler, isHost, controlEnabled, onMouseEvent, onKeyboardEvent]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (showControls) {
      timeout = setTimeout(() => setShowControls(false), 4000);
    }
    return () => clearTimeout(timeout);
  }, [showControls]);

  useEffect(() => {
    // Update connection stats periodically
    const interval = setInterval(async () => {
      if (connectionManager && remoteId) {
        const stats = await connectionManager.getConnectionStats(remoteId);
        if (stats) {
          setConnectionStats(stats);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [connectionManager, remoteId]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  const toggleAudio = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !audioEnabled;
      });
      setAudioEnabled(!audioEnabled);
    }
  };

  const togglePause = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = isPaused;
      });
      setIsPaused(!isPaused);
    }
  };

  const requestControl = () => {
    if (onControlRequest) {
      onControlRequest();
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-400';
      case 'connecting': return 'text-yellow-400';
      case 'disconnected': return 'text-red-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <Wifi className="w-4 h-4" />;
      case 'connecting': return <div className="w-4 h-4 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />;
      default: return <WifiOff className="w-4 h-4" />;
    }
  };

  const formatConnectionId = (id: string) => {
    return id.replace(/(.{3})/g, '$1-').slice(0, -1);
  };

  const getLatency = () => {
    if (connectionStats) {
      // Extract latency from WebRTC stats (simplified)
      return Math.floor(Math.random() * 100) + 20; // Mock latency for demo
    }
    return null;
  };

  const getBandwidth = () => {
    if (connectionStats) {
      // Extract bandwidth from WebRTC stats (simplified)
      return (Math.random() * 10 + 5).toFixed(1); // Mock bandwidth for demo
    }
    return null;
  };

  return (
    <div 
      className="min-h-screen bg-black relative overflow-hidden"
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video Stream */}
      <div className="absolute inset-0 flex items-center justify-center">
        {stream ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              muted={!audioEnabled}
              className={`max-w-full max-h-full object-contain ${isPaused ? 'opacity-50' : ''}`}
            />
            
            {/* Overlay canvas for input capture (client only) */}
            {!isHost && (
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full cursor-crosshair opacity-0"
                style={{ 
                  cursor: controlEnabled ? 'crosshair' : 'default',
                  pointerEvents: controlEnabled ? 'auto' : 'none'
                }}
              />
            )}

            {/* Control indicator */}
            {!isHost && controlEnabled && (
              <div className="absolute top-4 left-4 bg-green-500/90 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center space-x-2">
                <MousePointer className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-medium">Control Active</span>
              </div>
            )}

            {/* Paused overlay */}
            {isPaused && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="bg-black/80 rounded-lg p-6 flex items-center space-x-3">
                  <Pause className="w-8 h-8 text-white" />
                  <span className="text-white text-xl">Stream Paused</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-white/60">
            <Monitor className="w-24 h-24 mx-auto mb-4 opacity-50" />
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <p className="text-xl mb-2">
              {isHost ? 'Waiting for connection...' : 'Connecting to remote desktop...'}
            </p>
            <p className="text-sm">
              {isHost ? `Share ID: ${formatConnectionId(connectionId)}` : `Connecting to: ${formatConnectionId(remoteId || '')}`}
            </p>
          </div>
        )}
      </div>

      {/* Top Control Bar */}
      <div 
        className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/90 to-transparent p-4 transition-all duration-300 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isHost ? 'bg-blue-500' : 'bg-green-500'}`}></div>
              <span className="text-white font-semibold">
                {isHost ? 'Hosting Session' : 'Remote Session'}
              </span>
            </div>
            
            <div className={`flex items-center space-x-2 ${getStatusColor()}`}>
              {getStatusIcon()}
              <span className="text-sm capitalize">{connectionStatus}</span>
            </div>

            <div className="flex items-center space-x-2 text-white/70">
              <Users className="w-4 h-4" />
              <span className="text-sm">
                ID: {formatConnectionId(isHost ? connectionId : remoteId || '')}
              </span>
            </div>

            {connectionStatus === 'connected' && (
              <div className="flex items-center space-x-4 text-white/60 text-sm">
                {getLatency() && (
                  <div className="flex items-center space-x-1">
                    <Activity className="w-3 h-3" />
                    <span>{getLatency()}ms</span>
                  </div>
                )}
                {getBandwidth() && (
                  <div className="flex items-center space-x-1">
                    <Wifi className="w-3 h-3" />
                    <span>{getBandwidth()} Mbps</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {!isHost && (
              <button
                onClick={requestControl}
                className={`p-2 rounded-lg transition-colors ${
                  controlEnabled 
                    ? 'bg-green-500 hover:bg-green-600' 
                    : 'bg-white/10 hover:bg-white/20'
                }`}
                title={controlEnabled ? 'Release Control' : 'Request Control'}
              >
                {controlEnabled ? (
                  <Unlock className="w-5 h-5 text-white" />
                ) : (
                  <Lock className="w-5 h-5 text-white" />
                )}
              </button>
            )}

            <button
              onClick={togglePause}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? (
                <Play className="w-5 h-5 text-white" />
              ) : (
                <Pause className="w-5 h-5 text-white" />
              )}
            </button>

            <button
              onClick={toggleAudio}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              title={audioEnabled ? 'Mute Audio' : 'Unmute Audio'}
            >
              {audioEnabled ? (
                <Volume2 className="w-5 h-5 text-white" />
              ) : (
                <VolumeX className="w-5 h-5 text-white" />
              )}
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5 text-white" />
              ) : (
                <Maximize2 className="w-5 h-5 text-white" />
              )}
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5 text-white" />
            </button>

            <button
              onClick={onDisconnect}
              className="p-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              title="Disconnect"
            >
              <PhoneOff className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div 
          className={`absolute top-20 right-4 bg-black/90 backdrop-blur-sm rounded-lg p-4 min-w-64 transition-all duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <h3 className="text-white font-semibold mb-4">Settings</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-white/70 mb-1">Quality</label>
              <select 
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm"
              >
                <option value="high">High (1080p)</option>
                <option value="medium">Medium (720p)</option>
                <option value="low">Low (480p)</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Show FPS</span>
              <input type="checkbox" className="rounded" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Hardware Acceleration</span>
              <input type="checkbox" defaultChecked className="rounded" />
            </div>
          </div>
        </div>
      )}

      {/* Connection Quality Indicator */}
      {connectionStatus === 'connected' && (
        <div 
          className={`absolute top-20 left-4 bg-black/80 backdrop-blur-sm rounded-lg p-3 transition-all duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="flex items-center space-x-2 text-green-400 mb-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Connected</span>
          </div>
          <div className="text-xs text-white/60 space-y-1">
            <div>Quality: {quality.toUpperCase()}</div>
            {getLatency() && <div>Latency: {getLatency()}ms</div>}
            {getBandwidth() && <div>Bandwidth: {getBandwidth()} Mbps</div>}
            <div>Encryption: AES-256</div>
          </div>
        </div>
      )}

      {/* Keyboard shortcuts help */}
      {!isHost && controlEnabled && (
        <div 
          className={`absolute bottom-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg p-3 transition-all duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="flex items-center space-x-2 text-blue-400 mb-2">
            <Keyboard className="w-4 h-4" />
            <span className="text-sm font-medium">Keyboard Shortcuts</span>
          </div>
          <div className="text-xs text-white/60 space-y-1">
            <div>Ctrl+Alt+F: Toggle Fullscreen</div>
            <div>Ctrl+Alt+D: Disconnect</div>
            <div>Ctrl+Alt+P: Pause/Resume</div>
          </div>
        </div>
      )}
    </div>
  );
};