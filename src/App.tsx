import React, { useState, useEffect } from 'react';
import { ConnectionScreen } from './components/ConnectionScreen';
import { RemoteDesktopView } from './components/RemoteDesktopView';
import { ConnectionManager } from './utils/connection';
import { Connection } from './types';

function App() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [connectionManager] = useState(() => new ConnectionManager());
  const [localStream, setLocalStream] = useState<MediaStream>();
  const [remoteStream, setRemoteStream] = useState<MediaStream>();
  const [controlEnabled, setControlEnabled] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Set up connection event handlers
    connectionManager.setConnectionChangeHandler((id: string, status: string) => {
      setConnection(prev => {
        if (!prev) return null;
        
        const newStatus = status as Connection['status'];
        return { ...prev, status: newStatus };
      });

      // Clear error on successful connection
      if (status === 'connected') {
        setError('');
      }
    });

    connectionManager.setRemoteStreamHandler((stream: MediaStream) => {
      setRemoteStream(stream);
    });

    connectionManager.setControlMessageHandler((message: any) => {
      handleControlMessage(message);
    });

    // Set up global keyboard shortcuts
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.altKey) {
        switch (event.key.toLowerCase()) {
          case 'f':
            event.preventDefault();
            toggleFullscreen();
            break;
          case 'd':
            event.preventDefault();
            handleDisconnect();
            break;
          case 'p':
            event.preventDefault();
            // Toggle pause functionality would go here
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Cleanup on unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      connectionManager.disconnectAll();
    };
  }, [connectionManager]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  const handleControlMessage = (message: any) => {
    switch (message.data.type) {
      case 'request-control':
        // Auto-grant control for demo purposes
        // In a real app, you'd show a permission dialog
        setControlEnabled(true);
        connectionManager.sendControlMessage(message.from, { type: 'grant-control' });
        break;
      case 'grant-control':
        setControlEnabled(true);
        break;
      case 'deny-control':
        setControlEnabled(false);
        break;
      case 'release-control':
        setControlEnabled(false);
        break;
    }
  };

  const handleConnect = async (remoteId?: string) => {
    try {
      setError('');
      const connectionId = connectionManager.getId();
      const isHost = !remoteId;
      
      setConnection({
        id: connectionId,
        status: 'connecting',
        isHost,
        remoteId,
        startTime: new Date(),
        quality: 'high',
        latency: 0
      });

      if (isHost) {
        try {
          // Start screen sharing for host
          const stream = await connectionManager.startScreenShare();
          setLocalStream(stream);
          
          // Handle stream end (user stops sharing)
          stream.getVideoTracks()[0].onended = () => {
            handleDisconnect();
          };

          // Enable control for host (they control their own screen)
          connectionManager.enableControl(true);
          
        } catch (screenError) {
          throw new Error('Failed to start screen sharing. Please ensure you grant permission to share your screen.');
        }
      }

      // Create WebRTC connection
      await connectionManager.createConnection(remoteId || 'remote', isHost);
      
      // Simulate connection establishment
      setTimeout(() => {
        setConnection(prev => {
          if (prev && prev.status === 'connecting') {
            return { ...prev, status: 'connected' };
          }
          return prev;
        });
      }, 2000);

    } catch (error) {
      console.error('Connection failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Connection failed. Please try again.';
      setError(errorMessage);
      
      setConnection(prev => {
        if (prev) {
          return { ...prev, status: 'error' };
        }
        return null;
      });
      
      // Reset after showing error
      setTimeout(() => {
        setConnection(null);
        setError('');
      }, 5000);
    }
  };

  const handleDisconnect = () => {
    if (connection) {
      connectionManager.disconnect(connection.remoteId || 'remote');
    }
    
    // Clean up streams
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    setConnection(null);
    setLocalStream(undefined);
    setRemoteStream(undefined);
    setControlEnabled(false);
    setError('');
  };

  const handleMouseEvent = (event: any) => {
    if (connection && !connection.isHost) {
      connectionManager.sendMouseEvent(connection.remoteId || 'remote', event);
    }
  };

  const handleKeyboardEvent = (event: any) => {
    if (connection && !connection.isHost) {
      connectionManager.sendKeyboardEvent(connection.remoteId || 'remote', event);
    }
  };

  const handleControlRequest = () => {
    if (connection && !connection.isHost) {
      if (controlEnabled) {
        // Release control
        setControlEnabled(false);
        connectionManager.sendControlMessage(connection.remoteId || 'remote', { type: 'release-control' });
      } else {
        // Request control
        connectionManager.sendControlMessage(connection.remoteId || 'remote', { type: 'request-control' });
      }
    }
  };

  // Show connection screen if no active connection
  if (!connection) {
    return (
      <ConnectionScreen
        onConnect={handleConnect}
        connectionId={connectionManager.getId()}
        isConnecting={false}
        error={error}
      />
    );
  }

  // Show remote desktop view
  return (
    <RemoteDesktopView
      stream={connection.isHost ? localStream : remoteStream}
      isHost={connection.isHost}
      connectionId={connection.id}
      remoteId={connection.remoteId}
      onDisconnect={handleDisconnect}
      connectionStatus={connection.status}
      onMouseEvent={handleMouseEvent}
      onKeyboardEvent={handleKeyboardEvent}
      onControlRequest={handleControlRequest}
      controlEnabled={controlEnabled}
      connectionManager={connectionManager}
    />
  );
}

export default App;