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

  async getMemoryMetrics() {
    const mem = await si.mem()
    return {
      total: mem.total,
      used: mem.used,
      free: mem.free,
      available: mem.available,
      usage: Math.round((mem.used / mem.total) * 100 * 100) / 100,
      swap: {
        total: mem.swaptotal,
        used: mem.swapused,
        free: mem.swapfree
      },
      buffers: mem.buffers,
      cached: mem.cached
    }
  }

  async getDiskMetrics() {
    const [disks, io] = await Promise.all([
      si.fsSize(),
      si.disksIO()
    ])

    return {
      filesystems: disks.map(disk => ({
        filesystem: disk.fs,
        mountpoint: disk.mount,
        type: disk.type,
        size: disk.size,
        used: disk.used,
        available: disk.available,
        usage: Math.round((disk.used / disk.size) * 100 * 100) / 100
      })),
      io: {
        read: { operations: io.rIO, bytes: io.rIO_sec },
        write: { operations: io.wIO, bytes: io.wIO_sec }
      }
    }
  }

  async getNetworkMetrics() {
    const interfaces = await si.networkStats()
    const connections = await si.networkConnections()

    return {
      interfaces: interfaces.map(iface => ({
        name: iface.iface,
        isUp: iface.operstate === 'up',
        speed: iface.speed || 0,
        rx: {
          bytes: iface.rx_bytes,
          packets: iface.rx_sec,
          errors: iface.rx_errors,
          dropped: iface.rx_dropped
        },
        tx: {
          bytes: iface.tx_bytes,
          packets: iface.tx_sec,
          errors: iface.tx_errors,
          dropped: iface.tx_dropped
        }
      })),
      connections: {
        established: connections.filter(c => c.state === 'ESTABLISHED').length,
        listening: connections.filter(c => c.state === 'LISTEN').length
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