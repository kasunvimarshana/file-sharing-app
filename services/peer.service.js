export class PeerService {
  constructor(localId, signaling, app) {
    this.localId = localId;
    this.signaling = signaling;
    this.app = app;
    this.peerConnections = new Map();
    this.dataChannels = new Map();

    this.signaling.on('signal', (data) => this._handleSignal(data));
  }

  async connectToPeer(remoteId) {
    if (this.peerConnections.has(remoteId)) {
      this.app.showNotification(`Already connected to ${remoteId}`, 'warning');
      return;
    }

    const pc = this._createPeerConnection(remoteId);
    this.peerConnections.set(remoteId, pc);

    const dc = pc.createDataChannel('fileTransfer', { ordered: true });
    this._setupDataChannel(remoteId, dc);

    this.app.showNotification(`Creating offer to ${remoteId}...`, 'info');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.signaling.send({ from: this.localId, to: remoteId, offer });
  }

  _createPeerConnection(remoteId) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

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
        case 'connected':
          this.app.showNotification(`Connected to ${remoteId}`, 'success');
          break;
        case 'disconnected':
        case 'failed':
          this.app.showNotification(`Disconnected from ${remoteId}`, 'error');
          break;
        case 'closed':
          this.app.showNotification(`Connection closed with ${remoteId}`, 'warning');
          break;
      }
    };

    return pc;
  }

  async _handleSignal(data) {
    const { from, to, offer, answer, candidate } = data;
    if (to !== this.localId) return;

    if (offer) {
      this.app.showNotification(`Received offer from ${from}`, 'info');
      let pc = this.peerConnections.get(from);
      if (!pc) {
        pc = this._createPeerConnection(from);
        this.peerConnections.set(from, pc);
      }
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answerDesc = await pc.createAnswer();
      await pc.setLocalDescription(answerDesc);
      this.signaling.send({ from: this.localId, to: from, answer: answerDesc });
    }

    if (answer) {
      const pc = this.peerConnections.get(from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    }

    if (candidate) {
      const pc = this.peerConnections.get(from);
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ICE candidate', e);
        }
      }
    }
  }

  _setupDataChannel(remoteId, dataChannel) {
    this.dataChannels.set(remoteId, dataChannel);
    dataChannel.binaryType = 'arraybuffer';

    dataChannel.onopen = () => {
      this.app.showNotification(`Data channel open with ${remoteId}`, 'success');
    };

    dataChannel.onclose = () => {
      this.app.showNotification(`Data channel closed with ${remoteId}`, 'warning');
      this.dataChannels.delete(remoteId);
    };

    dataChannel.onerror = (e) => {
      this.app.showNotification(`Data channel error with ${remoteId}: ${e.message}`, 'error');
    };

    dataChannel.onmessage = (event) => {
      this.app.fileService.handleIncomingData(event.data);
    };
  }

  getActiveDataChannel() {
    // Return first open data channel
    for (const dc of this.dataChannels.values()) {
      if (dc.readyState === 'open') return dc;
    }
    return null;
  }
}
