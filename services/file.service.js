export class FileService {
    constructor(app) {
        this.app = app;
        this.chunkSize = 16000;

        this.incomingChunks = [];
    }

    sendFile(dataChannel, file) {
        if (!dataChannel || dataChannel.readyState !== 'open') {
            this.app.showNotification('Data channel is not open', 'error');
            return;
        }

        this.app.showNotification(`Sending ${file.name}...`, 'info');
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
        this.incomingChunks.push(data);
        if (this.incomingChunks.length > 10) {
            this.saveReceivedFile();
        } else {
            this.app.showNotification(`Received chunk (${data.byteLength} bytes)`, 'info');
        }
    }

    saveReceivedFile() {
        const blob = new Blob(this.incomingChunks);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "received_file";
        a.click();
        this.app.showNotification(`File received and saved.`, 'success');
        this.incomingChunks = [];
    }
}
