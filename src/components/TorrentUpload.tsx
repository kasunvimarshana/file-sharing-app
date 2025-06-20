import React, { useCallback, useState } from 'react';
import { Upload, FileText, Plus } from 'lucide-react';

interface TorrentUploadProps {
  onTorrentAdd: (file: File) => void;
  onTorrentCreate: (files: File[], announce: string, comment?: string) => void;
}

export function TorrentUpload({ onTorrentAdd, onTorrentCreate }: TorrentUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [announceUrl, setAnnounceUrl] = useState('http://localhost:3000/api/announce');
  const [comment, setComment] = useState('');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (createMode) {
      setSelectedFiles(prev => [...prev, ...files]);
    } else {
      const torrentFiles = files.filter(file => file.name.endsWith('.torrent'));
      torrentFiles.forEach(onTorrentAdd);
    }
  }, [createMode, onTorrentAdd]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (createMode) {
      setSelectedFiles(prev => [...prev, ...files]);
    } else {
      const torrentFiles = files.filter(file => file.name.endsWith('.torrent'));
      torrentFiles.forEach(onTorrentAdd);
    }
  };

  const handleCreateTorrent = () => {
    if (selectedFiles.length > 0) {
      onTorrentCreate(selectedFiles, announceUrl, comment || undefined);
      setSelectedFiles([]);
      setComment('');
      setCreateMode(false);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-green-400" />
          {createMode ? 'Create Torrent' : 'Add Torrent'}
        </h2>
        
        <div className="flex gap-2">
          <button
            onClick={() => {
              setCreateMode(false);
              setSelectedFiles([]);
            }}
            className={`px-4 py-2 rounded-lg transition-colors ${
              !createMode 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Add Torrent
          </button>
          <button
            onClick={() => {
              setCreateMode(true);
              setSelectedFiles([]);
            }}
            className={`px-4 py-2 rounded-lg transition-colors ${
              createMode 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Create Torrent
          </button>
        </div>
      </div>

      {createMode ? (
        <div className="space-y-4">
          {/* File Selection for Creation */}
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-green-400 bg-green-400/10'
                : 'border-gray-600 bg-gray-800/50 hover:border-green-400/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="file-upload-create"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileSelect}
              multiple
              accept="*"
            />
            <Plus className="w-12 h-12 mx-auto mb-4 text-green-400" />
            <p className="text-lg font-semibold text-white mb-2">
              Select files to include in torrent
            </p>
            <p className="text-gray-400 text-sm">
              Drag and drop files here, or click to browse
            </p>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-3">Selected Files ({selectedFiles.length})</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-700 rounded p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate">{file.name}</p>
                      <p className="text-gray-400 text-xs">{formatBytes(file.size)}</p>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="ml-2 text-red-400 hover:text-red-300 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Torrent Settings */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Announce URL (Tracker)
              </label>
              <input
                type="url"
                value={announceUrl}
                onChange={(e) => setAnnounceUrl(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-green-400 focus:outline-none"
                placeholder="http://tracker.example.com/announce"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Comment (Optional)
              </label>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-green-400 focus:outline-none"
                placeholder="Description of the torrent content"
              />
            </div>
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreateTorrent}
            disabled={selectedFiles.length === 0}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Create Torrent File
          </button>
        </div>
      ) : (
        /* Torrent Upload */
        <div
          className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            dragActive
              ? 'border-green-400 bg-green-400/10'
              : 'border-gray-600 bg-gray-800/50 hover:border-green-400/50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="file-upload"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileSelect}
            multiple
            accept=".torrent"
          />
          <Upload className="w-16 h-16 mx-auto mb-4 text-green-400" />
          <p className="text-xl font-semibold text-white mb-2">
            Drop torrent files here
          </p>
          <p className="text-gray-400">
            or click to browse for .torrent files
          </p>
        </div>
      )}
    </div>
  );
}