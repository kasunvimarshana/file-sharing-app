# P2P Distributed File Sharing System

A production-ready, BitTorrent-inspired peer-to-peer file sharing system built with modern web technologies. This system implements custom signaling, STUN/TURN servers, and torrent-like protocols for secure, decentralized file distribution.

## 🚀 Features

### Core Functionality
- **Real P2P Connections**: Direct browser-to-browser file sharing using WebRTC
- **Custom Signaling Server**: WebSocket-based peer discovery and connection establishment
- **In-House STUN/TURN Services**: Complete NAT traversal solution without external dependencies
- **BitTorrent-Like Protocol**: Chunked file transfer with hash verification and piece exchange
- **Secure Communication**: TLS encryption and peer verification throughout the system

### Advanced Features
- **Distributed Hash Table (DHT)**: Decentralized peer and file discovery
- **Piece-Based Downloads**: Efficient parallel downloading from multiple peers
- **Hash Verification**: SHA-256 integrity checking for all file pieces
- **Connection Recovery**: Automatic reconnection and error handling
- **Rate Limiting**: Built-in protection against abuse and DoS attacks

### Production Ready
- **Docker Containerization**: Complete deployment solution with docker-compose
- **Load Balancing**: Nginx reverse proxy with upstream server configuration
- **Monitoring**: Prometheus metrics and Grafana dashboards
- **Health Checks**: Comprehensive system health monitoring
- **Security**: CORS, rate limiting, and secure headers implementation

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │   Web Client    │    │   Web Client    │
│   (Browser)     │    │   (Browser)     │    │   (Browser)     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │    Signaling Server       │
                    │    (WebSocket)            │
                    └─────────────┬─────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
┌─────────┴───────┐    ┌─────────┴───────┐    ┌─────────┴───────┐
│   STUN Server   │    │   TURN Server   │    │ Torrent Tracker │
│   (UDP 3478)    │    │   (UDP 3479)    │    │   (HTTP 8000)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Component Overview

1. **Signaling Server** (`backend/signaling-server.js`)
   - WebSocket-based peer discovery
   - Connection establishment coordination
   - Room management for file sharing
   - Authentication and session management

2. **STUN Server** (`backend/stun-server.js`)
   - RFC 5389 compliant STUN implementation
   - NAT type discovery and public IP resolution
   - UDP hole punching coordination

3. **TURN Server** (`backend/turn-server.js`)
   - RFC 5766 compliant TURN implementation
   - Media relay for restrictive NATs
   - Allocation and permission management

4. **Torrent Tracker** (`backend/torrent-tracker.js`)
   - BitTorrent-compatible tracker protocol
   - Peer list management and statistics
   - File announce and scrape operations

5. **Web Frontend** (`src/`)
   - Modern React-based user interface
   - WebRTC peer connection management
   - File chunking and piece verification
   - Real-time progress tracking

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ 
- Docker & Docker Compose
- Modern web browser with WebRTC support

### Quick Start with Docker

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd p2p-distributed-system
   ```

2. **Build and start all services**
   ```bash
   docker-compose up --build
   ```

3. **Access the application**
   - Web Interface: http://localhost
   - Signaling Server: ws://localhost:8080
   - Torrent Tracker: http://localhost:8000
   - Monitoring: http://localhost:3000 (Grafana)

### Manual Development Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start individual services**
   ```bash
   # Terminal 1 - Signaling Server
   npm run start:signaling

   # Terminal 2 - STUN Server  
   npm run start:stun

   # Terminal 3 - TURN Server
   npm run start:turn

   # Terminal 4 - Torrent Tracker
   npm run start:tracker

   # Terminal 5 - Frontend Development
   npm run dev
   ```

## 📖 Usage Guide

### Adding Files
1. Click "Add Files" button in the web interface
2. Select files from your local system
3. Files are automatically chunked and hashed
4. File information is announced to connected peers

### Downloading Files
1. Browse available files from connected peers
2. Click download to start piece-based transfer
3. Monitor progress in the Downloads tab
4. Completed files are automatically verified and saved

### Network Management
1. View connected peers in the Network tab
2. Monitor connection status and statistics
3. Check system logs for debugging information

## 🔧 Configuration

### Environment Variables

```bash
# Signaling Server
PORT=8080
NODE_ENV=production

# STUN Server
STUN_PORT=3478

# TURN Server  
TURN_PORT=3479

# Torrent Tracker
TRACKER_PORT=8000
```

### Docker Compose Override

Create `docker-compose.override.yml` for custom configurations:

```yaml
version: '3.8'
services:
  signaling-server:
    environment:
      - DEBUG=true
      - MAX_PEERS=1000
    ports:
      - "8080:8080"
```

## 🔒 Security Features

### Network Security
- **TLS Encryption**: All WebRTC connections use DTLS
- **Peer Verification**: Challenge-response authentication
- **Rate Limiting**: Protection against DoS attacks
- **CORS Protection**: Configurable cross-origin policies

### Data Integrity
- **SHA-256 Hashing**: All file pieces are cryptographically verified
- **Merkle Trees**: Efficient integrity verification for large files
- **Piece Validation**: Automatic retry for corrupted pieces

### Access Control
- **Room-Based Sharing**: Files shared within specific rooms
- **Peer Permissions**: Granular control over peer interactions
- **Session Management**: Secure peer session handling

## 📊 Monitoring & Metrics

### Built-in Health Checks
- `/health` - Service health status
- `/stats` - Real-time statistics
- Connection state monitoring
- Automatic service recovery

### Prometheus Metrics
- Peer connection counts
- File transfer statistics  
- Error rates and latencies
- Resource utilization

### Grafana Dashboards
- Real-time system overview
- Network topology visualization
- Performance analytics
- Alert management

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Load Testing
```bash
npm run test:load
```

## 🚀 Deployment

### Production Deployment

1. **Configure SSL certificates** in `nginx.conf`
2. **Set production environment variables**
3. **Deploy with Docker Compose**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

### Scaling Considerations
- **Horizontal Scaling**: Multiple signaling server instances
- **Load Balancing**: Nginx upstream configuration
- **Database**: Redis for session persistence
- **CDN**: Static asset distribution

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow SOLID principles and clean code practices
- Maintain comprehensive test coverage
- Document all public APIs
- Use TypeScript for type safety
- Follow semantic versioning

## 📝 API Documentation

### Signaling Protocol
```javascript
// Authentication
{
  "type": "authenticate",
  "challenge": "random-string",
  "response": "hashed-response"
}

// File Announcement
{
  "type": "file-announce", 
  "fileName": "example.pdf",
  "fileSize": 1048576,
  "fileHash": "sha256-hash",
  "pieceHashes": ["piece1-hash", "piece2-hash"]
}
```

### WebRTC Data Channel Protocol
```javascript
// Piece Request
{
  "type": "piece-request",
  "fileHash": "file-hash",
  "pieceIndex": 0,
  "blockOffset": 0,
  "blockSize": 16384
}

// Piece Response
{
  "type": "piece-response",
  "fileHash": "file-hash", 
  "pieceIndex": 0,
  "blockOffset": 0,
  "blockData": ArrayBuffer
}
```

## 🐛 Troubleshooting

### Common Issues

**Connection Failed**
- Check firewall settings
- Verify STUN/TURN server accessibility
- Ensure WebRTC support in browser

**File Transfer Slow**
- Check network bandwidth
- Verify peer connectivity
- Monitor piece availability

**Authentication Errors**
- Verify signaling server connection
- Check authentication credentials
- Review server logs

### Debug Mode
Enable debug logging:
```bash
DEBUG=p2p:* npm run dev
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- WebRTC specification and implementations
- BitTorrent protocol design principles  
- Open source P2P networking libraries
- Modern web development community

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation wiki
- Join our community discussions

---

**Built with ❤️ for the decentralized web**