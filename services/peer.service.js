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
    const { from, to, offer, answer, candidate, room, broadcast } = data;

    // ✅ Room Offer
    if (room && offer && !to && from !== this.localId) {
      const entry = {};
      entry.pc = this.createPeerConnection(from);
      this.peers.set(from, entry);
      await entry.pc.setRemoteDescription(new RTCSessionDescription(offer));
      const ans = await entry.pc.createAnswer();
      await entry.pc.setLocalDescription(ans);
      this.signaling.send({ room, from: this.localId, to: from, answer: ans });
      return;
    }

    // ✅ Answer
    if (answer && this.peers.has(from)) {
      await this.peers.get(from).pc.setRemoteDescription(new RTCSessionDescription(answer));
      return;
    }

    // ✅ Candidate
    if (candidate && this.peers.has(from)) {
      await this.peers.get(from).pc.addIceCandidate(new RTCIceCandidate(candidate));
      return;
    }
  }

  createPeerConnection(remoteId) {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.send({ from: this.localId, to: remoteId, candidate: event.candidate });
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
    channel.onerror = (error) => {
      this.app.showNotification(`Data channel error: ${error.message}`, 'error');
    };
    channel.onmessage = (event) => {
      this.app.fileService.handleIncomingData(event.data);
    };
    channel.onopen = () => {
      this.app.showNotification(`Data channel open with ${remoteId}`, 'success');
    };
    channel.onclose = () => {
      this.app.showNotification(`Data channel closed with ${remoteId}`, 'warning');
    };
  }

  getActiveChannel() {
    return this.dataChannel;
  }
}
