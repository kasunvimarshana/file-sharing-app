import { AppError } from '../types';

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const validateFile = (file: File): void => {
  const maxSize = 1024 * 1024 * 1024; // 1GB
  const minSize = 1; // 1 byte
  
  if (!file) {
    throw new ValidationError('File is required');
  }
  
  if (file.size > maxSize) {
    throw new ValidationError(`File size exceeds maximum limit of ${formatBytes(maxSize)}`, 'size');
  }
  
  if (file.size < minSize) {
    throw new ValidationError('File is empty', 'size');
  }
  
  if (!file.name || file.name.trim().length === 0) {
    throw new ValidationError('File name is required', 'name');
  }
  
  if (file.name.length > 255) {
    throw new ValidationError('File name is too long', 'name');
  }
  
  // Check for potentially dangerous file extensions
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  
  if (dangerousExtensions.includes(extension)) {
    throw new ValidationError('File type not allowed for security reasons', 'type');
  }
};

export const validatePeerId = (peerId: string): void => {
  if (!peerId || typeof peerId !== 'string') {
    throw new ValidationError('Peer ID is required');
  }
  
  if (peerId.length < 10 || peerId.length > 50) {
    throw new ValidationError('Peer ID must be between 10 and 50 characters');
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(peerId)) {
    throw new ValidationError('Peer ID contains invalid characters');
  }
};

export const validateFileHash = (hash: string): void => {
  if (!hash || typeof hash !== 'string') {
    throw new ValidationError('File hash is required');
  }
  
  if (!/^[a-f0-9]{64}$/i.test(hash)) {
    throw new ValidationError('Invalid file hash format');
  }
};

export const validateRoomId = (roomId: string): void => {
  if (!roomId || typeof roomId !== 'string') {
    throw new ValidationError('Room ID is required');
  }
  
  if (roomId.length < 1 || roomId.length > 50) {
    throw new ValidationError('Room ID must be between 1 and 50 characters');
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(roomId)) {
    throw new ValidationError('Room ID contains invalid characters');
  }
};

export const sanitizeString = (input: string, maxLength: number = 255): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .substring(0, maxLength)
    .replace(/[<>\"'&]/g, ''); // Remove potentially dangerous characters
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};