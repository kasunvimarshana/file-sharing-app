import React, { useState, useRef } from 'react';
import { Upload, Download, File, FolderOpen, Plus, Search, Filter } from 'lucide-react';

export function FileManager({ p2pClient, torrents }) {
  const [dragActive, setDragActive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const fileInputRef = useRef(null);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFiles = async (files) => {
    for (let i = 0; i < files.length; i++) {
      if (p2pClient) {
        try {
          await p2pClient.addFile(files[i]);
        } catch (error) {
          console.error('Error adding file:', error);
        }
      }
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const handleDownload = (torrent) => {
    if (p2pClient && torrent.status === 'available') {
      p2pClient.downloadFile(torrent.hash);
    }
  };

  const filteredTorrents = torrents.filter(torrent => {
    const matchesSearch = torrent.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || torrent.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'seeding': return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'downloading': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      case 'available': return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">File Manager</h2>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg hover:from-cyan-600 hover:to-purple-600 transition-all duration-200"
        >
          <Plus className="w-5 h-5" />
          <span>Add File</span>
        </button>
      </div>

      {/* File Upload Area */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
          dragActive 
            ? 'border-cyan-400 bg-cyan-500/10' 
            : 'border-gray-600 hover:border-gray-500'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">
          Drag and drop files here
        </h3>
        <p className="text-gray-400 mb-4">
          or click the button above to select files
        </p>
        <p className="text-sm text-gray-500">
          Supported formats: All file types
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="pl-10 pr-8 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none"
          >
            <option value="all">All Status</option>
            <option value="seeding">Seeding</option>
            <option value="downloading">Downloading</option>
            <option value="available">Available</option>
          </select>
        </div>
      </div>

      {/* File List */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        {filteredTorrents.length > 0 ? (
          <div className="divide-y divide-white/5">
            {filteredTorrents.map((torrent) => (
              <div key={torrent.hash} className="p-4 hover:bg-white/5 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <File className="w-8 h-8 text-cyan-400" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium truncate">
                        {torrent.name}
                      </h4>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-sm text-gray-400">
                          {formatBytes(torrent.size)}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(torrent.status)}`}>
                          {torrent.status}
                        </span>
                        {torrent.uploadedAt && (
                          <span className="text-sm text-gray-400">
                            {formatDate(torrent.uploadedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    {/* Progress Bar */}
                    {(torrent.status === 'downloading' || torrent.progress < 100) && (
                      <div className="w-32">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">Progress</span>
                          <span className="text-white">{torrent.progress.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-cyan-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${torrent.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Peers */}
                    <div className="text-center">
                      <div className="text-sm text-white">{torrent.seeders || 0}</div>
                      <div className="text-xs text-gray-400">Seeders</div>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2">
                      {torrent.status === 'available' && (
                        <button
                          onClick={() => handleDownload(torrent)}
                          className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors duration-200"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      {torrent.status === 'seeding' && (
                        <div className="p-2 bg-green-500/20 text-green-400 rounded-lg" title="Seeding">
                          <Upload className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <File className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-400 mb-2">
              {searchTerm || filterStatus !== 'all' ? 'No files match your search' : 'No files available'}
            </h3>
            <p className="text-gray-500">
              {searchTerm || filterStatus !== 'all' 
                ? 'Try adjusting your search or filter criteria' 
                : 'Upload files to start sharing with the network'
              }
            </p>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}