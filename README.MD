# P2P Torrent System

A modern, secure, browser-based peer-to-peer file sharing system built with WebRTC, React, and Node.js. This system provides decentralized file sharing capabilities with built-in security features and custom STUN/TURN servers.

## Features

### Core Functionality
- **P2P File Sharing**: Direct peer-to-peer file transfers using WebRTC data channels
- **Real-time Signaling**: WebSocket-based signaling server for peer discovery
- **File Chunking**: Efficient file splitting and reassembly for large files
- **Progress Tracking**: Real-time upload/download progress monitoring
- **File Integrity**: SHA-256 hash verification for all transfers

### Security Features
- **Encrypted Connections**: All peer communications are encrypted via WebRTC
- **File Verification**: Cryptographic hash validation
- **Secure Signaling**: Protected WebSocket connections
- **Input Validation**: Comprehensive data sanitization

### Network Infrastructure
- **Custom STUN Server**: Built-in STUN server for NAT traversal
- **Custom TURN Server**: Relay server for firewall traversal
- **WebRTC ICE**: Intelligent connectivity establishment
- **Connection Management**: Automatic peer connection handling

## Architecture

### Frontend (React + TypeScript)
- **Modern UI**: Clean, responsive design with Tailwind CSS
- **Real-time Updates**: Live peer connection visualization
- **Drag & Drop**: Intuitive file upload interface
- **Mobile Optimized**: Responsive design for all devices

### Backend (Node.js)
- **Signaling Server**: WebSocket-based peer coordination
- **STUN/TURN Servers**: Custom implementation for NAT traversal
- **Security Middleware**: Helmet.js for security headers
- **Health Monitoring**: Built-in health check endpoints

## Getting Started

### Prerequisites
- Node.js 18+ 
- Docker (optional, for containerized deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd p2p-torrent-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development servers**
   ```bash
   npm run dev
   ```

   This starts both the frontend (Vite) and backend servers concurrently.

4. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8080
   - Health Check: http://localhost:8080/health

### Production Deployment

#### Docker Deployment
```bash
# Build and run with Docker
npm run docker:build
npm run docker:run

# Or use Docker Compose
docker-compose up -d
```

#### Manual Deployment
```bash
# Build the application
npm run build

# Start production server
npm start
```

## Usage

### Sharing Files
1. **Upload Files**: Drag and drop files into the upload area
2. **Share**: Click "Share Files" to make them available to peers
3. **Monitor**: Watch real-time peer connections and transfer status

### Downloading Files
1. **Browse**: View available files from connected peers
2. **Download**: Click download button on desired files
3. **Track Progress**: Monitor download progress in real-time

### Network Visualization
- **Peer Graph**: Visual representation of peer connections
- **Connection Status**: Real-time connection health monitoring
- **Transfer Statistics**: Upload/download speeds and progress

## Configuration

### Environment Variables
```env
NODE_ENV=production
PORT=8080
STUN_PORT=3478
TURN_PORT=3479
```

### Network Ports
- **8080**: Main application server
- **3478**: STUN server (UDP)
- **3479**: TURN server (UDP)

## Security Considerations

### Data Protection
- All file transfers are encrypted using WebRTC's built-in encryption
- File integrity is verified using SHA-256 hashes
- No files are stored on central servers

### Network Security
- STUN/TURN servers use authentication
- WebSocket connections are validated
- Security headers are enforced

### Privacy
- Peer-to-peer architecture ensures no central data storage
- Files are transferred directly between users
- Minimal metadata is collected

## API Endpoints

### Health Check
```
GET /health
Response: { status: 'healthy', peers: number, uptime: number }
```

### WebSocket Signaling
```
ws://localhost:8080
Messages: join, offer, answer, ice-candidate
```

## Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Style
- ESLint configuration provided
- TypeScript strict mode enabled
- Prettier formatting recommended

## Troubleshooting

### Common Issues

**Connection Problems**
- Check firewall settings for ports 8080, 3478, 3479
- Verify STUN/TURN server accessibility
- Ensure WebSocket connections are allowed

**File Transfer Issues**
- Verify file size limits (default: no limit, but browser memory constraints apply)
- Check network connectivity between peers
- Ensure compatible browsers (WebRTC support required)

**Performance Issues**
- Monitor memory usage for large files
- Check network bandwidth
- Consider adjusting chunk sizes for different network conditions

### Browser Compatibility
- Chrome 56+
- Firefox 51+
- Safari 11+
- Edge 79+

## License

MIT License - see LICENSE file for details

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Node.js, Express, WebSocket
- **P2P**: WebRTC, Custom STUN/TURN
- **Security**: Helmet.js, CORS, Input validation
- **Deployment**: Docker, Docker Compose, Nginx