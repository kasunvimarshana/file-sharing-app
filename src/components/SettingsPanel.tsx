import React, { useState, useEffect } from 'react';
import { 
  Settings, Monitor, Volume2, Mic, Camera, Network, Shield, 
  Sliders, Save, RotateCcw, Info, ChevronRight, ChevronDown,
  Eye, EyeOff, Key, Lock, Unlock, Wifi, HardDrive
} from 'lucide-react';

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
}

interface AudioSettings {
  inputDevice: string;
  outputDevice: string;
  inputVolume: number;
  outputVolume: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

interface VideoSettings {
  camera: string;
  resolution: string;
  frameRate: number;
  bitrate: number;
  hardwareAcceleration: boolean;
}

interface NetworkSettings {
  connectionType: 'auto' | 'p2p' | 'relay';
  encryption: boolean;
  compression: boolean;
  bandwidthLimit: number;
  port: number;
}

interface SecuritySettings {
  requirePassword: boolean;
  password: string;
  allowFileTransfer: boolean;
  allowRemoteControl: boolean;
  allowClipboardAccess: boolean;
  sessionTimeout: number;
}

interface DisplaySettings {
  quality: 'low' | 'medium' | 'high' | 'ultra';
  colorDepth: '16' | '32';
  scaling: 'fit' | 'actual' | 'stretch';
  showCursor: boolean;
  showRemoteCursor: boolean;
}

const SettingsPanel: React.FC = () => {
  const [sections, setSections] = useState<SettingsSection[]>([
    { id: 'display', title: 'Display Settings', icon: <Monitor className="w-5 h-5" />, expanded: true },
    { id: 'audio', title: 'Audio Settings', icon: <Volume2 className="w-5 h-5" />, expanded: false },
    { id: 'video', title: 'Video Settings', icon: <Camera className="w-5 h-5" />, expanded: false },
    { id: 'network', title: 'Network Settings', icon: <Network className="w-5 h-5" />, expanded: false },
    { id: 'security', title: 'Security Settings', icon: <Shield className="w-5 h-5" />, expanded: false },
    { id: 'advanced', title: 'Advanced Settings', icon: <Sliders className="w-5 h-5" />, expanded: false },
  ]);

  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    inputDevice: 'default',
    outputDevice: 'default',
    inputVolume: 80,
    outputVolume: 75,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  });

  const [videoSettings, setVideoSettings] = useState<VideoSettings>({
    camera: 'default',
    resolution: '1920x1080',
    frameRate: 30,
    bitrate: 2500,
    hardwareAcceleration: true,
  });

  const [networkSettings, setNetworkSettings] = useState<NetworkSettings>({
    connectionType: 'auto',
    encryption: true,
    compression: true,
    bandwidthLimit: 10000,
    port: 9999,
  });

  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    requirePassword: false,
    password: '',
    allowFileTransfer: true,
    allowRemoteControl: true,
    allowClipboardAccess: true,
    sessionTimeout: 30,
  });

  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>({
    quality: 'high',
    colorDepth: '32',
    scaling: 'fit',
    showCursor: true,
    showRemoteCursor: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [availableDevices, setAvailableDevices] = useState({
    audioInput: [] as MediaDeviceInfo[],
    audioOutput: [] as MediaDeviceInfo[],
    videoInput: [] as MediaDeviceInfo[],
  });

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAvailableDevices({
        audioInput: devices.filter(d => d.kind === 'audioinput'),
        audioOutput: devices.filter(d => d.kind === 'audiooutput'),
        videoInput: devices.filter(d => d.kind === 'videoinput'),
      });
    } catch (error) {
      console.error('Error loading devices:', error);
    }
  };

  const toggleSection = (sectionId: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, expanded: !section.expanded }
        : section
    ));
  };

  const saveSettings = () => {
    // In a real implementation, this would save to persistent storage
    localStorage.setItem('remoteDesktop_audioSettings', JSON.stringify(audioSettings));
    localStorage.setItem('remoteDesktop_videoSettings', JSON.stringify(videoSettings));
    localStorage.setItem('remoteDesktop_networkSettings', JSON.stringify(networkSettings));
    localStorage.setItem('remoteDesktop_securitySettings', JSON.stringify(securitySettings));
    localStorage.setItem('remoteDesktop_displaySettings', JSON.stringify(displaySettings));
    
    setHasUnsavedChanges(false);
    
    // Show success notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    notification.textContent = 'Settings saved successfully!';
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  };

  const resetSettings = () => {
    setAudioSettings({
      inputDevice: 'default',
      outputDevice: 'default',
      inputVolume: 80,
      outputVolume: 75,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });
    setVideoSettings({
      camera: 'default',
      resolution: '1920x1080',
      frameRate: 30,
      bitrate: 2500,
      hardwareAcceleration: true,
    });
    setNetworkSettings({
      connectionType: 'auto',
      encryption: true,
      compression: true,
      bandwidthLimit: 10000,
      port: 9999,
    });
    setSecuritySettings({
      requirePassword: false,
      password: '',
      allowFileTransfer: true,
      allowRemoteControl: true,
      allowClipboardAccess: true,
      sessionTimeout: 30,
    });
    setDisplaySettings({
      quality: 'high',
      colorDepth: '32',
      scaling: 'fit',
      showCursor: true,
      showRemoteCursor: true,
    });
    setHasUnsavedChanges(true);
  };

  const SettingRow: React.FC<{ label: string; children: React.ReactNode; description?: string }> = ({ 
    label, 
    children, 
    description 
  }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-700 last:border-b-0">
      <div className="flex-1">
        <label className="text-sm font-medium text-white">{label}</label>
        {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
      </div>
      <div className="ml-4">{children}</div>
    </div>
  );

  const SliderInput: React.FC<{ 
    value: number; 
    onChange: (value: number) => void; 
    min: number; 
    max: number; 
    step?: number;
    unit?: string;
  }> = ({ value, onChange, min, max, step = 1, unit = '' }) => (
    <div className="flex items-center space-x-3 w-48">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
      />
      <span className="text-sm text-gray-300 w-12 text-right">{value}{unit}</span>
    </div>
  );

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
            <p className="text-gray-400">Configure your remote desktop application</p>
          </div>
          
          <div className="flex items-center space-x-3">
            {hasUnsavedChanges && (
              <span className="text-sm text-yellow-400 flex items-center space-x-1">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <span>Unsaved changes</span>
              </span>
            )}
            
            <button
              onClick={resetSettings}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
            
            <button
              onClick={saveSettings}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.id} className="bg-gray-800 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-6 hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="text-blue-400">{section.icon}</div>
                  <h2 className="text-lg font-semibold text-white">{section.title}</h2>
                </div>
                {section.expanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {section.expanded && (
                <div className="px-6 pb-6">
                  {/* Display Settings */}
                  {section.id === 'display' && (
                    <div className="space-y-1">
                      <SettingRow label="Display Quality" description="Higher quality uses more bandwidth">
                        <select
                          value={displaySettings.quality}
                          onChange={(e) => {
                            setDisplaySettings(prev => ({ ...prev, quality: e.target.value as any }));
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm w-32"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="ultra">Ultra</option>
                        </select>
                      </SettingRow>

                      <SettingRow label="Color Depth" description="Higher color depth provides better image quality">
                        <select
                          value={displaySettings.colorDepth}
                          onChange={(e) => {
                            setDisplaySettings(prev => ({ ...prev, colorDepth: e.target.value as any }));
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm w-32"
                        >
                          <option value="16">16-bit</option>
                          <option value="32">32-bit</option>
                        </select>
                      </SettingRow>

                      <SettingRow label="Scaling Mode" description="How to fit the remote screen in your window">
                        <select
                          value={displaySettings.scaling}
                          onChange={(e) => {
                            setDisplaySettings(prev => ({ ...prev, scaling: e.target.value as any }));
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm w-32"
                        >
                          <option value="fit">Fit to Window</option>
                          <option value="actual">Actual Size</option>
                          <option value="stretch">Stretch</option>
                        </select>
                      </SettingRow>

                      <SettingRow label="Show Local Cursor" description="Display your cursor while controlling remote desktop">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={displaySettings.showCursor}
                            onChange={(e) => {
                              setDisplaySettings(prev => ({ ...prev, showCursor: e.target.checked }));
                              setHasUnsavedChanges(true);
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </SettingRow>

                      <SettingRow label="Show Remote Cursor" description="Display the remote user's cursor">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={displaySettings.showRemoteCursor}
                            onChange={(e) => {
                              setDisplaySettings(prev => ({ ...prev, showRemoteCursor: e.target.checked }));
                              setHasUnsavedChanges(true);
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </SettingRow>
                    </div>
                  )}

                  {/* Audio Settings */}
                  {section.id === 'audio' && (
                    <div className="space-y-1">
                      <SettingRow label="Microphone Device">
                        <select
                          value={audioSettings.inputDevice}
                          onChange={(e) => {
                            setAudioSettings(prev => ({ ...prev, inputDevice: e.target.value }));
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm w-48"
                        >
                          <option value="default">Default</option>
                          {availableDevices.audioInput.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label || `Microphone ${device.deviceId.substring(0, 8)}`}
                            </option>
                          ))}
                        </select>
                      </SettingRow>

                      <SettingRow label="Speaker Device">
                        <select
                          value={audioSettings.outputDevice}
                          onChange={(e) => {
                            setAudioSettings(prev => ({ ...prev, outputDevice: e.target.value }));
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm w-48"
                        >
                          <option value="default">Default</option>
                          {availableDevices.audioOutput.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label || `Speaker ${device.deviceId.substring(0, 8)}`}
                            </option>
                          ))}
                        </select>
                      </SettingRow>

                      <SettingRow label="Microphone Volume">
                        <SliderInput
                          value={audioSettings.inputVolume}
                          onChange={(value) => {
                            setAudioSettings(prev => ({ ...prev, inputVolume: value }));
                            setHasUnsavedChanges(true);
                          }}
                          min={0}
                          max={100}
                          unit="%"
                        />
                      </SettingRow>

                      <SettingRow label="Speaker Volume">
                        <SliderInput
                          value={audioSettings.outputVolume}
                          onChange={(value) => {
                            setAudioSettings(prev => ({ ...prev, outputVolume: value }));
                            setHasUnsavedChanges(true);
                          }}
                          min={0}
                          max={100}
                          unit="%"
                        />
                      </SettingRow>

                      <SettingRow label="Echo Cancellation" description="Reduces audio feedback">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={audioSettings.echoCancellation}
                            onChange={(e) => {
                              setAudioSettings(prev => ({ ...prev, echoCancellation: e.target.checked }));
                              setHasUnsavedChanges(true);
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </SettingRow>

                      <SettingRow label="Noise Suppression" description="Filters background noise">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={audioSettings.noiseSuppression}
                            onChange={(e) => {
                              setAudioSettings(prev => ({ ...prev, noiseSuppression: e.target.checked }));
                              setHasUnsavedChanges(true);
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </SettingRow>

                      <SettingRow label="Auto Gain Control" description="Automatically adjusts microphone level">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={audioSettings.autoGainControl}
                            onChange={(e) => {
                              setAudioSettings(prev => ({ ...prev, autoGainControl: e.target.checked }));
                              setHasUnsavedChanges(true);
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </SettingRow>
                    </div>
                  )}

                  {/* Video Settings */}
                  {section.id === 'video' && (
                    <div className="space-y-1">
                      <SettingRow label="Camera Device">
                        <select
                          value={videoSettings.camera}
                          onChange={(e) => {
                            setVideoSettings(prev => ({ ...prev, camera: e.target.value }));
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm w-48"
                        >
                          <option value="default">Default</option>
                          {availableDevices.videoInput.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label || `Camera ${device.deviceId.substring(0, 8)}`}
                            </option>
                          ))}
                        </select>
                      </SettingRow>

                      <SettingRow label="Resolution">
                        <select
                          value={videoSettings.resolution}
                          onChange={(e) => {
                            setVideoSettings(prev => ({ ...prev, resolution: e.target.value }));
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm w-32"
                        >
                          <option value="640x480">640x480</option>
                          <option value="1280x720">1280x720</option>
                          <option value="1920x1080">1920x1080</option>
                          <option value="2560x1440">2560x1440</option>
                        </select>
                      </SettingRow>

                      <SettingRow label="Frame Rate">
                        <SliderInput
                          value={videoSettings.frameRate}
                          onChange={(value) => {
                            setVideoSettings(prev => ({ ...prev, frameRate: value }));
                            setHasUnsavedChanges(true);
                          }}
                          min={15}
                          max={60}
                          step={5}
                          unit=" fps"
                        />
                      </SettingRow>

                      <SettingRow label="Bitrate">
                        <SliderInput
                          value={videoSettings.bitrate}
                          onChange={(value) => {
                            setVideoSettings(prev => ({ ...prev, bitrate: value }));
                            setHasUnsavedChanges(true);
                          }}
                          min={500}
                          max={10000}
                          step={100}
                          unit=" kbps"
                        />
                      </SettingRow>

                      <SettingRow label="Hardware Acceleration" description="Use GPU for encoding/decoding">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={videoSettings.hardwareAcceleration}
                            onChange={(e) => {
                              setVideoSettings(prev => ({ ...prev, hardwareAcceleration: e.target.checked }));
                              setHasUnsavedChanges(true);
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </SettingRow>
                    </div>
                  )}

                  {/* Network Settings */}
                  {section.id === 'network' && (
                    <div className="space-y-1">
                      <SettingRow label="Connection Type" description="How to establish peer connections">
                        <select
                          value={networkSettings.connectionType}
                          onChange={(e) => {
                            setNetworkSettings(prev => ({ ...prev, connectionType: e.target.value as any }));
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm w-32"
                        >
                          <option value="auto">Auto</option>
                          <option value="p2p">P2P Only</option>
                          <option value="relay">Relay Only</option>
                        </select>
                      </SettingRow>

                      <SettingRow label="Port" description="Network port for connections">
                        <input
                          type="number"
                          value={networkSettings.port}
                          onChange={(e) => {
                            setNetworkSettings(prev => ({ ...prev, port: parseInt(e.target.value) || 9999 }));
                            setHasUnsavedChanges(true);
                          }}
                          min={1024}
                          max={65535}
                          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm w-24"
                        />
                      </SettingRow>

                      <SettingRow label="Bandwidth Limit">
                        <SliderInput
                          value={networkSettings.bandwidthLimit}
                          onChange={(value) => {
                            setNetworkSettings(prev => ({ ...prev, bandwidthLimit: value }));
                            setHasUnsavedChanges(true);
                          }}
                          min={1000}
                          max={50000}
                          step={500}
                          unit=" kbps"
                        />
                      </SettingRow>

                      <SettingRow label="Encryption" description="Encrypt all communications">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={networkSettings.encryption}
                            onChange={(e) => {
                              setNetworkSettings(prev => ({ ...prev, encryption: e.target.checked }));
                              setHasUnsavedChanges(true);
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </SettingRow>

                      <SettingRow label="Compression" description="Compress data to reduce bandwidth usage">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={networkSettings.compression}
                            onChange={(e) => {
                              setNetworkSettings(prev => ({ ...prev, compression: e.target.checked }));
                              setHasUnsavedChanges(true);
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </SettingRow>
                    </div>
                  )}

                  {/* Security Settings */}
                  {section.id === 'security' && (
                    <div className="space-y-1">
                      <SettingRow label="Require Password" description="Require password for connections">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={securitySettings.requirePassword}
                            onChange={(e) => {
                              setSecuritySettings(prev => ({ ...prev, requirePassword: e.target.checked }));
                              setHasUnsavedChanges(true);
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </SettingRow>

                      {securitySettings.requirePassword && (
                        <SettingRow label="Password">
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={securitySettings.password}
                              onChange={(e) => {
                                setSecuritySettings(prev => ({ ...prev, password: e.target.value }));
                                setHasUnsavedChanges(true);
                              }}
                              placeholder="Enter password"
                              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm w-48 pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </SettingRow>
                      )}

                      <SettingRow label="Allow File Transfer" description="Enable file sharing between devices">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={securitySettings.allowFileTransfer}
                            onChange={(e) => {
                              setSecuritySettings(prev => ({ ...prev, allowFileTransfer: e.target.checked }));
                              setHasUnsavedChanges(true);
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </SettingRow>

                      <SettingRow label="Allow Remote Control" description="Allow remote users to control this device">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={securitySettings.allowRemoteControl}
                            onChange={(e) => {
                              setSecuritySettings(prev => ({ ...prev, allowRemoteControl: e.target.checked }));
                              setHasUnsavedChanges(true);
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </SettingRow>

                      <SettingRow label="Allow Clipboard Access" description="Enable clipboard synchronization">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={securitySettings.allowClipboardAccess}
                            onChange={(e) => {
                              setSecuritySettings(prev => ({ ...prev, allowClipboardAccess: e.target.checked }));
                              setHasUnsavedChanges(true);
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </SettingRow>

                      <SettingRow label="Session Timeout">
                        <SliderInput
                          value={securitySettings.sessionTimeout}
                          onChange={(value) => {
                            setSecuritySettings(prev => ({ ...prev, sessionTimeout: value }));
                            setHasUnsavedChanges(true);
                          }}
                          min={5}
                          max={120}
                          step={5}
                          unit=" min"
                        />
                      </SettingRow>
                    </div>
                  )}

                  {/* Advanced Settings */}
                  {section.id === 'advanced' && (
                    <div className="space-y-1">
                      <SettingRow label="Debug Mode" description="Enable detailed logging">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </SettingRow>

                      <SettingRow label="Auto-start on Boot" description="Start application automatically">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </SettingRow>

                      <SettingRow label="Clear Cache" description="Clear application cache and temporary files">
                        <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors">
                          Clear Cache
                        </button>
                      </SettingRow>

                      <SettingRow label="Export Settings" description="Export current settings to file">
                        <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors">
                          Export
                        </button>
                      </SettingRow>

                      <SettingRow label="Import Settings" description="Import settings from file">
                        <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors">
                          Import
                        </button>
                      </SettingRow>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* System Information */}
        <div className="mt-8 bg-gray-800 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Info className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">System Information</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Version:</span>
              <span className="ml-2 text-white">v2.1.0</span>
            </div>
            <div>
              <span className="text-gray-400">WebRTC:</span>
              <span className="ml-2 text-green-400">Supported</span>
            </div>
            <div>
              <span className="text-gray-400">Media Devices:</span>
              <span className="ml-2 text-white">
                {availableDevices.audioInput.length + availableDevices.videoInput.length} detected
              </span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #1e40af;
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #1e40af;
        }
      `}</style>
    </div>
  );
};

export default SettingsPanel;