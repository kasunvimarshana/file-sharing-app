import React, { useState, useEffect, useRef } from 'react';
import { Monitor, Users, Copy, Check, AlertCircle, Play, Square, Settings, Maximize2, Pause, Volume2, VolumeX } from 'lucide-react';
import { WebRTCManager, SignalingService, ConnectionQuality, AudioProcessor } from '../utils/webrtc';

interface ScreenShareProps {
  onConnectionChange: (state: any) => void;
}

const ScreenShare: React.FC<ScreenShareProps> = ({ onConnectionChange }) => {
  const [isSharing, setIsSharing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 12).toUpperCase());
  const [connectedUsers, setConnectedUsers] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [selectedMonitor, setSelectedMonitor] = useState<string>('primary');
  const [shareSystemAudio, setShareSystemAudio] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const webrtcManager = useRef<WebRTCManager | null>(null);
  const signalingService = useRef<SignalingService | null>(null);
  const audioProcessor = useRef<AudioProcessor | null>(null);

  useEffect(() => {
    initializeServices();
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    onConnectionChange({
      isConnected: isSharing,
      isHost: true,
      sessionId,
      peerId: signalingService.current?.getPeerId() || null
    });
  }, [isSharing, sessionId, onConnectionChange]);

  const initializeServices = async () => {
    try {
      // Initialize WebRTC manager
      webrtcManager.current = new WebRTCManager();
      await webrtcManager.current.initializeConnection(true);

      // Initialize signaling service
      signalingService.current = new SignalingService(sessionId);
      
      // Initialize audio processor
      audioProcessor.current = new AudioProcessor();
      await audioProcessor.current.initialize();

      // Set up WebRTC event handlers
      webrtcManager.current.onConnectionState((state) => {
        console.log('Connection state:', state);
        
        if (state === 'connected') {
          setConnectedUsers(prev => {
            const newUser = 'User-' + Math.random().toString(36).substring(2, 6);
            return prev.includes(newUser) ? prev : [...prev, newUser];
          });
        } else if (state === 'disconnected' || state === 'failed') {
          setConnectedUsers([]);
          if (state === 'failed') {
            setError('Connection failed. Please try again.');
          }
        }
      });

      webrtcManager.current.onQualityChanged((quality) => {
        setConnectionQuality(quality);
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

      webrtcManager.current.onDataMessage((data) => {
        handleRemoteData(data);
      });

      // Set up signaling service
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
                
              case 'ice-candidate':
                await webrtcManager.current.addIceCandidate(signal.data);
                break;
            }
          } catch (error) {
            console.error('Error handling signal:', error);
          }
        }
      });

      signalingService.current.onConnection((connected) => {
        console.log('Signaling connection:', connected);
      });

      signalingService.current.onError((error) => {
        console.error('Signaling error:', error);
        setError('Signaling connection failed');
      });

      // Connect to signaling server
      await signalingService.current.connect();

    } catch (error) {
      console.error('Failed to initialize services:', error);
      setError('Failed to initialize connection services');
    }
  };

  const handleRemoteData = (data: any) => {
    switch (data.type) {
      case 'control-request':
        // Handle remote control requests
        console.log('Remote control request:', data);
        break;
      case 'chat-message':
        // Handle chat messages
        console.log('Chat message:', data.message);
        break;
      default:
        console.log('Unknown data type:', data.type);
    }
  };

  const cleanup = () => {
    if (webrtcManager.current) {
      webrtcManager.current.close();
      webrtcManager.current = null;
    }
    
    if (signalingService.current) {
      signalingService.current.disconnect();
      signalingService.current = null;
    }

    if (audioProcessor.current) {
      audioProcessor.current.destroy();
      audioProcessor.current = null;
    }
  };

  const startScreenShare = async () => {
    if (!webrtcManager.current) {
      setError('WebRTC not initialized');
      return;
    }

    try {
      setError(null);
      setIsInitializing(true);

      // Start screen sharing
      const stream = await webrtcManager.current.startScreenShare();
      
      // Process audio if enabled
      let processedStream = stream;
      if (audioEnabled && audioProcessor.current) {
        processedStream = audioProcessor.current.processStream(stream);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = processedStream;
      }

      setIsSharing(true);
      setIsInitializing(false);

      // Create and send offer to establish connection
      const offer = await webrtcManager.current.createOffer();
      if (signalingService.current) {
        signalingService.current.sendSignal({
          type: 'offer',
          sessionId,
          data: offer
        });
      }

      // Handle stream end
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('Screen share ended');
        stopScreenShare();
      });

      // Simulate connected users for demo
      setTimeout(() => {
        setConnectedUsers(['Demo-User-1', 'Demo-User-2']);
      }, 2000);

    } catch (err: any) {
      console.error('Error starting screen share:', err);
      let errorMessage = 'Failed to start screen sharing.';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Screen sharing permission denied. Please allow screen sharing and try again.';
      } else if (err.name === 'NotSupportedError') {
        errorMessage = 'Screen sharing is not supported in this browser.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No screen available for sharing.';
      }
      
      setError(errorMessage);
      setIsInitializing(false);
    }
  };

  const stopScreenShare = () => {
    if (webrtcManager.current) {
      webrtcManager.current.stopScreenShare();
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsSharing(false);
    setIsPaused(false);
    setConnectedUsers([]);
    setConnectionQuality(null);
  };

  const pauseScreenShare = () => {
    if (webrtcManager.current) {
      const stream = webrtcManager.current.getLocalStream();
      if (stream) {
        stream.getVideoTracks().forEach(track => {
          track.enabled = !isPaused;
        });
        setIsPaused(!isPaused);
      }
    }
  };

  const toggleAudio = () => {
    if (webrtcManager.current) {
      const stream = webrtcManager.current.getLocalStream();
      if (stream) {
        stream.getAudioTracks().forEach(track => {
          track.enabled = !audioEnabled;
        });
        setAudioEnabled(!audioEnabled);
      }
    }
  };

  const copySessionId = async () => {
    try {
      await navigator.clipboard.writeText(sessionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy session ID:', err);
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = sessionId;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatBandwidth = (bandwidth: number) => {
    if (bandwidth > 1000) {
      return `${(bandwidth / 1000).toFixed(1)} Mbps`;
    }
    return `${bandwidth} kbps`;
  };

  const getQualityColor = (quality: ConnectionQuality) => {
    if (quality.packetLoss < 1 && quality.latency < 100) return 'text-green-400';
    if (quality.packetLoss < 5 && quality.latency < 200) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getQualityText = (quality: ConnectionQuality) => {
    if (quality.packetLoss < 1 && quality.latency < 100) return 'Excellent';
    if (quality.packetLoss < 5 && quality.latency < 200) return 'Good';
    return 'Poor';
  };

  return (
    <div className="flex-1 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Screen Sharing</h2>
            <p className="text-gray-400">Share your screen with remote users</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="bg-gray-800 rounded-lg px-4 py-2">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-400">Session ID:</span>
                <span className="font-mono text-blue-400 select-all">{sessionId}</span>
                <button
                  onClick={copySessionId}
                  className="p-1 hover:bg-gray-700 rounded transition-colors"
                  title="Copy Session ID"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {isSharing && (
                <>
                  <button
                    onClick={pauseScreenShare}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                      isPaused
                        ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-white'
                    }`}
                  >
                    <Pause className="w-4 h-4" />
                    <span>{isPaused ? 'Resume' : 'Pause'}</span>
                  </button>

                  <button
                    onClick={toggleAudio}
                    className={`p-2 rounded-lg transition-colors ${
                      audioEnabled
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                    title={audioEnabled ? 'Mute Audio' : 'Unmute Audio'}
                  >
                    {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                </>
              )}

              <button
                onClick={isSharing ? stopScreenShare : startScreenShare}
                disabled={isInitializing}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
                  isSharing
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-600'
                }`}
              >
                {isInitializing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Initializing...</span>
                  </>
                ) : isSharing ? (
                  <>
                    <Square className="w-4 h-4" />
                    <span>Stop Sharing</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Start Sharing</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span className="text-red-200">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-300 text-xl leading-none"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Screen Preview */}
          <div className="lg:col-span-3">
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-white">Screen Preview</h3>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      isSharing ? (isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse') : 'bg-gray-500'
                    }`}></div>
                    <span className="text-sm text-gray-400">
                      {isSharing ? (isPaused ? 'Paused' : 'Live') : 'Not Sharing'}
                    </span>
                  </div>
                  {connectionQuality && (
                    <div className="flex items-center space-x-2 text-xs">
                      <span className={getQualityColor(connectionQuality)}>
                        {getQualityText(connectionQuality)}
                      </span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-400">{connectionQuality.fps} FPS</span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-400">{connectionQuality.resolution}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {connectionQuality && (
                    <div className="text-xs text-gray-400 bg-gray-700 rounded px-2 py-1">
                      {formatBandwidth(connectionQuality.bandwidth)} • {connectionQuality.latency}ms
                    </div>
                  )}
                  <button 
                    className="p-2 hover:bg-gray-700 rounded transition-colors" 
                    title="Fullscreen"
                    onClick={() => {
                      if (videoRef.current) {
                        if (videoRef.current.requestFullscreen) {
                          videoRef.current.requestFullscreen();
                        }
                      }
                    }}
                  >
                    <Maximize2 className="w-4 h-4 text-gray-400" />
                  </button>
                  <button className="p-2 hover:bg-gray-700 rounded transition-colors" title="Settings">
                    <Settings className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="aspect-video bg-gray-900 relative">
                {isSharing ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      className="w-full h-full object-contain"
                    />
                    {isPaused && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <div className="text-center">
                          <Pause className="w-16 h-16 text-white mx-auto mb-4" />
                          <p className="text-white text-lg">Screen sharing paused</p>
                          <p className="text-gray-300 text-sm">Click Resume to continue</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <Monitor className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400 mb-2">Click "Start Sharing" to begin</p>
                      <p className="text-sm text-gray-500">Your screen will be visible to connected users</p>
                    </div>
                  </div>
                )}

                {/* Quality Overlay */}
                {isSharing && connectionQuality && !isPaused && (
                  <div className="absolute top-4 right-4 bg-black bg-opacity-70 rounded-lg p-3 text-xs">
                    <div className="space-y-1 text-white">
                      <div className="flex justify-between">
                        <span>Quality:</span>
                        <span className={getQualityColor(connectionQuality)}>
                          {getQualityText(connectionQuality)}
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
                        <span>Loss:</span>
                        <span className={connectionQuality.packetLoss > 5 ? 'text-red-400' : 'text-green-400'}>
                          {connectionQuality.packetLoss.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Connected Users & Controls */}
          <div className="space-y-6">
            {/* Connected Users */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-4">
                <Users className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-semibold text-white">Connected Users</h3>
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                  {connectedUsers.length}
                </span>
              </div>

              <div className="space-y-3">
                {connectedUsers.length > 0 ? (
                  connectedUsers.map((user, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold">{user[0]}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{user}</p>
                        <div className="flex items-center space-x-1">
                          <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                          <p className="text-xs text-green-400">Connected</p>
                        </div>
                      </div>
                      <button className="text-gray-400 hover:text-white">
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No users connected</p>
                    <p className="text-gray-500 text-xs mt-1">Share your session ID to invite users</p>
                  </div>
                )}
              </div>
            </div>

            {/* Connection Instructions */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-white mb-3">How to Connect</h4>
              <ol className="text-xs text-gray-400 space-y-2">
                <li className="flex items-start space-x-2">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-semibold flex-shrink-0">1</span>
                  <span>Share your Session ID with others</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-semibold flex-shrink-0">2</span>
                  <span>They enter the ID in "Connect to Desktop"</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-semibold flex-shrink-0">3</span>
                  <span>Start screen sharing</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-semibold flex-shrink-0">4</span>
                  <span>Users will appear in the list above</span>
                </li>
              </ol>
            </div>

            {/* Quick Actions */}
            {isSharing && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-white mb-3">Quick Actions</h4>
                <div className="space-y-2">
                  <button 
                    onClick={pauseScreenShare}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded transition-colors"
                  >
                    {isPaused ? 'Resume' : 'Pause'} Screen Sharing
                  </button>
                  <button 
                    onClick={toggleAudio}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded transition-colors"
                  >
                    {audioEnabled ? 'Mute' : 'Unmute'} Audio
                  </button>
                  <button className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded transition-colors">
                    Switch Monitor
                  </button>
                  <button 
                    onClick={stopScreenShare}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700 rounded transition-colors"
                  >
                    End Session
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Connection Statistics */}
        {isSharing && connectionQuality && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{formatBandwidth(connectionQuality.bandwidth)}</div>
              <div className="text-sm text-gray-400">Bandwidth</div>
              <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
                <div 
                  className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((connectionQuality.bandwidth / 10000) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{connectionQuality.latency}ms</div>
              <div className="text-sm text-gray-400">Latency</div>
              <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
                <div 
                  className={`h-1 rounded-full transition-all duration-300 ${
                    connectionQuality.latency < 100 ? 'bg-green-500' : 
                    connectionQuality.latency < 200 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min((connectionQuality.latency / 500) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <div className={`text-2xl font-bold ${
                connectionQuality.packetLoss < 1 ? 'text-green-400' : 
                connectionQuality.packetLoss < 5 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {connectionQuality.packetLoss.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-400">Packet Loss</div>
              <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
                <div 
                  className={`h-1 rounded-full transition-all duration-300 ${
                    connectionQuality.packetLoss < 1 ? 'bg-green-500' : 
                    connectionQuality.packetLoss < 5 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(connectionQuality.packetLoss * 10, 100)}%` }}
                ></div>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">{connectionQuality.fps}</div>
              <div className="text-sm text-gray-400">FPS</div>
              <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
                <div 
                  className="bg-purple-500 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((connectionQuality.fps / 60) * 100, 100)}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-orange-400">{connectionQuality.jitter}ms</div>
              <div className="text-sm text-gray-400">Jitter</div>
              <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
                <div 
                  className={`h-1 rounded-full transition-all duration-300 ${
                    connectionQuality.jitter < 10 ? 'bg-green-500' : 
                    connectionQuality.jitter < 50 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min((connectionQuality.jitter / 100) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScreenShare;