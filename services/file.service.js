export class FileService {
  constructor(app) {
    this.app = app;
    this.chunkSize = 16 * 1024;
    this.currentFiles = {};
  }

  /**
   * Send a selected file over an open data channel
   */
  sendFile(dataChannel, file) {
    if (!dataChannel || dataChannel.readyState !== 'open') {
      this.app.showNotification('❌ No open data channel available for sending files.', 'error');
      return;
    }

    this.app.showNotification(`📤 Sending "${file.name}" (${file.size} bytes)...`, 'info');

    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target.result;

      // 1️⃣ Send File Metadata
      dataChannel.send(
        JSON.stringify({
          meta: {
            name: file.name,
            size: file.size,
            type: file.type,
          },
        })
      );

      // 2️⃣ Send File in Chunks
      let offset = 0;

      const sendChunk = () => {
        if (offset < arrayBuffer.byteLength) {
          const chunk = arrayBuffer.slice(offset, offset + this.chunkSize);
          dataChannel.send(chunk);
          offset += this.chunkSize;

          // Small delay to prevent congestion
          setTimeout(sendChunk, 1);
        } else {
          this.app.showNotification(`✅ File "${file.name}" sent successfully.`, 'success');
        }
      };
      sendChunk();
    };
    reader.readAsArrayBuffer(file);
  }

  /**
   * Handle Incoming Data (Meta + Chunks), Build Final File
   */
  handleIncomingData(data) {
    // ✅ STEP 1: Check if it's meta information
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);
        if (msg.meta) {
          const { name, size, type } = msg.meta;

          this.currentFiles[name] = {
            name,
            size,
            type,
            data: [],
            receivedBytes: 0,
          };
          this.app.showNotification(`📥 Receiving "${name}" (${size} bytes)...`, 'info');
        }
      } catch {
        // Not JSON, ignore.
      }
      return;
    }

    // ✅ STEP 2: Handle Binary Chunks
    for (const name in this.currentFiles) {
      const entry = this.currentFiles[name];
      entry.data.push(data);
      entry.receivedBytes += data.byteLength;

      if (entry.receivedBytes >= entry.size) {
        this._assembleFile(entry);
        delete this.currentFiles[name];
      }
    }
  }

  /**
   * Assemble Final File and Provide a Download Link
   */
  _assembleFile(entry) {
    const blob = new Blob(entry.data, { type: entry.type });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = entry.name;
    link.textContent = `💾 Download "${entry.name}" (${entry.size} bytes)`;
    link.classList.add('download-link');

    this.app.showNotification(`✅ File "${entry.name}" received. Click to download.`, 'success');
    const logs = document.getElementById('logs');
    logs.appendChild(document.createElement('br'));
    logs.appendChild(link);
  }
}
