export class FileService {
  constructor(app) {
    this.app = app;
    this.chunkSize = 16 * 1024;
    this.currentFiles = {};
  }

  sendFile(dataChannel, file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target.result;
      dataChannel.send(JSON.stringify({ meta: { name: file.name, size: file.size, type: file.type } }));

      let offset = 0;

      const sendChunk = () => {
        if (offset < arrayBuffer.byteLength) {
          const chunk = arrayBuffer.slice(offset, offset + this.chunkSize);
          dataChannel.send(chunk);
          offset += this.chunkSize;
          setTimeout(sendChunk, 1);
        } else {
          this.app.showNotification(`✅ File "${file.name}" sent successfully.`, 'success');
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
          this.currentFiles[name] = { name, size, type, data: [] };
          this.app.showNotification(`📥 Receiving "${name}" (${size} bytes)...`, 'info');
        }
      } catch {
        // Not JSON
      }
    } else {
      for (const name in this.currentFiles) {
        const entry = this.currentFiles[name];
        entry.data.push(data);
        const receivedBytes = entry.data.reduce((acc, chunk) => acc + chunk.byteLength, 0);

        if (receivedBytes >= entry.size) {
          const blob = new Blob(entry.data, { type: entry.type });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = entry.name;
          link.textContent = `💾 Download ${entry.name}`;
          this.app.showNotification(`✅ File "${entry.name}" received. Click to download.`, 'success');
          this.app.showNotification('');
          document.getElementById('logs').appendChild(link);
          delete this.currentFiles[name];
        }
      }
    }
  }
}
