import React, { useState, useEffect, useRef } from 'react';
import { 
  Monitor, Maximize, Minimize, RotateCcw, Settings, AlertCircle, Loader, 
  Mouse, Keyboard, Maximize2, Volume2, VolumeX, MousePointer, Hand, Move
} from 'lucide-react';
import { WebRTCManager, SignalingService, InputHandler, ConnectionQuality } from '../utils/webrtc';

interface RemoteViewerProps {
  onConnectionChange: (state: any) => void;
}

const RemoteViewer: React.FC<RemoteViewerProps> = ({ onConnectionChange }) => {
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId] = useState('DEMO123456');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality | null>(null);
  const [isControlEnabled, setIsControlEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [remoteAudioEnabled, setRemoteAudioEnabled] = useState(true);
  const [cursorMode, setCursorMode] = useState<'pointer' | 'hand' | 'move'>('pointer');
  const [showRemoteCursor, setShowRemoteCursor] = useState(true);
  const [scalingMode, setScalingMode] = useState<'fit' | 'actual' | 'stretch'>('fit');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const webrtcManager = useRef<WebRTCManager | null>(null);
  const signalingService = useRef<SignalingService | null>(null);
  const inputHandler = useRef<InputHandler | null>(null);

  useEffect(() => {
    initializeConnection();
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    // Handle fullscreen changes
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const initializeConnection = async () => {
    try {
      setIsConnecting(true);
      setConnectionError(null);

      // Initialize WebRTC and signaling
      webrtcManager.current = new WebRTCManager();
      signalingService.current = new SignalingService(sessionId);

      // Set up WebRTC event handlers
      webrtcManager.current.onConnectionState((state) => {
        console.log('Connection state:', state);
        
        if (state === 'connected') {
          setIsConnected(true);
          setIsConnecting(false);
          onConnectionChange({
            isConnected: true,
            isHost: false,
            sessionId,
            peerId: signalingService.current?.getPeerId()
          });
        } else if (state === 'failed' || state === 'disconnected') {
          setConnectionError('Connection failed. Please try again.');
          setIsConnecting(false);
          setIsConnected(false);
        }
      });

      webrtcManager.current.onRemoteStream((stream) => {
        console.log('Received remote stream');
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });

      webrtcManager.current.onQualityChanged((quality) => {
        setConnectionQuality(quality);
      });

      webrtcManager.current.onDataMessage((data) => {
        handleRemoteData(data);
      });

      webrtcManager.current.onIceCandidateReceived((candidate) => {
        if (signalingService.current) {
          signalingService.current.sendSignal({
            type: 'ice-candidate',
            sessionId,
            data: candidate
          });
        }
      });

      // Set up signaling
      signalingService.current.onSignal(async (signal) => {
        if (webrtcManager.current) {
          try {
            switch (signal.type) {
              case 'offer':
                const answer = await webrtcManager.current.createAnswer(signal.data);
                signalingService.current?.sendSignal({
                  type: 'answer',
                  sessionId,
                  data: answer
                });
                break;
                
              case 'answer':
                await webrtcManager.current.setAnswer(signal.data);
                break;
                
              case 'ice-candidate':
                await webrtcManager.current.addIceCandidate(signal.data);
                break;
            }
          } catch (error) {
            console.error('Error handling signal:', error);
          }
        }
      });

      signalingService.current.onError((error) => {
        console.error('Signaling error:', error);
        setConnectionError('Signaling connection failed');
      });

      // Initialize WebRTC connection
      await webrtcManager.current.initializeConnection(false);
      
      // Connect to signaling server
      await signalingService.current.connect();

      // Simulate successful connection after a delay
      setTimeout(() => {
        setIsConnected(true);
        setIsConnecting(false);
        onConnectionChange({
          isConnected: true,
          isHost: false,
          sessionId,
          peerId: signalingService.current?.getPeerId()
        });

        createDemoStream();
        setupInputHandling();
      }, 3000);

    } catch (error) {
      console.error('Connection failed:', error);
      setConnectionError('Failed to connect to remote desktop');
      setIsConnecting(false);
    }
  };

  const createDemoStream = () => {
    // Create a canvas for demo content
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Create a gradient background
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#1e40af');
      gradient.addColorStop(1, '#3b82f6');
      
      let mouseX = canvas.width / 2;
      let mouseY = canvas.height / 2;
      let time = 0;
      let fps = 0;
      let frameCount = 0;
      let lastTime = Date.now();
      
      const animate = () => {
        time += 0.01;
        frameCount++;
        
        const now = Date.now();
        if (now - lastTime >= 1000) {
          fps = Math.round((frameCount * 1000) / (now - lastTime));
          frameCount = 0;
          lastTime = now;
        }
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add desktop-like background pattern
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        for (let i = 0; i < 10; i++) {
          for (let j = 0; j < 6; j++) {
            const x = i * 190 + 95;
            const y = j * 180 + 90;
            ctx.fillRect(x, y, 140, 140);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.strokeRect(x, y, 140, 140);
          }
        }
        
        // Add demo content
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Remote Desktop Demo', canvas.width / 2, 100);
        
        ctx.font = '24px Arial';
        ctx.fillText('This is a simulated remote desktop connection', canvas.width / 2, 150);
        ctx.fillText('Time: ' + new Date().toLocaleTimeString(), canvas.width / 2, 200);
        ctx.fillText('Mouse: ' + Math.round(mouseX) + ', ' + Math.round(mouseY), canvas.width / 2, 230);
        ctx.fillText('FPS: ' + fps, canvas.width / 2, 260);
        ctx.fillText('Control: ' + (isControlEnabled ? 'Enabled' : 'Disabled'), canvas.width / 2, 290);
        
        // Add moving windows
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        const windowX = (Math.sin(time) * 200) + canvas.width / 2 - 150;
        const windowY = (Math.cos(time * 0.7) * 100) + canvas.height / 2 - 75;
        ctx.fillRect(windowX, windowY, 300, 150);
        
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(windowX, windowY, 300, 30);
        
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Simulated Window', windowX + 10, windowY + 20);
        
        ctx.fillStyle = 'black';
        ctx.font = '14px Arial';
        ctx.fillText('This window demonstrates', windowX + 10, windowY + 50);
        ctx.fillText('real-time screen sharing', windowX + 10, windowY + 70);
        ctx.fillText('with interactive controls', windowX + 10, windowY + 90);
        
        // Add animated cursor
        if (showRemoteCursor) {
          ctx.fillStyle = 'black';
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          
          // Draw cursor
          ctx.beginPath();
          ctx.moveTo(mouseX, mouseY);
          ctx.lineTo(mouseX + 12, mouseY + 4);
          ctx.lineTo(mouseX + 8, mouseY + 8);
          ctx.lineTo(mouseX + 4, mouseY + 12);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        
        // Update mouse position with smooth movement
        const targetX = mouseX + (Math.random() - 0.5) * 8;
        const targetY = mouseY + (Math.random() - 0.5) * 8;
        mouseX += (targetX - mouseX) * 0.1;
        mouseY += (targetY - mouseY) * 0.1;
        mouseX = Math.max(0, Math.min(canvas.width, mouseX));
        mouseY = Math.max(0, Math.min(canvas.height, mouseY));
        
        requestAnimationFrame(animate);
      };
      
      animate();
      
      // Convert canvas to video stream
      const stream = canvas.captureStream(30);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Simulate quality updates
      const updateQuality = () => {
        setConnectionQuality({
          bandwidth: 4800 + Math.random() * 1000,
          latency: 45 + Math.random() * 20,
          packetLoss: Math.random() * 0.5,
          jitter: 5 + Math.random() * 10,
          fps: fps,
          resolution: '1920x1080'
        });
      };

      setInterval(updateQuality, 2000);
      updateQuality();
    }
  };

  const setupInputHandling = () => {
    if (videoRef.current && isControlEnabled) {
      inputHandler.current = new InputHandler();
      inputHandler.current.attachToElement(videoRef.current);
      
      inputHandler.current.onMouse((event) => {
        if (webrtcManager.current && isControlEnabled) {
          webrtcManager.current.sendData({
            type: 'input',
            inputType: 'mouse',
            ...event
          });
        }
      });

      inputHandler.current.onKeyboard((event) => {
        if (webrtcManager.current && isControlEnabled) {
          webrtcManager.current.sendData({
            type: 'input',
            inputType: 'keyboard',
            ...event
          });
        }
      });
    }
  };

  const handleRemoteData = (data: any) => {
    // Handle different types of remote data
    switch (data.type) {
      case 'clipboard':
        // Handle clipboard synchronization
        if (data.content && navigator.clipboard) {
          navigator.clipboard.writeText(data.content).catch(console.error);
        }
        break;
        
      case 'file':
        // Handle file transfer
        console.log('Received file:', data.filename);
        break;
        
      case 'audio-control':
        setRemoteAudioEnabled(data.enabled);
        break;
        
      case 'cursor-position':
        // Handle remote cursor position updates
        console.log('Remote cursor:', data.x, data.y);
        break;
        
      default:
        console.log('Received unknown data:', data);
    }
  };

  const cleanup = () => {
    if (inputHandler.current) {
      inputHandler.current.destroy();
      inputHandler.current = null;
    }
    
    if (webrtcManager.current) {
      webrtcManager.current.close();
      webrtcManager.current = null;
    }
    
    if (signalingService.current) {
      signalingService.current.disconnect();
      signalingService.current = null;
    }
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement && containerRef.current) {
      try {
        await containerRef.current.requestFullscreen();
      } catch (error) {
        console.error('Failed to enter fullscreen:', error);
      }
    } else if (document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch (error) {
        console.error('Failed to exit fullscreen:', error);
      }
    }
  };

  const reconnect = () => {
    setIsConnected(false);
    setConnectionError(null);
    cleanup();
    initializeConnection();
  };

  const toggleControl = () => {
    setIsControlEnabled(!isControlEnabled);
    if (webrtcManager.current) {
      webrtcManager.current.sendData({
        type: 'control',
        enabled: !isControlEnabled
      });
    }

    // Re-setup input handling
    if (inputHandler.current) {
      inputHandler.current.destroy();
      inputHandler.current = null;
    }
    
    if (!isControlEnabled) {
      setupInputHandling();
    }
  };

  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled);
    if (webrtcManager.current) {
      webrtcManager.current.sendData({
        type: 'audio-control',
        enabled: !audioEnabled
      });
    }
  };

  const sendKeyboardShortcut = (shortcut: string) => {
    if (webrtcManager.current && isControlEnabled) {
      webrtcManager.current.sendData({
        type: 'keyboard-shortcut',
        shortcut
      });
    }
  };

  const formatBandwidth = (bandwidth: number) => {
    if (bandwidth > 1000) {
      return `${(bandwidth / 1000).toFixed(1)} Mbps`;
    }
    return `${bandwidth} kbps`;
  };

  const getVideoStyle = () => {
    switch (scalingMode) {
      case 'actual':
        return 'object-none';
      case 'stretch':
        return 'object-fill';
      default:
        return 'object-contain';
    }
  };

  const getCursorClass = () => {
    if (!isControlEnabled) return 'cursor-not-allowed';
    
    switch (cursorMode) {
      case 'hand':
        return 'cursor-grab';
      case 'move':
        return 'cursor-move';
      default:
        return 'cursor-crosshair';
    }
  };

  if (isConnecting) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <Loader className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Connecting to Remote Desktop</h3>
          <p className="text-gray-400 mb-4">Session ID: {sessionId}</p>
          <div className="w-64 bg-gray-700 rounded-full h-2 mx-auto mb-4">
            <div className="bg-blue-500 h-2 rounded-full transition-all duration-1000" style={{ width: '75%' }}></div>
          </div>
          <div className="space-y-2 text-sm text-gray-500">
            <p>• Establishing secure connection...</p>
            <p>• Negotiating media streams...</p>
            <p>• Setting up input handling...</p>
          </div>
        </div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Connection Failed</h3>
          <p className="text-gray-400 mb-6">{connectionError}</p>
          <button
            onClick={reconnect}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col" ref={containerRef}>
      {/* Toolbar */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Monitor className="w-5 h-5 text-blue-500" />
            <span className="text-white font-medium">Remote Desktop</span>
            <span className="text-gray-400">•</span>
            <span className="text-green-400 text-sm">Connected to {sessionId}</span>
          </div>
          
          {connectionQuality && (
            <div className="flex items-center space-x-4 text-xs">
              <span className="text-gray-400">
                {formatBandwidth(connectionQuality.bandwidth)}
              </span>
              <span className="text-gray-400">
                {connectionQuality.latency}ms
              </span>
              <span className="text-gray-400">
                {connectionQuality.fps} FPS
              </span>
              <span className={`${
                connectionQuality.packetLoss < 1 ? 'text-green-400' : 
                connectionQuality.packetLoss < 5 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {connectionQuality.packetLoss.toFixed(1)}% loss
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Cursor Mode */}
          <div className="flex items-center space-x-1 bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setCursorMode('pointer')}
              className={`p-1 rounded transition-colors ${
                cursorMode === 'pointer' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'
              }`}
              title="Pointer Mode"
            >
              <MousePointer className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCursorMode('hand')}
              className={`p-1 rounded transition-colors ${
                cursorMode === 'hand' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'
              }`}
              title="Hand Mode"
            >
              <Hand className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCursorMode('move')}
              className={`p-1 rounded transition-colors ${
                cursorMode === 'move' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'
              }`}
              title="Move Mode"
            >
              <Move className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={toggleControl}
            className={`p-2 rounded transition-colors ${
              isControlEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title="Toggle Remote Control"
          >
            {isControlEnabled ? (
              <Mouse className="w-4 h-4 text-white" />
            ) : (
              <Keyboard className="w-4 h-4 text-gray-300" />
            )}
          </button>
          
          <button
            onClick={toggleAudio}
            className={`p-2 rounded transition-colors ${
              audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
            }`}
            title={audioEnabled ? 'Mute Audio' : 'Unmute Audio'}
          >
            {audioEnabled ? (
              <Volume2 className="w-4 h-4 text-gray-300" />
            ) : (
              <VolumeX className="w-4 h-4 text-white" />
            )}
          </button>
          
          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? (
              <Minimize className="w-4 h-4 text-gray-300" />
            ) : (
              <Maximize2 className="w-4 h-4 text-gray-300" />
            )}
          </button>
          
          <button
            onClick={reconnect}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="Reconnect"
          >
            <RotateCcw className="w-4 h-4 text-gray-300" />
          </button>
          
          <button className="p-2 hover:bg-gray-700 rounded transition-colors" title="Settings">
            <Settings className="w-4 h-4 text-gray-300" />
          </button>
        </div>
      </div>

      {/* Remote Desktop View */}
      <div className="flex-1 bg-black relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          className={`w-full h-full ${getVideoStyle()} ${getCursorClass()}`}
          onContextMenu={(e) => e.preventDefault()}
          tabIndex={0}
        />

        {/* Connection Status Overlay */}
        <div className="absolute top-4 right-4 bg-black bg-opacity-70 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-white text-sm font-medium">Connected</span>
          </div>
          
          {connectionQuality && (
            <div className="text-xs text-gray-300 space-y-1">
              <div className="flex justify-between">
                <span>Quality:</span>
                <span className="text-green-400">
                  {connectionQuality.packetLoss < 1 ? 'Excellent' : 
                   connectionQuality.packetLoss < 5 ? 'Good' : 'Poor'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Bandwidth:</span>
                <span>{formatBandwidth(connectionQuality.bandwidth)}</span>
              </div>
              <div className="flex justify-between">
                <span>Latency:</span>
                <span>{connectionQuality.latency}ms</span>
              </div>
              <div className="flex justify-between">
                <span>FPS:</span>
                <span>{connectionQuality.fps}</span>
              </div>
              <div className="flex justify-between">
                <span>Resolution:</span>
                <span>{connectionQuality.resolution}</span>
              </div>
              <div className="flex justify-between">
                <span>Control:</span>
                <span className={isControlEnabled ? 'text-green-400' : 'text-gray-400'}>
                  {isControlEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Control Status Overlay */}
        {!isControlEnabled && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-yellow-600 bg-opacity-90 rounded-lg px-4 py-2">
            <div className="flex items-center space-x-2 text-sm text-white">
              <Keyboard className="w-4 h-4" />
              <span>Remote control is disabled</span>
            </div>
          </div>
        )}

        {/* Audio Status Overlay */}
        {!audioEnabled && (
          <div className="absolute bottom-4 right-4 bg-red-600 bg-opacity-90 rounded-lg p-2">
            <VolumeX className="w-4 h-4 text-white" />
          </div>
        )}

        {/* Keyboard Shortcuts Panel */}
        {isControlEnabled && (
          <div className="absolute top-4 left-4 bg-black bg-opacity-70 rounded-lg p-3">
            <h4 className="text-white text-sm font-medium mb-2">Quick Actions</h4>
            <div className="space-y-1">
              <button
                onClick={() => sendKeyboardShortcut('ctrl+c')}
                className="block w-full text-left text-xs text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-gray-600"
              >
                Ctrl+C
              </button>
              <button
                onClick={() => sendKeyboardShortcut('ctrl+v')}
                className="block w-full text-left text-xs text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-gray-600"
              >
                Ctrl+V
              </button>
              <button
                onClick={() => sendKeyboardShortcut('alt+tab')}
                className="block w-full text-left text-xs text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-gray-600"
              >
                Alt+Tab
              </button>
              <button
                onClick={() => sendKeyboardShortcut('ctrl+alt+del')}
                className="block w-full text-left text-xs text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-gray-600"
              >
                Ctrl+Alt+Del
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4 text-gray-400">
            <span>Session: {sessionId}</span>
            <span>•</span>
            <span>Quality: {
              connectionQuality ? (
                connectionQuality.packetLoss < 1 ? 'Excellent' : 
                connectionQuality.packetLoss < 5 ? 'Good' : 'Poor'
              ) : 'Unknown'
            }</span>
            <span>•</span>
            <span>Bandwidth: {connectionQuality ? formatBandwidth(connectionQuality.bandwidth) : 'N/A'}</span>
            <span>•</span>
            <span>Mode: {cursorMode.charAt(0).toUpperCase() + cursorMode.slice(1)}</span>
          </div>
          
          <div className="flex items-center space-x-4 text-gray-400">
            <span>Latency: {connectionQuality ? `${connectionQuality.latency}ms` : 'N/A'}</span>
            <span>•</span>
            <span>FPS: {connectionQuality ? connectionQuality.fps : 'N/A'}</span>
            <span>•</span>
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${
                connectionQuality ? (
                  connectionQuality.packetLoss < 1 ? 'bg-green-400' :
                  connectionQuality.packetLoss < 5 ? 'bg-yellow-400' : 'bg-red-400'
                ) : 'bg-gray-400'
              }`}></div>
              <span>
                {connectionQuality ? (
                  connectionQuality.packetLoss < 1 ? 'Stable' :
                  connectionQuality.packetLoss < 5 ? 'Fair' : 'Unstable'
                ) : 'Unknown'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RemoteViewer;