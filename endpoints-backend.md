# Backend Endpoints & Architecture

## Overview
This document details the backend API structure, endpoints, and internal architecture for the node-monitor service running on the Raspberry Pi.

## Application Architecture

### Core Structure
```
src/
├── app.js                    # Main Express application
├── routes/
│   ├── index.js             # Route definitions
│   ├── system.js            # System monitoring routes
│   ├── docker.js            # Docker monitoring routes
│   └── health.js            # Health check routes
├── services/
│   ├── system-monitor.js    # System metrics collection
│   ├── docker-monitor.js    # Docker container monitoring
│   ├── cache-service.js     # Data caching layer
│   └── websocket-service.js # WebSocket management
├── middleware/
│   ├── auth.js             # API key authentication
│   ├── cors.js             # CORS configuration
│   ├── rate-limit.js       # Rate limiting
│   └── error-handler.js    # Global error handling
└── utils/
    ├── logger.js           # Winston logger
    ├── config.js           # Configuration management
    └── validators.js       # Request validation
```

## Main Application Setup

### Express App Configuration
```javascript
// src/app.js
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const compression = require('compression')
const { createServer } = require('https')
const { readFileSync } = require('fs')

const systemRoutes = require('./routes/system')
const dockerRoutes = require('./routes/docker')
const healthRoutes = require('./routes/health')
const websocketService = require('./services/websocket-service')
const { errorHandler } = require('./middleware/error-handler')
const { authMiddleware } = require('./middleware/auth')
const { corsMiddleware } = require('./middleware/cors')
const { rateLimiter } = require('./middleware/rate-limit')
const logger = require('./utils/logger')
const config = require('./utils/config')

const app = express()

// Security middleware
app.use(helmet())
app.use(compression())
app.use(corsMiddleware)
app.use(rateLimiter)

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Authentication
app.use('/api', authMiddleware)

// Routes
app.use('/api/system', systemRoutes)
app.use('/api/docker', dockerRoutes)
app.use('/api/health', healthRoutes)

// Error handling
app.use(errorHandler)

// HTTPS Server setup
const server = config.ssl.enabled 
  ? createServer({
      key: readFileSync(config.ssl.keyPath),
      cert: readFileSync(config.ssl.certPath)
    }, app)
  : require('http').createServer(app)

// WebSocket setup
websocketService.initialize(server)

const PORT = config.port || 3001
server.listen(PORT, () => {
  logger.info(`Node Monitor running on port ${PORT}`)
})
```

## API Endpoints

### System Monitoring Endpoints

#### GET /api/system/overview
Returns comprehensive system overview
```javascript
// src/routes/system.js
const express = require('express')
const systemMonitor = require('../services/system-monitor')
const cacheService = require('../services/cache-service')
const router = express.Router()

router.get('/overview', async (req, res, next) => {
  try {
    const cacheKey = 'system:overview'
    let data = await cacheService.get(cacheKey)
    
    if (!data) {
      data = await systemMonitor.getSystemOverview()
      await cacheService.set(cacheKey, data, 30) // Cache for 30 seconds
    }
    
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    next(error)
  }
})

// Response format:
{
  "success": true,
  "data": {
    "hostname": "raspberrypi",
    "uptime": 1234567,
    "loadAverage": [0.5, 0.7, 0.8],
    "cpu": {
      "usage": 25.5,
      "cores": 4,
      "temperature": 45.2
    },
    "memory": {
      "total": 8589934592,
      "used": 4294967296,
      "free": 4294967296,
      "usage": 50.0
    },
    "disk": {
      "total": 32212254720,
      "used": 16106127360,
      "free": 16106127360,
      "usage": 50.0
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### GET /api/system/cpu
Detailed CPU metrics
```javascript
router.get('/cpu', async (req, res, next) => {
  try {
    const data = await systemMonitor.getCpuMetrics()
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

// Response format:
{
  "success": true,
  "data": {
    "usage": 25.5,
    "cores": [
      { "core": 0, "usage": 20.0 },
      { "core": 1, "usage": 30.0 },
      { "core": 2, "usage": 25.0 },
      { "core": 3, "usage": 27.0 }
    ],
    "temperature": 45.2,
    "frequency": 1400,
    "loadAverage": {
      "1min": 0.5,
      "5min": 0.7,
      "15min": 0.8
    }
  }
}
```

#### GET /api/system/memory
Memory usage details
```javascript
router.get('/memory', async (req, res, next) => {
  try {
    const data = await systemMonitor.getMemoryMetrics()
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

// Response format:
{
  "success": true,
  "data": {
    "total": 8589934592,
    "used": 4294967296,
    "free": 4294967296,
    "available": 4294967296,
    "usage": 50.0,
    "swap": {
      "total": 2147483648,
      "used": 0,
      "free": 2147483648
    },
    "buffers": 134217728,
    "cached": 1073741824
  }
}
```

#### GET /api/system/disk
Disk usage information
```javascript
router.get('/disk', async (req, res, next) => {
  try {
    const data = await systemMonitor.getDiskMetrics()
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

// Response format:
{
  "success": true,
  "data": {
    "filesystems": [
      {
        "filesystem": "/dev/mmcblk0p2",
        "mountpoint": "/",
        "type": "ext4",
        "size": 32212254720,
        "used": 16106127360,
        "available": 16106127360,
        "usage": 50.0
      }
    ],
    "io": {
      "read": {
        "operations": 12345,
        "bytes": 1073741824
      },
      "write": {
        "operations": 6789,
        "bytes": 536870912
      }
    }
  }
}
```

#### GET /api/system/network
Network interface statistics
```javascript
router.get('/network', async (req, res, next) => {
  try {
    const data = await systemMonitor.getNetworkMetrics()
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

// Response format:
{
  "success": true,
  "data": {
    "interfaces": [
      {
        "name": "eth0",
        "isUp": true,
        "speed": 1000,
        "rx": {
          "bytes": 1073741824,
          "packets": 1000000,
          "errors": 0,
          "dropped": 0
        },
        "tx": {
          "bytes": 536870912,
          "packets": 500000,
          "errors": 0,
          "dropped": 0
        }
      }
    ],
    "connections": {
      "established": 25,
      "listening": 10
    }
  }
}
```

### Docker Monitoring Endpoints

#### GET /api/docker/containers
List all containers with status
```javascript
// src/routes/docker.js
const express = require('express')
const dockerMonitor = require('../services/docker-monitor')
const router = express.Router()

router.get('/containers', async (req, res, next) => {
  try {
    const data = await dockerMonitor.listContainers()
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

// Response format:
{
  "success": true,
  "data": [
    {
      "id": "abc123",
      "name": "nginx-proxy",
      "image": "nginx:latest",
      "status": "running",
      "state": "Up 2 hours",
      "ports": [
        {
          "privatePort": 80,
          "publicPort": 8080,
          "type": "tcp"
        }
      ],
      "created": "2024-01-15T08:30:00.000Z",
      "started": "2024-01-15T08:30:05.000Z"
    }
  ]
}
```

#### GET /api/docker/containers/:id/stats
Container resource usage
```javascript
router.get('/containers/:id/stats', async (req, res, next) => {
  try {
    const { id } = req.params
    const data = await dockerMonitor.getContainerStats(id)
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

// Response format:
{
  "success": true,
  "data": {
    "id": "abc123",
    "name": "nginx-proxy",
    "cpu": {
      "usage": 15.5,
      "system": 2.3
    },
    "memory": {
      "usage": 134217728,
      "limit": 1073741824,
      "percentage": 12.5
    },
    "network": {
      "rx": 1024000,
      "tx": 512000
    },
    "io": {
      "read": 10485760,
      "write": 5242880
    }
  }
}
```

#### GET /api/docker/containers/:id/logs
Container logs with optional parameters
```javascript
router.get('/containers/:id/logs', async (req, res, next) => {
  try {
    const { id } = req.params
    const { lines = 100, since, until } = req.query
    
    const data = await dockerMonitor.getContainerLogs(id, {
      lines: parseInt(lines),
      since,
      until
    })
    
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

// Response format:
{
  "success": true,
  "data": {
    "logs": [
      {
        "timestamp": "2024-01-15T10:30:00.000Z",
        "stream": "stdout",
        "message": "Server started on port 80"
      }
    ],
    "totalLines": 245
  }
}
```

### Health & Utility Endpoints

#### GET /api/health
Service health check
```javascript
// src/routes/health.js
router.get('/', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,
    services: {
      system: await checkSystemService(),
      docker: await checkDockerService(),
      cache: await checkCacheService()
    }
  }
  
  res.json(health)
})
```

## Service Layer Implementation

### System Monitor Service
```javascript
// src/services/system-monitor.js
const si = require('systeminformation')
const logger = require('../utils/logger')

class SystemMonitor {
  async getSystemOverview() {
    try {
      const [cpu, mem, disk, load, temp] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.osInfo(),
        si.cpuTemperature()
      ])

      return {
        hostname: load.hostname,
        uptime: load.uptime,
        loadAverage: [load.avgLoad1, load.avgLoad5, load.avgLoad15],
        cpu: {
          usage: Math.round(cpu.currentLoad * 100) / 100,
          cores: cpu.cpus.length,
          temperature: temp.main || 0
        },
        memory: {
          total: mem.total,
          used: mem.used,
          free: mem.free,
          usage: Math.round((mem.used / mem.total) * 100 * 100) / 100
        },
        disk: this.aggregateDiskStats(disk)
      }
    } catch (error) {
      logger.error('Failed to get system overview:', error)
      throw error
    }
  }

  async getCpuMetrics() {
    const [load, temp, speed] = await Promise.all([
      si.currentLoad(),
      si.cpuTemperature(),
      si.cpuCurrentSpeed()
    ])

    return {
      usage: Math.round(load.currentLoad * 100) / 100,
      cores: load.cpus.map((core, index) => ({
        core: index,
        usage: Math.round(core.load * 100) / 100
      })),
      temperature: temp.main || 0,
      frequency: speed.avg,
      loadAverage: {
        '1min': load.avgLoad1,
        '5min': load.avgLoad5,
        '15min': load.avgLoad15
      }
    }
  }

  aggregateDiskStats(disks) {
    const root = disks.find(d => d.mount === '/') || disks[0]
    return {
      total: root?.size || 0,
      used: root?.used || 0,
      free: root?.available || 0,
      usage: Math.round((root?.used / root?.size) * 100 * 100) / 100 || 0
    }
  }
}

module.exports = new SystemMonitor()
```

### Docker Monitor Service
```javascript
// src/services/docker-monitor.js
const Docker = require('dockerode')
const logger = require('../utils/logger')

class DockerMonitor {
  constructor() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' })
  }

  async listContainers() {
    try {
      const containers = await this.docker.listContainers({ all: true })
      
      return containers.map(container => ({
        id: container.Id.substring(0, 12),
        name: container.Names[0].replace('/', ''),
        image: container.Image,
        status: container.State,
        state: container.Status,
        ports: container.Ports,
        created: new Date(container.Created * 1000).toISOString(),
        started: container.State === 'running' 
          ? new Date(container.StartedAt).toISOString() 
          : null
      }))
    } catch (error) {
      logger.error('Failed to list containers:', error)
      throw error
    }
  }

  async getContainerStats(containerId) {
    try {
      const container = this.docker.getContainer(containerId)
      const stats = await container.stats({ stream: false })
      
      return this.formatContainerStats(stats)
    } catch (error) {
      logger.error(`Failed to get stats for container ${containerId}:`, error)
      throw error
    }
  }

  formatContainerStats(stats) {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - 
                     stats.precpu_stats.cpu_usage.total_usage
    const systemDelta = stats.cpu_stats.system_cpu_usage - 
                       stats.precpu_stats.system_cpu_usage
    
    const cpuUsage = (cpuDelta / systemDelta) * 
                     stats.cpu_stats.online_cpus * 100

    return {
      cpu: {
        usage: Math.round(cpuUsage * 100) / 100,
        system: Math.round(systemDelta * 100) / 100
      },
      memory: {
        usage: stats.memory_stats.usage,
        limit: stats.memory_stats.limit,
        percentage: Math.round((stats.memory_stats.usage / 
                               stats.memory_stats.limit) * 100 * 100) / 100
      },
      network: this.calculateNetworkStats(stats.networks),
      io: {
        read: stats.blkio_stats.io_service_bytes_recursive
          ?.find(item => item.op === 'Read')?.value || 0,
        write: stats.blkio_stats.io_service_bytes_recursive
          ?.find(item => item.op === 'Write')?.value || 0
      }
    }
  }
}

module.exports = new DockerMonitor()
```

## WebSocket Implementation

### Real-time Metrics Broadcasting
```javascript
// src/services/websocket-service.js
const WebSocket = require('ws')
const systemMonitor = require('./system-monitor')
const dockerMonitor = require('./docker-monitor')
const logger = require('../utils/logger')

class WebSocketService {
  constructor() {
    this.wss = null
    this.clients = new Set()
    this.metricsInterval = null
  }

  initialize(server) {
    this.wss = new WebSocket.Server({ 
      server, 
      path: '/ws/metrics' 
    })

    this.wss.on('connection', (ws, req) => {
      logger.info('WebSocket client connected')
      this.clients.add(ws)

      ws.on('close', () => {
        logger.info('WebSocket client disconnected')
        this.clients.delete(ws)
      })

      ws.on('error', (error) => {
        logger.error('WebSocket error:', error)
        this.clients.delete(ws)
      })
    })

    // Start broadcasting metrics
    this.startMetricsBroadcast()
  }

  startMetricsBroadcast() {
    this.metricsInterval = setInterval(async () => {
      if (this.clients.size === 0) return

      try {
        const [systemData, dockerData] = await Promise.all([
          systemMonitor.getSystemOverview(),
          dockerMonitor.listContainers()
        ])

        const payload = {
          type: 'metrics_update',
          timestamp: new Date().toISOString(),
          data: {
            system: systemData,
            docker: dockerData
          }
        }

        this.broadcast(payload)
      } catch (error) {
        logger.error('Failed to broadcast metrics:', error)
      }
    }, 5000) // Broadcast every 5 seconds
  }

  broadcast(data) {
    const message = JSON.stringify(data)
    
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message)
      } else {
        this.clients.delete(client)
      }
    })
  }
}

module.exports = new WebSocketService()
```

This architecture provides a robust, scalable backend that efficiently monitors system and Docker resources while serving data to your Next.js frontend through both REST APIs and WebSocket connections.