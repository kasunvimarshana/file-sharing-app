export class FileService {
  constructor(app) {
    this.app = app;
    this.chunkSize = 16 * 1024;
    this.currentFiles = {};
  }

  sendFile(dataChannel, file) {
    if (!dataChannel || dataChannel.readyState !== 'open') {
      this.app.showNotification('No open data channel available to send files.', 'error');
      return;
    }

    this.app.showNotification(`Sending "${file.name}" (${this._formatBytes(file.size)})...`, 'info');

    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target.result;

      // Send metadata first
      dataChannel.send(JSON.stringify({ meta: { name: file.name, size: file.size, type: file.type } }));

      let offset = 0;
      const sendChunk = () => {
        if (offset < arrayBuffer.byteLength) {
          const chunk = arrayBuffer.slice(offset, offset + this.chunkSize);
          dataChannel.send(chunk);
          offset += this.chunkSize;
          setTimeout(sendChunk, 1);
        } else {
          this.app.showNotification(`File "${file.name}" sent successfully.`, 'success');
        }
      };
      sendChunk();
    };
    reader.readAsArrayBuffer(file);
  }

  handleIncomingData(data) {
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);
        if (msg.meta) {
          const { name, size, type } = msg.meta;
          this.currentFiles[name] = { name, size, type, data: [], receivedBytes: 0 };
          this.app.showNotification(`Receiving "${name}" (${this._formatBytes(size)})...`, 'info');
        }
      } catch {
        // Ignore invalid JSON
      }
      return;
    }

    for (const name in this.currentFiles) {
      const fileEntry = this.currentFiles[name];
      fileEntry.data.push(data);
      fileEntry.receivedBytes += data.byteLength;

      if (fileEntry.receivedBytes >= fileEntry.size) {
        this._assembleFile(fileEntry);
        delete this.currentFiles[name];
      }
    }
  }

  _assembleFile(fileEntry) {
    const blob = new Blob(fileEntry.data, { type: fileEntry.type });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileEntry.name;
    link.textContent = `Download "${fileEntry.name}" (${this._formatBytes(fileEntry.size)})`;
    link.classList.add('download-link');

    const logs = document.getElementById('logs');
    logs.appendChild(document.createElement('br'));
    logs.appendChild(link);

    this.app.showNotification(`File "${fileEntry.name}" received. Click to download.`, 'success');
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
