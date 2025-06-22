import React, { useState, useCallback } from 'react';
import { Upload, Download, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import { FileTransfer as FileTransferType } from '../types';

interface FileTransferProps {
  onSendFile: (file: File) => void;
}

export const FileTransfer: React.FC<FileTransferProps> = ({ onSendFile }) => {
  const [transfers, setTransfers] = useState<FileTransferType[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      const transfer: FileTransferType = {
        id: Math.random().toString(36).substring(7),
        name: file.name,
        size: file.size,
        progress: 0,
        status: 'pending',
        direction: 'sending',
      };
      
      setTransfers(prev => [...prev, transfer]);
      onSendFile(file);
      
      // Simulate file transfer progress
      simulateTransfer(transfer.id);
    });
  }, [onSendFile]);

  const simulateTransfer = (transferId: string) => {
    setTransfers(prev => prev.map(t => 
      t.id === transferId ? { ...t, status: 'transferring' } : t
    ));

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTransfers(prev => prev.map(t => 
          t.id === transferId ? { ...t, progress: 100, status: 'completed' } : t
        ));
      } else {
        setTransfers(prev => prev.map(t => 
          t.id === transferId ? { ...t, progress: Math.round(progress) } : t
        ));
      }
    }, 200);
  };

  const removeTransfer = (id: string) => {
    setTransfers(prev => prev.filter(t => t.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: FileTransferType['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <File className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">File Transfer</h2>
        <div className="flex items-center space-x-2 text-sm text-gray-400">
          <Upload className="w-4 h-4" />
          <span>Drag & drop files here</span>
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-8 mb-6 text-center transition-colors ${
          dragOver
            ? 'border-blue-400 bg-blue-400/10'
            : 'border-gray-600 hover:border-gray-500'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-lg text-white mb-2">Drop files to transfer</p>
        <p className="text-sm text-gray-400">
          Files will be sent securely to the remote computer
        </p>
      </div>

      {transfers.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wide">
            Active Transfers
          </h3>
          
          {transfers.map((transfer) => (
            <div key={transfer.id} className="bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(transfer.status)}
                  <div>
                    <p className="text-white font-medium">{transfer.name}</p>
                    <p className="text-xs text-gray-400">
                      {formatFileSize(transfer.size)} • {transfer.direction}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {transfer.direction === 'sending' && (
                    <Upload className="w-4 h-4 text-blue-400" />
                  )}
                  {transfer.direction === 'receiving' && (
                    <Download className="w-4 h-4 text-green-400" />
                  )}
                  <button
                    onClick={() => removeTransfer(transfer.id)}
                    className="p-1 hover:bg-gray-600 text-gray-400 hover:text-white rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {transfer.status === 'transferring' && (
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>Progress</span>
                    <span>{transfer.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${transfer.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};