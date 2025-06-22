import React, { useState } from 'react';
import { Header } from './components/Header';
import { ConnectionPanel } from './components/ConnectionPanel';
import { ScreenViewer } from './components/ScreenViewer';
import { FileTransfer } from './components/FileTransfer';
import { Chat } from './components/Chat';
import { Settings } from './components/Settings';
import { useWebRTC } from './hooks/useWebRTC';
import { Settings as SettingsType } from './types';

function App() {
  const {
    connectionState,
    localVideoRef,
    remoteVideoRef,
    startScreenShare,
    connectToRemote,
    disconnect,
    sendData,
  } = useWebRTC();

  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<SettingsType>({
    quality: 'medium',
    audioEnabled: true,
    autoConnect: false,
    showPointer: true,
  });

  const handleSendFile = (file: File) => {
    console.log('Sending file:', file.name);
    // In a real application, you would send the file through the data channel
    sendData(JSON.stringify({
      type: 'file',
      name: file.name,
      size: file.size,
    }));
  };

  const handleSendMessage = (message: string) => {
    console.log('Sending message:', message);
    sendData(JSON.stringify({
      type: 'chat',
      message,
      timestamp: new Date().toISOString(),
    }));
  };

  const handleAbout = () => {
    alert('RemoteDesk Pro v1.0.0\nProfessional Remote Desktop Solution\nBuilt with React and WebRTC');
  };

  const isConnected = connectionState.status === 'connected';
  const isSharing = connectionState.localStream !== null;

  return (
    <div className="min-h-screen bg-gray-900">
      <Header
        onSettingsClick={() => setShowSettings(true)}
        onAboutClick={handleAbout}
      />

      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Connection & Controls */}
          <div className="lg:col-span-1 space-y-6">
            <ConnectionPanel
              connectionState={connectionState}
              onStartScreenShare={startScreenShare}
              onConnectToRemote={connectToRemote}
              onDisconnect={disconnect}
            />

            {isConnected && (
              <>
                <FileTransfer onSendFile={handleSendFile} />
                <Chat onSendMessage={handleSendMessage} />
              </>
            )}
          </div>

          {/* Right Column - Screen Viewer */}
          <div className="lg:col-span-2">
            <ScreenViewer
              localStream={connectionState.localStream}
              remoteStream={connectionState.remoteStream}
              isSharing={isSharing}
              localVideoRef={localVideoRef}
              remoteVideoRef={remoteVideoRef}
            />
          </div>
        </div>
      </main>

      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSettingsChange={setSettings}
      />
    </div>
  );
}

export default App;