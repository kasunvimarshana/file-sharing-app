export class FileService {
  constructor(app) {
    this.app = app;

    this.chunkSize = 16000;
    this.currentFiles = new Map();
  }

  sendFile(dataChannel, file) {
    if (!dataChannel || dataChannel.readyState !== 'open') {
      this.app.showNotification('Data channel is not open', 'error');
      return;
    }

    const id = Math.random().toString(36).substring(2, 10);
    const metadata = {
      type: 'file-metadata',
      id,
      name: file.name,
      size: file.size
    };
    dataChannel.send(JSON.stringify(metadata));

    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target.result;

      for (let offset = 0; offset < buffer.byteLength; offset += this.chunkSize) {
        const chunk = buffer.slice(offset, offset + this.chunkSize);
        dataChannel.send(chunk);
      }

      this.app.showNotification(`Sent ${file.name}!`, 'success');
    };
    reader.readAsArrayBuffer(file);
  }

  handleIncomingData(data) {
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'file-metadata') {
          this.currentFiles.set(parsed.id, {
            id: parsed.id,
            name: parsed.name,
            size: parsed.size,
            data: []
          });
          this.app.showNotification(`Receiving ${parsed.name} (${parsed.size} bytes)...`, 'info');
        }
      } catch {
        this.app.showNotification('Invalid metadata received', 'error');
      }
    } else {
      for (const [id, file] of this.currentFiles.entries()) {
        if (file.data.length < file.size) {
          file.data.push(data);
          const receivedBytes = file.data.reduce((sum, chunk) => sum + chunk.byteLength, 0);
          if (receivedBytes >= file.size) {
            this._saveReceivedFile(file);
            this.currentFiles.delete(id);
            break;
          }
        }
      }
    }
  }

  _saveReceivedFile(file) {
    const blob = new Blob(file.data);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.textContent = `💾 Download ${file.name}`;
    a.style.display = 'block';
    a.addEventListener('click', () => {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    this.app.showNotification(`File ${file.name} received. Click link to download.`, 'success');
    this.app.logEl.appendChild(a);
    this.app.logEl.scrollTop = this.app.logEl.scrollHeight;
  }
}
