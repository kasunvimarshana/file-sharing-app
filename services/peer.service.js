export class PeerService {
  constructor(localId, signaling, app) {
    this.localId = localId;
    this.signaling = signaling;
    this.app = app;

    this.peers = new Map();
    this.dataChannel = null;
    this.activeRemoteId = null;
  }

  async connectToPeer(remoteId) {
    this.activeRemoteId = remoteId;

    const pc = this.createPeerConnection(remoteId);
    this.peers.set(remoteId, { pc });

    const channel = pc.createDataChannel('fileTransfer');
    this.setupChannel(remoteId, channel);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.signaling.send({ from: this.localId, to: remoteId, type: 'offer', offer });
  }

  async handleSignal(data) {
    const { from, to, offer, answer, candidate, type } = data;

    if (to !== this.localId) return;

    let entry = this.peers.get(from);
    if (!entry) {
      entry = {};
      entry.pc = this.createPeerConnection(from);
      this.peers.set(from, entry);
    }

    const pc = entry.pc;

    if (type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.signaling.send({ from: this.localId, to: from, type: 'answer', answer });
    } else if (type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } else if (type === 'candidate' && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        this.app.showNotification('Error adding ICE candidate: ' + error, 'error');
      }
    }
  }

  createPeerConnection(remoteId) {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.send({ from: this.localId, to: remoteId, type: 'candidate', candidate: event.candidate });
      }
    };

    pc.ondatachannel = (event) => {
      this.setupChannel(remoteId, event.channel);
    };

    pc.onconnectionstatechange = () => {
      this.app.showNotification(`Connection state with ${remoteId}: ${pc.connectionState}`, 'info');
    };

    return pc;
  }

  setupChannel(remoteId, channel) {
    this.dataChannel = channel;

    channel.onopen = () => {
      this.app.showNotification(`Data channel open with ${remoteId}`, 'success');
    };

    channel.onerror = (error) => {
      this.app.showNotification(`Data channel error: ${error.message}`, 'error');
    };

    channel.onmessage = (event) => {
      this.app.fileService.handleIncomingData(event.data);
    };

    channel.onclose = () => {
      this.app.showNotification(`Data channel closed with ${remoteId}`, 'warning');
    };
  }

  getActiveChannel() {
    return this.dataChannel;
  }
}
