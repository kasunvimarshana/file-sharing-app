# Building and Running

## Build and start all services
docker-compose up --build

## Or start in detached mode
docker-compose up -d --build

## View logs
docker-compose logs -f

## Stop services
docker-compose down

## Clean start
docker-compose down --volumes --remove-orphans
docker-compose up --build

## Check health
curl http://localhost:8080/health

# Alternative: Development Mode
## For development without Docker:

## Terminal 1: Start signaling server
cd signaling-server
npm install
npm start

## Terminal 2: Start TURN server (requires coturn installed)
## Or use a public TURN server for testing

## Terminal 3: Serve client files
cd client
## Option 1: Using Python
python3 -m http.server 3000

## Option 2: Using Node.js
npm install -g http-server
npx http-server -p 3000 -c-1

## Option 3: Using npm
npm install
npm run serve

# Troubleshooting
## Network Issues:

## Check if ports are available
netstat -tulpn | grep :8080
netstat -tulpn | grep :3478

## Reset Docker networking
docker-compose down
docker system prune -f
docker-compose up --build

## TURN Server Issues:
## Check TURN server logs
docker-compose logs coturn

## Test TURN server connectivity
docker exec -it coturn turnutils_uclient -t -T -u username -w password 127.0.0.1

# Production Deployment
## Monitoring:
## Monitor services
docker-compose logs -f

## Check health endpoints
curl http://localhost:8080/health
