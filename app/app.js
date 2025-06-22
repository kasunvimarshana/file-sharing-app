import { SignalingService } from './services/signaling.service.js';
import { PeerService } from './services/peer.service.js';
import { FileService } from './services/file.service.js';

class FileSharingApp {
  constructor() {
    this.peerId = `FSP_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    this.signalingService = new SignalingService(this.peerId);
    this.peerService = new PeerService(this.peerId, this.signalingService, this);
    this.fileService = new FileService(this);

    this._initUI();
    this.signalingService.connect();

    this._log(`App initialized with Peer ID: ${this.peerId}`, 'success');
    document.getElementById('myPeerId').textContent = this.peerId;
  }

  _initUI() {
    document.getElementById('connectButton').addEventListener('click', () => {
      const remoteId = document.getElementById('remotePeerId').value.trim();
      if (!remoteId) {
        this._log('Please enter a remote peer ID', 'error');
        return;
      }
      this.peerService.connectToPeer(remoteId);
    });

    document.getElementById('fileInput').addEventListener('change', e => {
      this._sendFiles(Array.from(e.target.files));
      e.target.value = '';
    });

    const dropZone = document.getElementById('fileDropZone');
    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      this._sendFiles(Array.from(e.dataTransfer.files));
    });
  }

  _sendFiles(files) {
    const channel = this.peerService.getActiveDataChannel();
    if (!channel) {
      this._log('No active data channel. Connect to a peer first.', 'error');
      return;
    }
    files.forEach(file => {
      this._log(`Sending file "${file.name}" (${this._formatBytes(file.size)})...`, 'info');
      this.fileService.sendFile(channel, file);
    });
  }

  _log(message, type = 'info') {
    const logs = document.getElementById('logs');
    const el = document.createElement('div');
    el.textContent = message;
    el.className = `log-${type}`;
    logs.appendChild(el);
    logs.scrollTop = logs.scrollHeight;
  }

  showNotification(message, type = 'info') {
    this._log(message, type);
  }

  _formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${bytes.toFixed(2)} ${units[i]}`;
  }
}

window.app = new FileSharingApp();
