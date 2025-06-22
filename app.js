import { SignalingService } from './services/signaling.service.js';
import { PeerService } from './services/peer.service.js';
import { FileService } from './services/file.service.js';

class FileShareApp {
  constructor() {
    this.peerId = `FSP_${Math.random().toString(36).substring(2, 12)}_${Date.now().toString(36)}`;
    this.signaling = new SignalingService(this.peerId);
    this.peerService = new PeerService(this.peerId, this.signaling, this);
    this.fileService = new FileService(this);
    this.init();
  }

  init() {
    this.showNotification(`System initialized.`, 'success');
    this.registerUI();
    this.signaling.connect();
    document.getElementById('myPeerId').textContent = this.peerId;
  }

  registerUI() {
    document.getElementById('connectButton').addEventListener('click', async () => {
      const remoteId = document.getElementById('remotePeerId').value.trim();
      if (!remoteId) {
        this.showNotification('Enter a valid Peer ID or Room Name.', 'warning');
        return;
      }
      if (remoteId.startsWith('ROOM_')) {
        this.signaling.joinRoom(remoteId);
      } else {
        await this.peerService.connectToPeer(remoteId);
      }
    });
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', (e) => {
      this.handleFiles(Array.from(e.target.files));
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
      this.handleFiles(Array.from(e.dataTransfer.files));
    });
  }

  handleFiles(files) {
    files.forEach((file) => {
      if (this.peerService.getActiveChannel()) {
        this.showNotification(`Sending ${file.name}...`, 'info');
        this.fileService.sendFile(this.peerService.getActiveChannel(), file);
      } else {
        this.showNotification(`⚠️ No open data channel. Will send when available.`, 'warning');
      }
    });
  }

  showNotification(message, type) {
    const elem = document.createElement('div');
    elem.textContent = message;
    elem.className = `log ${type}`;
    document.getElementById('logs').appendChild(elem);
  }
}
new FileShareApp();
