import React, { useState } from 'react';
import { X, Monitor, Volume2, Wifi, Eye } from 'lucide-react';
import { Settings as SettingsType } from '../types';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SettingsType;
  onSettingsChange: (settings: SettingsType) => void;
}

export const Settings: React.FC<SettingsProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
}) => {
  const [localSettings, setLocalSettings] = useState(settings);

  const handleSave = () => {
    onSettingsChange(localSettings);
    onClose();
  };

  const handleReset = () => {
    const defaultSettings: SettingsType = {
      quality: 'medium',
      audioEnabled: true,
      autoConnect: false,
      showPointer: true,
    };
    setLocalSettings(defaultSettings);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-96 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 text-gray-400 hover:text-white rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Display Quality */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Monitor className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-medium text-white">Display Quality</h3>
            </div>
            <div className="space-y-2">
              {(['low', 'medium', 'high'] as const).map((quality) => (
                <label key={quality} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="quality"
                    value={quality}
                    checked={localSettings.quality === quality}
                    onChange={(e) => setLocalSettings(prev => ({
                      ...prev,
                      quality: e.target.value as SettingsType['quality']
                    }))}
                    className="text-blue-600"
                  />
                  <span className="text-gray-300 capitalize">{quality}</span>
                  <span className="text-xs text-gray-500">
                    {quality === 'low' && '720p, Lower bandwidth'}
                    {quality === 'medium' && '1080p, Balanced'}
                    {quality === 'high' && '1440p+, High bandwidth'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Audio Settings */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Volume2 className="w-5 h-5 text-green-400" />
              <h3 className="text-lg font-medium text-white">Audio</h3>
            </div>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.audioEnabled}
                onChange={(e) => setLocalSettings(prev => ({
                  ...prev,
                  audioEnabled: e.target.checked
                }))}
                className="text-blue-600"
              />
              <span className="text-gray-300">Enable audio transmission</span>
            </label>
          </div>

          {/* Connection Settings */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Wifi className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-medium text-white">Connection</h3>
            </div>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.autoConnect}
                onChange={(e) => setLocalSettings(prev => ({
                  ...prev,
                  autoConnect: e.target.checked
                }))}
                className="text-blue-600"
              />
              <span className="text-gray-300">Auto-connect to recent sessions</span>
            </label>
          </div>

          {/* Display Settings */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Eye className="w-5 h-5 text-yellow-400" />
              <h3 className="text-lg font-medium text-white">Display</h3>
            </div>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.showPointer}
                onChange={(e) => setLocalSettings(prev => ({
                  ...prev,
                  showPointer: e.target.checked
                }))}
                className="text-blue-600"
              />
              <span className="text-gray-300">Show remote mouse pointer</span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-700">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Reset to Defaults
          </button>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};