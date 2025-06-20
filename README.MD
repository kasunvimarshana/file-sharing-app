# P2P Torrent System

A complete, production-ready peer-to-peer torrent system built with React, Node.js, and WebRTC. This implementation includes a full BitTorrent protocol implementation, built-in tracker, WebRTC-based peer connections, and Docker deployment support.

## Features

### Core BitTorrent Protocol
- Complete torrent file parsing and creation
- SHA-1 piece validation and verification
- Efficient piece and block management
- Support for single and multi-file torrents

### Peer-to-Peer Networking
- WebRTC-based peer connections
- Built-in signaling server
- Automatic peer discovery and connection management
- DHT-like peer discovery system
- Connection pooling and management

### Tracker System
- Built-in HTTP tracker implementation
- Swarm management and peer tracking
- Statistics and health monitoring
- Rate limiting and security features

### Security & Production Features
- Input validation and sanitization
- Rate limiting on API endpoints
- Secure file upload handling
- Docker containerization
- Health checks and monitoring
- Graceful shutdown handling
- Error handling and logging

### User Interface
- Modern, responsive React interface
- Real-time download/upload statistics
- Drag-and-drop torrent management
- Live peer connection visualization
- Dark theme with glass morphism effects

## Quick Start

### Prerequisites
- Node.js 18+ and npm 8+
- Docker and Docker Compose (for containerized deployment)

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd p2p-torrent-system

# Install dependencies
npm install

# Start development servers
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- WebSocket: ws://localhost:3000/ws

### Docker Deployment

```bash
# Build and run with Docker Compose
npm run docker:compose:build

# Or use individual Docker commands
npm run docker:build
npm run docker:run
```

### Production Deployment

```bash
# Build the application
npm run build
npm run build:server

# Start in production mode
npm run start:prod
```

## API Endpoints

### Tracker API
- `GET /api/announce` - BitTorrent tracker announce
- `GET /api/dht/nodes` - DHT bootstrap nodes

### Torrent Management
- `POST /api/torrents` - Upload torrent file
- `GET /api/torrents` - List all torrents
- `DELETE /api/torrents/:infoHash` - Remove torrent

### System Monitoring
- `GET /api/health` - System health check
- `GET /api/stats` - Detailed system statistics

## Architecture

### Frontend (React)
- **Components**: Modular React components for UI
- **Services**: TorrentEngine for protocol implementation
- **Utils**: Crypto, parsing, and utility functions

### Backend (Node.js)
- **HTTP Server**: Express.js with security middleware
- **WebSocket Server**: Real-time peer signaling
- **Tracker**: BitTorrent protocol tracker implementation
- **Storage**: In-memory with persistent backup

### Networking
- **WebRTC**: Peer-to-peer data channels
- **WebSocket**: Signaling and coordination
- **HTTP**: Tracker announces and API

## Configuration

### Environment Variables
```env
NODE_ENV=production
PORT=3000
```

### Docker Configuration
The application includes comprehensive Docker configuration:
- Multi-stage builds for optimization
- Health checks and monitoring
- Volume management for persistent data
- Nginx reverse proxy configuration

## Security Features

### Input Validation
- Torrent file format validation
- File size and type restrictions
- URL and parameter sanitization

### Rate Limiting
- API endpoint protection
- Connection attempt limiting
- Resource usage monitoring

### Network Security
- CORS configuration
- Secure WebSocket connections
- Connection timeout management

## Development

### File Structure
```
src/
├── components/          # React components
├── services/           # Core services (TorrentEngine, etc.)
├── utils/              # Utilities (crypto, parsing)
├── types/              # TypeScript definitions
server/
├── index.ts            # Main server file
├── healthcheck.js      # Health check script
```

### Building
```bash
# Frontend build
npm run build

# Server build
npm run build:server
```

### Testing
The system includes comprehensive error handling and logging for debugging.

## Performance Optimization

- Efficient piece management and validation
- Connection pooling and reuse
- Memory-efficient data structures
- Optimized Docker builds
- Rate limiting and resource management

## Monitoring

### Health Checks
- Application health endpoint
- Docker health checks
- Connection monitoring

### Statistics
- Real-time peer statistics
- Torrent swarm information
- System resource usage
- Network connection stats

## Deployment Options

### Docker Compose (Recommended)
Complete deployment with Nginx reverse proxy and persistent storage.

### Standalone Docker
Single container deployment with built-in web server.

### Traditional Deployment
Direct Node.js deployment with process management.

## License

This project is licensed under the MIT License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues, questions, or contributions, please use the GitHub issue tracker.