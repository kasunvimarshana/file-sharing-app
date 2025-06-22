import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, File, Image, Archive, FileText, Trash2, Eye, MoreVertical, X, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { FileTransferManager } from '../utils/webrtc';

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadDate: Date;
  status: 'uploading' | 'completed' | 'failed' | 'paused';
  progress?: number;
  speed?: number;
  timeRemaining?: number;
}

const FileTransfer: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>([
    {
      id: '1',
      name: 'presentation.pptx',
      size: 2048000,
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      uploadDate: new Date(Date.now() - 3600000),
      status: 'completed'
    },
    {
      id: '2',
      name: 'screenshot.png',
      size: 512000,
      type: 'image/png',
      uploadDate: new Date(Date.now() - 1800000),
      status: 'completed'
    }
  ]);

  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [transferStats, setTransferStats] = useState({
    totalFiles: 0,
    completedFiles: 0,
    totalSize: 0,
    transferredSize: 0,
    currentSpeed: 0
  });
  const [showPreview, setShowPreview] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileTransferManager = useRef<FileTransferManager | null>(null);

  useEffect(() => {
    // Initialize file transfer manager
    fileTransferManager.current = new FileTransferManager();
    
    fileTransferManager.current.onProgress((progress, fileName) => {
      setFiles(prev => prev.map(file => 
        file.name === fileName 
          ? { ...file, progress, status: progress === 100 ? 'completed' : 'uploading' }
          : file
      ));
    });

    fileTransferManager.current.onComplete((fileName, data) => {
      console.log('File transfer completed:', fileName, data.byteLength, 'bytes');
      setFiles(prev => prev.map(file => 
        file.name === fileName 
          ? { ...file, status: 'completed', progress: 100 }
          : file
      ));
    });

    fileTransferManager.current.onError((error, fileName) => {
      console.error('File transfer error:', error, fileName);
      setFiles(prev => prev.map(file => 
        file.name === fileName 
          ? { ...file, status: 'failed' }
          : file
      ));
    });

    return () => {
      fileTransferManager.current = null;
    };
  }, []);

  useEffect(() => {
    // Update transfer stats
    const stats = files.reduce((acc, file) => {
      acc.totalFiles++;
      acc.totalSize += file.size;
      
      if (file.status === 'completed') {
        acc.completedFiles++;
        acc.transferredSize += file.size;
      } else if (file.status === 'uploading' && file.progress) {
        acc.transferredSize += (file.size * file.progress) / 100;
      }
      
      return acc;
    }, {
      totalFiles: 0,
      completedFiles: 0,
      totalSize: 0,
      transferredSize: 0,
      currentSpeed: 0
    });

    setTransferStats(stats);
  }, [files]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number) => {
    return formatFileSize(bytesPerSecond) + '/s';
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-5 h-5 text-blue-500" />;
    if (type.includes('zip') || type.includes('archive') || type.includes('compressed')) return <Archive className="w-5 h-5 text-yellow-500" />;
    if (type.includes('text') || type.includes('document') || type.includes('pdf')) return <FileText className="w-5 h-5 text-green-500" />;
    return <File className="w-5 h-5 text-gray-400" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'uploading':
        return <Clock className="w-4 h-4 text-blue-400 animate-spin" />;
      default:
        return null;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFileUpload(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      handleFileUpload(selectedFiles);
    }
  };

  const handleFileUpload = async (filesToUpload: File[]) => {
    for (const file of filesToUpload) {
      const fileItem: FileItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        type: file.type,
        uploadDate: new Date(),
        status: 'uploading',
        progress: 0,
        speed: 0,
        timeRemaining: 0
      };

      setFiles(prev => [...prev, fileItem]);

      // Start file transfer
      if (fileTransferManager.current) {
        try {
          await fileTransferManager.current.sendFile(file);
        } catch (error) {
          console.error('Failed to send file:', error);
          setFiles(prev => prev.map(f => 
            f.id === fileItem.id ? { ...f, status: 'failed' } : f
          ));
        }
      } else {
        // Simulate file upload progress for demo
        simulateFileUpload(fileItem);
      }
    }
  };

  const simulateFileUpload = (fileItem: FileItem) => {
    let progress = 0;
    const startTime = Date.now();
    
    const uploadInterval = setInterval(() => {
      progress += Math.random() * 15 + 5; // 5-20% increments
      
      if (progress >= 100) {
        progress = 100;
        clearInterval(uploadInterval);
        
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id 
            ? { ...f, progress: 100, status: 'completed', speed: 0, timeRemaining: 0 }
            : f
        ));
      } else {
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = (fileItem.size * progress / 100) / elapsed;
        const remaining = fileItem.size * (100 - progress) / 100;
        const timeRemaining = remaining / speed;
        
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id 
            ? { ...f, progress, speed, timeRemaining }
            : f
        ));
      }
    }, 500 + Math.random() * 1000);
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const selectAllFiles = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map(f => f.id));
    }
  };

  const deleteSelectedFiles = () => {
    setFiles(prev => prev.filter(f => !selectedFiles.includes(f.id)));
    setSelectedFiles([]);
  };

  const pauseFile = (fileId: string) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId && f.status === 'uploading'
        ? { ...f, status: 'paused' }
        : f
    ));
  };

  const resumeFile = (fileId: string) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId && f.status === 'paused'
        ? { ...f, status: 'uploading' }
        : f
    ));
  };

  const retryFile = (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (file) {
      setFiles(prev => prev.map(f => 
        f.id === fileId
          ? { ...f, status: 'uploading', progress: 0 }
          : f
      ));
      simulateFileUpload(file);
    }
  };

  const downloadFile = (file: FileItem) => {
    // Create a blob URL for download simulation
    const blob = new Blob(['File content for ' + file.name], { type: file.type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const previewFile = (file: FileItem) => {
    if (file.type.startsWith('image/')) {
      setShowPreview(file.id);
    } else {
      // For non-image files, just download them
      downloadFile(file);
    }
  };

  return (
    <div className="flex-1 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">File Transfer</h2>
            <p className="text-gray-400">Share files between connected devices</p>
          </div>
          
          <div className="flex items-center space-x-3">
            {selectedFiles.length > 0 && (
              <button
                onClick={deleteSelectedFiles}
                className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete ({selectedFiles.length})</span>
              </button>
            )}
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              <Upload className="w-5 h-5" />
              <span>Upload Files</span>
            </button>
          </div>
        </div>

        {/* Transfer Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-white">{transferStats.completedFiles}/{transferStats.totalFiles}</p>
                <p className="text-sm text-gray-400">Files Completed</p>
              </div>
              <File className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-white">
                  {formatFileSize(transferStats.transferredSize)}
                </p>
                <p className="text-sm text-gray-400">
                  of {formatFileSize(transferStats.totalSize)}
                </p>
              </div>
              <Archive className="w-8 h-8 text-green-500" />
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-white">
                  {files.filter(f => f.status === 'uploading').length}
                </p>
                <p className="text-sm text-gray-400">In Progress</p>
              </div>
              <Upload className="w-8 h-8 text-yellow-500" />
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-white">
                  {Math.round((transferStats.transferredSize / transferStats.totalSize) * 100) || 0}%
                </p>
                <p className="text-sm text-gray-400">Overall Progress</p>
              </div>
              <CheckCircle className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 mb-6 transition-colors ${
            dragOver
              ? 'border-blue-500 bg-blue-500 bg-opacity-10'
              : 'border-gray-600 bg-gray-800'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {dragOver ? 'Drop files here' : 'Drag and drop files here'}
            </h3>
            <p className="text-gray-400 mb-4">
              or{' '}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-400 hover:text-blue-300 underline"
              >
                browse to choose files
              </button>
            </p>
            <p className="text-sm text-gray-500">
              Supports all file types • Max 100MB per file
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* File List */}
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h3 className="text-lg font-semibold text-white">Transferred Files</h3>
                <span className="text-sm text-gray-400">{files.length} files</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={selectAllFiles}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  {selectedFiles.length === files.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-700">
            {files.length === 0 ? (
              <div className="p-12 text-center">
                <File className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No files transferred yet</p>
                <p className="text-sm text-gray-500 mt-1">Upload files to share with connected users</p>
              </div>
            ) : (
              files.map((file) => (
                <div
                  key={file.id}
                  className={`px-6 py-4 hover:bg-gray-750 transition-colors ${
                    selectedFiles.includes(file.id) ? 'bg-blue-900 bg-opacity-30' : ''
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <input
                      type="checkbox"
                      checked={selectedFiles.includes(file.id)}
                      onChange={() => toggleFileSelection(file.id)}
                      className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                    
                    <div className="flex-shrink-0">
                      {getFileIcon(file.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white truncate">{file.name}</p>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(file.status)}
                          <span className="text-xs text-gray-400">
                            {formatFileSize(file.size)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {file.uploadDate.toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      {file.status === 'uploading' && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-400">
                              Uploading... {Math.round(file.progress || 0)}%
                            </span>
                            <div className="flex items-center space-x-2 text-gray-400">
                              {file.speed && <span>{formatSpeed(file.speed)}</span>}
                              {file.timeRemaining && <span>• {formatTime(file.timeRemaining)} left</span>}
                            </div>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-1.5">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${file.progress || 0}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      
                      {file.status === 'completed' && (
                        <div className="flex items-center space-x-4 mt-2">
                          <span className="text-xs text-green-400">✓ Completed</span>
                        </div>
                      )}

                      {file.status === 'failed' && (
                        <div className="flex items-center space-x-4 mt-2">
                          <span className="text-xs text-red-400">✗ Failed</span>
                          <button
                            onClick={() => retryFile(file.id)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            Retry
                          </button>
                        </div>
                      )}

                      {file.status === 'paused' && (
                        <div className="flex items-center space-x-4 mt-2">
                          <span className="text-xs text-yellow-400">⏸ Paused</span>
                          <button
                            onClick={() => resumeFile(file.id)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            Resume
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => downloadFile(file)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4 text-gray-400" />
                      </button>
                      
                      <button
                        onClick={() => previewFile(file)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4 text-gray-400" />
                      </button>

                      {file.status === 'uploading' && (
                        <button
                          onClick={() => pauseFile(file.id)}
                          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                          title="Pause"
                        >
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      )}
                      
                      <button
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        title="More options"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* File Preview Modal */}
        {showPreview && (
          
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">File Preview</h3>
                <button
                  onClick={() => setShowPreview(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="text-center">
                <div className="bg-gray-700 rounded-lg p-8 mb-4">
                  <File className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-300">Preview not available</p>
                  <p className="text-sm text-gray-500">This file type cannot be previewed</p>
                </div>
                
                <button
                  onClick={() => {
                    const file = files.find(f => f.id === showPreview);
                    if (file) downloadFile(file);
                    setShowPreview(null);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  Download File
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileTransfer;