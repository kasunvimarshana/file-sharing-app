FROM node:18-alpine

# Install wget for health checks
RUN apk add --no-cache wget

WORKDIR /app

# Copy package files
COPY package*.json ./

# Generate package-lock.json and install dependencies
RUN npm install --production && npm cache clean --force

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 8080

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["npm", "start"]