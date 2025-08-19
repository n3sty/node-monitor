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

  async getContainerLogs(containerId, options = {}) {
    try {
      const container = this.docker.getContainer(containerId)
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail: options.lines || 100,
        since: options.since,
        until: options.until,
        timestamps: true
      })

      const logLines = logs.toString().split('\n')
        .filter(line => line.trim())
        .map(line => {
          const timestamp = line.substring(0, 30)
          const message = line.substring(30)
          return {
            timestamp: timestamp || new Date().toISOString(),
            stream: 'stdout',
            message: message.trim()
          }
        })

      return {
        logs: logLines,
        totalLines: logLines.length
      }
    } catch (error) {
      logger.error(`Failed to get logs for container ${containerId}:`, error)
      throw error
    }
  }

  formatContainerStats(stats) {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - 
                     stats.precpu_stats.cpu_usage.total_usage
    const systemDelta = stats.cpu_stats.system_cpu_usage - 
                       stats.precpu_stats.system_cpu_usage
    
    const cpuUsage = systemDelta > 0 ? 
      (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100 : 0

    return {
      cpu: {
        usage: Math.round(cpuUsage * 100) / 100,
        system: Math.round(systemDelta * 100) / 100
      },
      memory: {
        usage: stats.memory_stats.usage || 0,
        limit: stats.memory_stats.limit || 0,
        percentage: stats.memory_stats.limit ? 
          Math.round((stats.memory_stats.usage / stats.memory_stats.limit) * 100 * 100) / 100 : 0
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

  calculateNetworkStats(networks) {
    if (!networks) return { rx: 0, tx: 0 }
    
    const totalStats = Object.values(networks).reduce((acc, network) => ({
      rx: acc.rx + (network.rx_bytes || 0),
      tx: acc.tx + (network.tx_bytes || 0)
    }), { rx: 0, tx: 0 })

    return totalStats
  }
}

module.exports = new DockerMonitor()