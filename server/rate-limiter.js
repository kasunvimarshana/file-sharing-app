export class RateLimiter {
  constructor(windowMs = 15 * 60 * 1000, maxRequests = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.clients = new Map();
    
    // Clean up old entries every minute
    setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  isAllowed(clientId) {
    const now = Date.now();
    const client = this.clients.get(clientId);
    
    if (!client) {
      this.clients.set(clientId, {
        requests: 1,
        windowStart: now
      });
      return true;
    }
    
    // Reset window if expired
    if (now - client.windowStart > this.windowMs) {
      client.requests = 1;
      client.windowStart = now;
      return true;
    }
    
    // Check if within limit
    if (client.requests < this.maxRequests) {
      client.requests++;
      return true;
    }
    
    return false;
  }
  
  cleanup() {
    const now = Date.now();
    for (const [clientId, client] of this.clients.entries()) {
      if (now - client.windowStart > this.windowMs) {
        this.clients.delete(clientId);
      }
    }
  }
  
  getRemainingRequests(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return this.maxRequests;
    
    const now = Date.now();
    if (now - client.windowStart > this.windowMs) {
      return this.maxRequests;
    }
    
    return Math.max(0, this.maxRequests - client.requests);
  }
}