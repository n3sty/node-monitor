# Node Monitor Setup Guide

## Overview
This guide covers the complete setup of the node-monitor service on a Raspberry Pi, including installation, configuration, and deployment.

## Prerequisites

### Hardware Requirements
- Raspberry Pi 3B+ or newer
- MicroSD card (16GB+ recommended)
- Stable internet connection
- Optional: External storage for logs

### Software Requirements
- Raspberry Pi OS (64-bit recommended)
- Node.js 18+ 
- npm or yarn
- Docker (for container monitoring)
- PM2 (for process management)

## Initial System Setup

### 1. Raspberry Pi OS Configuration
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y git curl wget vim htop

# Enable SSH (if not already enabled)
sudo systemctl enable ssh
sudo systemctl start ssh

# Configure timezone
sudo timedatectl set-timezone America/New_York
```

### 2. Node.js Installation
```bash
# Install Node.js via NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version

# Install global utilities
sudo npm install -g pm2 yarn
```

### 3. Docker Installation
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add pi user to docker group
sudo usermod -aG docker pi

# Enable Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Verify installation
docker --version
```

## Project Setup

### 1. Clone Repository
```bash
# Clone the node-monitor repository
cd /opt
sudo git clone https://github.com/yourusername/node-monitor.git
sudo chown -R pi:pi node-monitor
cd node-monitor
```

### 2. Install Dependencies
```bash
# Install Node.js dependencies
npm install

# Or using yarn
yarn install
```

### 3. Project Structure
```
node-monitor/
├── src/
│   ├── routes/
│   │   ├── system.js        # System monitoring endpoints
│   │   ├── docker.js        # Docker monitoring endpoints
│   │   └── websocket.js     # WebSocket handlers
│   ├── services/
│   │   ├── system-monitor.js # System metrics collection
│   │   ├── docker-monitor.js # Docker metrics collection
│   │   └── cache.js         # Caching service
│   ├── middleware/
│   │   ├── auth.js          # API authentication
│   │   ├── cors.js          # CORS configuration
│   │   └── rate-limit.js    # Rate limiting
│   ├── utils/
│   │   ├── logger.js        # Logging utility
│   │   └── config.js        # Configuration management
│   └── app.js               # Main application file
├── config/
│   ├── production.json      # Production configuration
│   ├── development.json     # Development configuration
│   └── default.json         # Default configuration
├── logs/                    # Log files directory
├── scripts/
│   ├── install.sh          # Installation script
│   ├── start.sh            # Startup script
│   └── update.sh           # Update script
├── ecosystem.config.js      # PM2 configuration
├── package.json
└── README.md
```

## Configuration

### 1. Environment Configuration
```bash
# Create environment file
cp .env.example .env
nano .env
```

```env
# .env
NODE_ENV=production
PORT=3001
API_KEY=your-secure-api-key-here

# Monitoring Configuration
METRICS_INTERVAL=5000
CACHE_TTL=30000
LOG_LEVEL=info

# WebSocket Configuration
WS_PORT=3001
WS_PATH=/ws/metrics

# Security
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# SSL Configuration (if using HTTPS)
SSL_KEY_PATH=/etc/ssl/private/monitor.key
SSL_CERT_PATH=/etc/ssl/certs/monitor.crt
```

### 2. PM2 Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'node-monitor',
    script: 'src/app.js',
    cwd: '/opt/node-monitor',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/node-monitor/error.log',
    out_file: '/var/log/node-monitor/out.log',
    log_file: '/var/log/node-monitor/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}
```

### 3. System Service Configuration
```bash
# Create systemd service file
sudo nano /etc/systemd/system/node-monitor.service
```

```ini
[Unit]
Description=Node Monitor Service
After=network.target docker.service

[Service]
Type=forking
User=pi
WorkingDirectory=/opt/node-monitor
Environment=NODE_ENV=production
ExecStart=/usr/bin/pm2 start ecosystem.config.js --no-daemon
ExecReload=/usr/bin/pm2 reload ecosystem.config.js
ExecStop=/usr/bin/pm2 delete ecosystem.config.js
Restart=always

[Install]
WantedBy=multi-user.target
```

## Network Configuration

### 1. Firewall Setup
```bash
# Install UFW if not present
sudo apt install -y ufw

# Configure firewall rules
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 3001/tcp  # Monitor API port

# Enable firewall
sudo ufw enable
```

### 2. Port Forwarding (Router Configuration)
Configure your router to forward external traffic to your Pi:
- External Port: 3001
- Internal IP: [Pi's local IP]
- Internal Port: 3001
- Protocol: TCP

### 3. Dynamic DNS (Optional)
```bash
# Install ddclient for dynamic DNS
sudo apt install -y ddclient

# Configure ddclient
sudo nano /etc/ddclient.conf
```

## SSL/TLS Setup

### 1. Let's Encrypt Certificate
```bash
# Install Certbot
sudo apt install -y certbot

# Obtain certificate (replace with your domain)
sudo certbot certonly --standalone -d your-pi-domain.com

# Setup auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 2. Self-Signed Certificate (Development)
```bash
# Generate self-signed certificate
sudo mkdir -p /etc/ssl/private
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/monitor.key \
  -out /etc/ssl/certs/monitor.crt

# Set proper permissions
sudo chmod 600 /etc/ssl/private/monitor.key
sudo chmod 644 /etc/ssl/certs/monitor.crt
```

## Installation Script

### 1. Automated Installation
```bash
#!/bin/bash
# scripts/install.sh

set -e

echo "Starting Node Monitor installation..."

# Create directories
sudo mkdir -p /var/log/node-monitor
sudo chown pi:pi /var/log/node-monitor

# Install dependencies
npm ci --production

# Copy configuration files
if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration"
fi

# Setup PM2
pm2 install pm2-logrotate

# Create systemd service
sudo cp scripts/node-monitor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable node-monitor

echo "✅ Installation complete!"
echo "1. Edit .env file with your configuration"
echo "2. Run 'sudo systemctl start node-monitor' to start the service"
```

## Deployment & Management

### 1. Start Service
```bash
# Start with PM2
pm2 start ecosystem.config.js

# Or start with systemd
sudo systemctl start node-monitor

# Check status
pm2 status
sudo systemctl status node-monitor
```

### 2. Monitoring & Logs
```bash
# View PM2 logs
pm2 logs node-monitor

# View system logs
journalctl -u node-monitor -f

# Monitor system resources
pm2 monit
```

### 3. Updates & Maintenance
```bash
#!/bin/bash
# scripts/update.sh

echo "Updating Node Monitor..."

# Pull latest changes
git pull origin main

# Install new dependencies
npm ci --production

# Restart service
pm2 reload ecosystem.config.js

echo "✅ Update complete!"
```

## Performance Optimization

### 1. System Tuning
```bash
# Increase file descriptor limits
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# Optimize memory usage
echo "vm.swappiness=10" | sudo tee -a /etc/sysctl.conf
```

### 2. Log Rotation
```bash
# Configure logrotate
sudo nano /etc/logrotate.d/node-monitor
```

```
/var/log/node-monitor/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 644 pi pi
    postrotate
        pm2 reloadLogs
    endscript
}
```

## Troubleshooting

### Common Issues
1. **Permission Errors**: Check file ownership and permissions
2. **Port Conflicts**: Ensure port 3001 is not in use
3. **Memory Issues**: Monitor with `pm2 monit`, adjust max_memory_restart
4. **Docker Access**: Verify pi user is in docker group
5. **SSL Issues**: Check certificate paths and permissions

### Health Check Script
```bash
#!/bin/bash
# scripts/health-check.sh

# Check if service is running
if pm2 list | grep -q "node-monitor.*online"; then
    echo "✅ Service is running"
else
    echo "❌ Service is not running"
    exit 1
fi

# Check API endpoint
if curl -f -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ API is responding"
else
    echo "❌ API is not responding"
    exit 1
fi
```

This setup provides a production-ready deployment of the node-monitor service on your Raspberry Pi with proper security, monitoring, and maintenance capabilities.