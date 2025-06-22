import React, { useState, useEffect } from 'react';
import { Monitor, Users, MessageSquare, Settings, FolderOpen, Wifi, WifiOff, Phone, PhoneOff, Video, VideoOff, Mic, MicOff, ScreenShare as ScreenShareIcon, ScreenShareOff } from 'lucide-react';
import ConnectionManager from './components/ConnectionManager';
import ScreenShare from './components/ScreenShare';
import RemoteViewer from './components/RemoteViewer';
import ChatPanel from './components/ChatPanel';
import FileTransfer from './components/FileTransfer';
import SettingsPanel from './components/SettingsPanel';

type ViewType = 'home' | 'host' | 'connect' | 'chat' | 'files' | 'settings';

interface ConnectionState {
  isConnected: boolean;
  isHost: boolean;
  sessionId: string | null;
  peerId: string | null;
}

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [connection, setConnection] = useState<ConnectionState>({
    isConnected: false,
    isHost: false,
    sessionId: null,
    peerId: null
  });
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const handleConnectionStateChange = (newState: Partial<ConnectionState>) => {
    setConnection(prev => ({ ...prev, ...newState }));
  };

  const handleScreenShareToggle = () => {
    setIsScreenSharing(!isScreenSharing);
  };

  const handleDisconnect = () => {
    setConnection({
      isConnected: false,
      isHost: false,
      sessionId: null,
      peerId: null
    });
    setIsScreenSharing(false);
    setCurrentView('home');
  };

  const getViewComponent = () => {
    switch (currentView) {
      case 'host':
        return <ScreenShare onConnectionChange={handleConnectionStateChange} />;
      case 'connect':
        return <RemoteViewer onConnectionChange={handleConnectionStateChange} />;
      case 'chat':
        return <ChatPanel onMessageRead={() => setUnreadMessages(0)} />;
      case 'files':
        return <FileTransfer />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return <ConnectionManager onViewChange={setCurrentView} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Monitor className="w-8 h-8 text-blue-500" />
              <h1 className="text-xl font-bold">RemoteDesk Pro</h1>
            </div>
            {connection.isConnected && (
              <div className="flex items-center space-x-2 text-sm text-green-400">
                <Wifi className="w-4 h-4" />
                <span>Connected</span>
                {connection.sessionId && (
                  <span className="text-gray-400">• ID: {connection.sessionId}</span>
                )}
              </div>
            )}
          </div>

          {connection.isConnected && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                className={`p-2 rounded-lg transition-colors ${
                  isAudioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isAudioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                className={`p-2 rounded-lg transition-colors ${
                  isVideoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </button>
              {connection.isHost && (
                <button
                  onClick={handleScreenShareToggle}
                  className={`p-2 rounded-lg transition-colors ${
                    isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  {isScreenSharing ? <ScreenShareIcon className="w-4 h-4" /> : <ScreenShareOff className="w-4 h-4" />}
                </button>
              )}
              <button
                onClick={handleDisconnect}
                className="p-2 rounded-lg bg-red-600 hover:bg-red-700 transition-colors"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-800 border-r border-gray-700">
          <nav className="p-4">
            <div className="space-y-2">
              <button
                onClick={() => setCurrentView('home')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  currentView === 'home' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Monitor className="w-5 h-5" />
                <span>Home</span>
              </button>

              {connection.isConnected && (
                <>
                  <button
                    onClick={() => setCurrentView(connection.isHost ? 'host' : 'connect')}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      currentView === 'host' || currentView === 'connect' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                    <span>{connection.isHost ? 'Hosting' : 'Connected'}</span>
                  </button>

                  <button
                    onClick={() => setCurrentView('chat')}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      currentView === 'chat' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span>Chat</span>
                    {unreadMessages > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 ml-auto">
                        {unreadMessages}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setCurrentView('files')}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      currentView === 'files' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <FolderOpen className="w-5 h-5" />
                    <span>File Transfer</span>
                  </button>
                </>
              )}

              <button
                onClick={() => setCurrentView('settings')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  currentView === 'settings' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Settings className="w-5 h-5" />
                <span>Settings</span>
              </button>
            </div>
          </nav>

          {/* Connection Status */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                {connection.isConnected ? (
                  <>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm text-green-400">Online</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span className="text-sm text-gray-400">Offline</span>
                  </>
                )}
              </div>
              {connection.isConnected && connection.peerId && (
                <div className="text-xs text-gray-400 mt-1">
                  Peer: {connection.peerId.substring(0, 8)}...
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 bg-gray-900">
          {getViewComponent()}
        </main>
      </div>
    </div>
  );
}

export default App;