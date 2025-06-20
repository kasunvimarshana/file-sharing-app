import React from 'react';
import { Download, File, Clock, Shield, Users } from 'lucide-react';

const FileList = ({ files, onDownload }) => {
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimeAgo = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const iconClass = "w-8 h-8";
    
    switch (ext) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <div className={`${iconClass} bg-green-500 rounded-lg flex items-center justify-center text-white font-bold text-sm`}>IMG</div>;
      case 'mp4':
      case 'avi':
      case 'mkv':
        return <div className={`${iconClass} bg-red-500 rounded-lg flex items-center justify-center text-white font-bold text-sm`}>VID</div>;
      case 'mp3':
      case 'wav':
      case 'flac':
        return <div className={`${iconClass} bg-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-sm`}>AUD</div>;
      case 'pdf':
        return <div className={`${iconClass} bg-red-600 rounded-lg flex items-center justify-center text-white font-bold text-sm`}>PDF</div>;
      case 'doc':
      case 'docx':
        return <div className={`${iconClass} bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm`}>DOC</div>;
      case 'zip':
      case 'rar':
      case '7z':
        return <div className={`${iconClass} bg-yellow-600 rounded-lg flex items-center justify-center text-white font-bold text-sm`}>ZIP</div>;
      default:
        return <File className={`${iconClass} text-gray-400`} />;
    }
  };

  if (files.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <File className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p className="text-lg mb-2">No files available</p>
        <p className="text-sm">Files shared by peers will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {files.map((file) => (
        <div
          key={file.id}
          className="group p-4 bg-gray-700/30 hover:bg-gray-700/50 border border-gray-600/50 hover:border-gray-500/50 rounded-lg transition-all duration-200"
        >
          <div className="flex items-start space-x-4">
            {/* File Icon */}
            <div className="flex-shrink-0">
              {getFileIcon(file.name)}
            </div>
            
            {/* File Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate group-hover:text-emerald-400 transition-colors">
                    {file.name}
                  </h3>
                  <div className="flex items-center space-x-4 mt-1 text-sm text-gray-400">
                    <div className="flex items-center space-x-1">
                      <File className="w-3 h-3" />
                      <span>{formatFileSize(file.size)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeAgo(file.timestamp)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Users className="w-3 h-3" />
                      <span>{file.seeders || 1} seeder{(file.seeders || 1) !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => onDownload(file.id)}
                  className="ml-4 px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 opacity-0 group-hover:opacity-100"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
              </div>
              
              {/* File Hash & Security */}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Shield className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs font-mono text-gray-500">
                    SHA256: {file.hash?.slice(0, 16)}...
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-xs text-emerald-400">Verified</span>
                </div>
              </div>
              
              {/* Progress Bar (if downloading) */}
              {file.downloading && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>Downloading...</span>
                    <span>{Math.round(file.progress || 0)}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${file.progress || 0}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FileList;