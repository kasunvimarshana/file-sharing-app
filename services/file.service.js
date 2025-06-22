export class FileService {
  constructor(app) {
    this.app = app;
    this.chunkSize = 16000;

    this.currentFile = null;
    this.currentFileData = [];
    this.currentFileReceived = 0;
  }

  sendFile(dataChannel, file) {
    if (!dataChannel || dataChannel.readyState !== 'open') {
      this.app.showNotification('Data channel is not open', 'error');
      return;
    }

    this.app.showNotification(`Sending ${file.name} (${file.size} bytes)...`, 'info');

    const metadata = {
      type: 'file-metadata',
      name: file.name,
      size: file.size,
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
          this._initializeIncomingFile(parsed.name, parsed.size);
        }
      } catch (error) {
        this.app.showNotification(`Invalid metadata received: ${error}`, 'error');
      }
    } else {
      this._handleFileChunk(data);
    }
  }

  _initializeIncomingFile(filename, size) {
    this.currentFile = {
      name: filename,
      size,
    };
    this.currentFileData = [];
    this.currentFileReceived = 0;

    this.app.showNotification(`Receiving ${filename} (${size} bytes)...`, 'info');
  }

  _handleFileChunk(data) {
    this.currentFileData.push(data);
    this.currentFileReceived += data.byteLength;

    this.app.showNotification(`Received chunk (${data.byteLength} bytes)...`, 'info');

    if (this.currentFileReceived >= this.currentFile.size) {
      this._saveReceivedFile();
    }
  }

  _saveReceivedFile() {
    const blob = new Blob(this.currentFileData);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.currentFile.name;
    a.click();

    this.app.showNotification(`File ${this.currentFile.name} received and saved.`, 'success');

    this.currentFile = null;
    this.currentFileData = [];
    this.currentFileReceived = 0;
  }
}
