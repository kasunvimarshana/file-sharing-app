export class PeerService {
  constructor(localId, signaling, app) {
    this.localId = localId;
    this.signaling = signaling;
    this.app = app;

    this.peers = new Map();
    this.dataChannel = null;

    this.signaling.on('signal', (data) => this.handleSignal(data));
  }

  async connectToPeer(remoteId) {
    if (this.peers.has(remoteId)) {
      this.app.showNotification(`Already connected to ${remoteId}`, 'warning');
      return;
    }
    const pc = this._createPeerConnection(remoteId);
    this.peers.set(remoteId, { pc });
    this.dataChannel = pc.createDataChannel('fileTransfer');
    this._setupDataChannel(remoteId, this.dataChannel);

    this.app.showNotification(`⏳ Creating offer for ${remoteId}...`, 'info');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.signaling.send({ from: this.localId, to: remoteId, offer });
  }

  async handleSignal(data) {
    const { from, offer, answer, candidate } = data;

    if (offer && from !== this.localId) {
      this.app.showNotification(`📥 Received offer from ${from}. Creating answer...`, 'info');
      const pc = this._createPeerConnection(from);
      this.peers.set(from, { pc });
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      this.signaling.send({ from: this.localId, to: from, answer: ans });
    }

    if (answer && this.peers.has(from)) {
      this.app.showNotification(`✅ Answer received from ${from}. Finalizing...`, 'success');
      await this.peers.get(from).pc.setRemoteDescription(new RTCSessionDescription(answer));
    }

    if (candidate && this.peers.has(from)) {
      await this.peers.get(from).pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  _createPeerConnection(remoteId) {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.send({ from: this.localId, to: remoteId, candidate: event.candidate });
      }
    };
    pc.ondatachannel = (event) => {
      this._setupDataChannel(remoteId, event.channel);
    };
    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case 'new':
        case 'connecting':
          this.app.showNotification(`⏳ Connecting to ${remoteId}...`, 'info');
          break;
        case 'connected':
          this.app.showNotification(`✅ Connected to ${remoteId}!`, 'success');
          break;
        case 'disconnected':
        case 'failed':
          this.app.showNotification(`❌ Disconnected from ${remoteId}.`, 'error');
          break;
        case 'closed':
          this.app.showNotification(`🔴 Connection to ${remoteId} closed.`, 'warning');
          break;
      }
    };
    return pc;
  }

  _setupDataChannel(remoteId, channel) {
    this.dataChannel = channel;

    channel.onerror = (error) =>
      this.app.showNotification(`❌ Data channel error: ${error.message}`, 'error');
    channel.onmessage = (event) =>
      this.app.fileService.handleIncomingData(event.data);
    channel.onopen = () =>
      this.app.showNotification(`✅ Data channel with ${remoteId} is open. You can send files now.`, 'success');
    channel.onclose = () =>
      this.app.showNotification(`⚠️ Data channel with ${remoteId} has closed.`, 'warning');
  }

  getActiveChannel() {
    return this.dataChannel && this.dataChannel.readyState === 'open' ? this.dataChannel : null;
  }
}
