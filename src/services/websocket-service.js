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
      path: process.env.WS_PATH || '/ws/metrics' 
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

    this.startMetricsBroadcast()
  }

  startMetricsBroadcast() {
    const interval = parseInt(process.env.METRICS_INTERVAL) || 5000
    
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
    }, interval)
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

  stop() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
    }
    if (this.wss) {
      this.wss.close()
    }
  }
}

module.exports = new WebSocketService()