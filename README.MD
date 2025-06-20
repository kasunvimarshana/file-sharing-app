# P2P Torrent-like Distributed System

A modern, browser-based peer-to-peer file sharing system built with WebRTC, featuring custom STUN/TURN servers, real-time signaling, and a beautiful user interface.

## 🚀 Features

### Core Functionality
- **Pure WebRTC Implementation**: Custom peer-to-peer connections without third-party dependencies
- **Custom STUN/TURN Servers**: Self-implemented NAT traversal and relay servers
- **Real-time Signaling**: WebSocket-based peer discovery and coordination
- **File Chunking**: Efficient large file transfer with integrity verification
- **SHA-256 Security**: Cryptographic hash verification for all transfers
- **Automatic Seeding**: Files automatically become available for sharing after download

### User Interface
- **Modern Design**: Dark theme with glassmorphism effects and neon accents
- **Real-time Dashboard**: Live network statistics and peer monitoring
- **Network Visualization**: Interactive graph showing peer connections
- **Progress Tracking**: Real-time download/upload progress with speed monitoring
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices

### Network Features
- **Peer Discovery**: Automatic peer finding and connection establishment
- **Connection Management**: Robust handling of peer connections and failures
- **Load Balancing**: Intelligent chunk distribution across available peers
- **Network Health**: Connection quality monitoring and optimization

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, WebSocket
- **P2P Protocol**: WebRTC Data Channels
- **Signaling**: Custom WebSocket server
- **NAT Traversal**: Custom STUN/TURN implementation
- **Containerization**: Docker with multi-stage builds

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+ 
- Docker (optional, for containerized deployment)

### Local Development
```bash
# Clone the repository
git clone <repository-url>
cd p2p-torrent-system

# Install dependencies
npm install

# Start development server (includes signaling server)
npm run dev
```

The application will be available at:
- **Web Interface**: http://localhost:5173
- **Signaling Server**: ws://localhost:8080/signaling
- **STUN Server**: UDP port 3478
- **TURN Server**: UDP port 3479

### Production Deployment

#### Using Docker
```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build and run manually
docker build -t p2p-torrent .
docker run -p 3000:8080 -p 3478:3478/udp -p 3479:3479/udp p2p-torrent
```

#### Manual Deployment
```bash
# Build the application
npm run build

# Start production server
npm run server
```

## 🔧 Configuration

### Environment Variables
```bash
NODE_ENV=production          # Environment mode
PORT=8080                    # Server port
STUN_PORT=3478              # STUN server port
TURN_PORT=3479              # TURN server port
```

### Docker Configuration
The system includes comprehensive Docker support with:
- Multi-stage builds for optimized image size
- Health checks for container monitoring
- Non-root user for security
- Proper signal handling with dumb-init

## 🌐 API Endpoints

### Health Check
```
GET /api/health
```
Returns system status, peer count, and room statistics.

### ICE Servers Configuration
```
GET /api/ice-servers
```
Returns STUN/TURN server configuration for WebRTC connections.

## 🔒 Security Features

- **File Integrity**: SHA-256 hash verification for all transfers
- **Secure Connections**: All peer connections use encrypted WebRTC channels
- **NAT Traversal**: Custom STUN/TURN implementation for firewall bypass
- **Input Validation**: Comprehensive validation of all network messages
- **Container Security**: Non-root Docker containers with minimal attack surface

## 📡 Network Protocol

### File Transfer Protocol
1. **File Announcement**: Peers announce available files with metadata
2. **Peer Discovery**: Requesting peers discover file seeders
3. **Connection Establishment**: WebRTC connections established via signaling
4. **Chunk Negotiation**: File divided into 64KB chunks for efficient transfer
5. **Parallel Download**: Multiple chunks downloaded simultaneously from different peers
6. **Integrity Verification**: SHA-256 hash verification upon completion
7. **Automatic Seeding**: Completed files automatically shared with network

### Signaling Messages
- `join-room`: Join a peer discovery room
- `offer`/`answer`: WebRTC connection negotiation
- `ice-candidate`: NAT traversal candidate exchange
- `announce-file`: Broadcast file availability
- `request-file`: Request file from network

## 🎯 Usage Guide

### Sharing Files
1. **Upload**: Drag and drop files or use the upload button
2. **Automatic Hashing**: System calculates SHA-256 hash
3. **Network Announcement**: File availability broadcast to peers
4. **Seeding**: File immediately available for download by others

### Downloading Files
1. **Discovery**: Browse available files from connected peers
2. **Download**: Click download button to start transfer
3. **Progress Monitoring**: Real-time progress tracking
4. **Verification**: Automatic integrity verification
5. **Auto-seeding**: Downloaded file becomes available for sharing

### Network Monitoring
- **Dashboard**: Overview of network activity and statistics
- **Peer Network**: Visual representation of peer connections
- **File Manager**: Comprehensive file and transfer management
- **Torrent List**: Detailed view of all active and completed transfers

## 🚧 Performance Optimization

- **Chunk-based Transfer**: 64KB chunks for optimal throughput
- **Parallel Connections**: Multiple simultaneous peer connections
- **Adaptive Retry**: Intelligent retry mechanism for failed transfers
- **Connection Pooling**: Efficient WebRTC connection management
- **Memory Management**: Streaming file processing to minimize RAM usage

## 🔍 Troubleshooting

### Common Issues
- **Connection Failures**: Check firewall settings and NAT configuration
- **Slow Transfers**: Verify network connectivity and peer availability
- **File Corruption**: Ensure stable connections during large file transfers

### Debug Mode
Enable debug logging by setting `NODE_ENV=development` for detailed network logs.

## 📈 Monitoring & Analytics

The system provides comprehensive metrics:
- **Network Statistics**: Upload/download speeds, peer counts
- **Connection Quality**: Latency, stability, throughput metrics
- **Transfer Analytics**: Success rates, completion times
- **System Health**: Memory usage, connection status

## 🛡️ Production Considerations

- **Load Balancing**: Consider multiple signaling servers for high load
- **SSL/TLS**: Use HTTPS in production for WebSocket security
- **Monitoring**: Implement external monitoring for system health
- **Backup**: Regular backup of configuration and logs
- **Scaling**: Horizontal scaling support for increased capacity

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please read the contributing guidelines and submit pull requests for any improvements.

## 📞 Support

For issues and questions, please use the GitHub issue tracker or contact the development team.