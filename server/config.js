export const config = {
  // Server configuration
  port: process.env.PORT || 8080,
  stunPort: process.env.STUN_PORT || 3478,
  turnPort: process.env.TURN_PORT || 3479,
  
  // Security configuration
  maxConnections: parseInt(process.env.MAX_CONNECTIONS) || 1000,
  maxRoomsPerPeer: parseInt(process.env.MAX_ROOMS_PER_PEER) || 10,
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 1024 * 1024 * 1024, // 1GB
  maxMessageSize: parseInt(process.env.MAX_MESSAGE_SIZE) || 1024 * 1024, // 1MB
  
  // Rate limiting
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  
  // Connection timeouts
  connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT) || 30000,
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL) || 30000,
  
  // TURN server credentials
  turnUsername: process.env.TURN_USERNAME || 'user',
  turnPassword: process.env.TURN_PASSWORD || 'pass',
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',
  
  // SSL/TLS (for production)
  sslKey: process.env.SSL_KEY_PATH,
  sslCert: process.env.SSL_CERT_PATH,
};