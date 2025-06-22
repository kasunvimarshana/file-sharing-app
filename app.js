import { SignalingService } from './services/signaling.service.js';
import { PeerService } from './services/peer.service.js';
import { FileService } from './services/file.service.js';

class App {
  constructor() {
    this.myId = 'FSP_' + Math.random().toString(36).slice(2, 10);
    this.logEl = document.getElementById('log');
    document.getElementById('myId').textContent = this.myId;

    this.signaling = new SignalingService(this.myId, this.handleSignal.bind(this));
    this.peerService = new PeerService(this.myId, this.signaling, this);
    this.fileService = new FileService(this);

    this.setupUI();
  }

  setupUI() {
    document.getElementById('connectBtn')
      .addEventListener('click', async () => {
        const remoteId = document.getElementById('remoteIdInput').value.trim();
        if (!remoteId || remoteId === this.myId) {
          this.showNotification('Enter a valid remote peer ID', 'error');
          return;
        }
        await this.peerService.connectToPeer(remoteId);
      });
    document.getElementById('joinRoomBtn')
      .addEventListener('click', async () => {
        const roomId = document.getElementById('roomIdInput').value.trim();
        if (!roomId) {
          this.showNotification('Enter a room ID', 'error');
          return;
        }
        this.showNotification(`Joining room ${roomId}`, 'info');
        this.signaling.send({ room: roomId, from: this.myId }); 
      });
    document.getElementById('sendFileBtn')
      .addEventListener('click', async () => {
        const files = document.getElementById('fileInput').files;
        if (!files.length) {
          this.showNotification('Please select a file first', 'error');
          return;
        }
        this.fileService.sendFile(this.peerService.getActiveChannel(), files[0]);
      });
  }

  handleSignal(data) {
    this.peerService.handleSignal(data);
  }

  showNotification(message, type = 'info') {
    const prefix = {
      info: '[INFO]', success: '[SUCCESS]', error: '[ERROR]', warning: '[WARNING]',
    }[type] || '[INFO]';
    this.log(`${prefix} ${message}`);
  }

  log(msg) {
    const div = document.createElement('div');
    div.textContent = msg;
    this.logEl.appendChild(div);
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }
}
new App();
