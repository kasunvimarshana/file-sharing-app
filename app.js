import { SignalingService } from './services/signaling.service.js';
import { PeerService } from './services/peer.service.js';
import { FileService } from './services/file.service.js';

class FileShareApp {
  constructor() {
    this.peerId = `FSP_${Math.random().toString(36).slice(2, 12)}_${Date.now().toString(36)}`;

    this.signaling = new SignalingService(this.peerId);
    this.peerService = new PeerService(this.peerId, this.signaling, this);
    this.fileService = new FileService(this);

    this._initUI();
    this.signaling.connect();
    this._log(`System initialized with Peer ID: ${this.peerId}`, 'success');
    document.getElementById('myPeerId').textContent = this.peerId;
  }

  _initUI() {
    document.getElementById('connectButton').addEventListener('click', async () => {
      const remoteId = document.getElementById('remotePeerId').value.trim();
      if (!remoteId) {
        this._log('Please enter a peer ID or room name.', 'error');
        return;
      }

      if (remoteId.startsWith('ROOM_')) {
        this.signaling.joinRoom(remoteId);
        this._log(`Joined room ${remoteId}`, 'info');
      } else {
        await this.peerService.connectToPeer(remoteId);
      }
    });

    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', (e) => {
      this._sendFiles(Array.from(e.target.files));
    });

    const dropZone = document.getElementById('fileDropZone');
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', (e) => {
      dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      this._sendFiles(Array.from(e.dataTransfer.files));
    });
  }

  _sendFiles(files) {
    const channel = this.peerService.getActiveDataChannel();
    if (!channel) {
      this._log('No open data channel. Connect to a peer first.', 'error');
      return;
    }

    files.forEach((file) => {
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

  showNotification(message, type) {
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

window.app = new FileShareApp();
