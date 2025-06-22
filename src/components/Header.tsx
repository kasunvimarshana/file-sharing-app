import React from 'react';
import { Monitor, Settings, Info } from 'lucide-react';

interface HeaderProps {
  onSettingsClick: () => void;
  onAboutClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onSettingsClick, onAboutClick }) => {
  return (
    <header className="bg-gray-900 border-b border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
            <Monitor className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">RemoteDesk Pro</h1>
            <p className="text-sm text-gray-400">Professional Remote Desktop Solution</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onSettingsClick}
            className="flex items-center space-x-2 px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
          <button
            onClick={onAboutClick}
            className="flex items-center space-x-2 px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Info className="w-4 h-4" />
            <span>About</span>
          </button>
        </div>
      </div>
    </header>
  );
};