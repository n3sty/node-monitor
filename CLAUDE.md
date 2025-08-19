# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a Node.js monitoring service designed to run on Raspberry Pi hardware to monitor system resources and Docker containers. The service provides both REST API endpoints and WebSocket connections for real-time monitoring data, designed to work with a Next.js frontend deployed on Vercel.

## Architecture Pattern

### Three-Tier Monitoring System
```
Vercel (Next.js webapp) → Internet → Raspberry Pi (Node.js service) → System/Docker APIs
```

The Pi service acts as a bridge between system resources and the web frontend, providing secure API access to system metrics, Docker container status, and real-time monitoring data.

## Key Technologies

- **Backend Framework**: Express.js with middleware stack
- **System Monitoring**: systeminformation library for Pi metrics
- **Docker Integration**: dockerode for container monitoring  
- **Real-time Data**: WebSocket with automatic reconnection
- **Process Management**: PM2 for production deployment
- **Security**: API key authentication, CORS, rate limiting

## Project Structure

```
src/
├── app.js                    # Main Express application with HTTPS support
├── routes/
│   ├── system.js            # System monitoring endpoints (/api/system/*)
│   ├── docker.js            # Docker container endpoints (/api/docker/*)
│   └── health.js            # Health check endpoints
├── services/
│   ├── system-monitor.js    # Pi system metrics collection
│   ├── docker-monitor.js    # Docker container monitoring
│   ├── cache-service.js     # Data caching layer (30s TTL)
│   └── websocket-service.js # Real-time metrics broadcasting
├── middleware/
│   ├── auth.js             # API key authentication
│   ├── cors.js             # CORS for Vercel domain
│   ├── rate-limit.js       # API rate limiting
│   └── error-handler.js    # Global error handling
└── utils/
    ├── logger.js           # Winston logging
    ├── config.js           # Environment configuration
    └── validators.js       # Request validation
```

## Common Commands

### Pi Deployment Commands
```bash
# Install and setup (from node-setup.md)
npm install
sudo npm install -g pm2

# Environment configuration
cp .env.example .env
# Edit .env with API_KEY, ALLOWED_ORIGINS, etc.

# Start service
pm2 start ecosystem.config.js
sudo systemctl start node-monitor

# Monitor service
pm2 status
pm2 logs node-monitor
journalctl -u node-monitor -f

# Updates
git pull origin main
npm ci --production
pm2 reload ecosystem.config.js
```

### Health and Debugging
```bash
# Check API health
curl http://localhost:3001/api/health

# Test specific endpoints
curl -H "Authorization: Bearer your-api-key" \
     http://localhost:3001/api/system/overview

# Monitor system resources
pm2 monit
htop
```

## API Architecture

### Core Endpoints
- **GET /api/system/overview** - Complete system overview (CPU, memory, disk)
- **GET /api/system/cpu** - Detailed CPU metrics with per-core usage
- **GET /api/system/memory** - Memory usage including swap and buffers
- **GET /api/system/disk** - Disk usage and I/O statistics
- **GET /api/system/network** - Network interface statistics
- **GET /api/docker/containers** - List all containers with status
- **GET /api/docker/containers/:id/stats** - Container resource usage
- **GET /api/docker/containers/:id/logs** - Container log output
- **GET /api/health** - Service health check

### WebSocket Real-time Data
- **Path**: `/ws/metrics`
- **Update Interval**: 5 seconds
- **Data**: Combined system and Docker metrics
- **Auto-reconnection**: Built-in with exponential backoff

## Frontend Integration Pattern

### Data Access Layer (Vercel/Next.js)
```typescript
// Expected structure in webapp:
lib/dal/monitor-client.ts     # HTTP client for Pi communication
app/actions/system-actions.ts # Server actions for data fetching
lib/types/system.ts          # TypeScript types for monitoring data
```

### Environment Variables (Vercel)
```
MONITOR_API_URL=https://your-pi-domain.com:3001
MONITOR_API_KEY=your-secure-api-key
MONITOR_WEBSOCKET_URL=wss://your-pi-domain.com:3001
```

## Security Implementation

### Authentication
- API key-based authentication via Authorization header
- CORS restricted to specific Vercel domains
- Rate limiting (100 requests per 15 minutes)

### Production Security
- HTTPS/WSS only in production
- Firewall rules limiting port 3001 access
- PM2 process isolation and memory limits
- Log rotation to prevent disk filling

## Deployment Considerations

### Pi Hardware Requirements
- Raspberry Pi 3B+ or newer
- 16GB+ SD card
- Stable internet connection
- Docker installed for container monitoring

### Service Management
- **PM2 Configuration**: ecosystem.config.js with memory limits
- **Systemd Service**: Auto-start on boot with node-monitor.service
- **Log Management**: Centralized logging in /var/log/node-monitor/
- **Health Monitoring**: Built-in health checks and automatic restarts

### Network Configuration
- Port forwarding for external access (port 3001)
- Dynamic DNS for consistent domain access
- SSL/TLS certificates (Let's Encrypt or self-signed)

## Development Workflow

### Local Development on Pi
1. SSH into Pi and navigate to /opt/node-monitor
2. Make code changes
3. Test with `node src/app.js` or `pm2 start ecosystem.config.js`
4. Check logs with `pm2 logs` or `journalctl -u node-monitor -f`

### Remote Updates
1. Push changes to Git repository
2. SSH to Pi and run `git pull origin main`
3. Update dependencies: `npm ci --production`
4. Reload service: `pm2 reload ecosystem.config.js`

## Monitoring Data Types

### System Metrics
- CPU usage (overall and per-core)
- Memory usage (total, used, free, swap)
- Disk usage and I/O operations
- Network interface statistics
- System uptime and load averages
- CPU temperature (Pi-specific)

### Docker Metrics
- Container list with status and ports
- Per-container resource usage (CPU, memory)
- Container network and disk I/O
- Container logs with filtering options

This architecture provides a production-ready monitoring solution that bridges Raspberry Pi system resources with modern web frontend technologies.