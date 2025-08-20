const express = require('express')
const dockerMonitor = require('../services/docker-monitor')
const router = express.Router()

router.get('/status', async (req, res, next) => {
  try {
    const status = {
      available: dockerMonitor.dockerAvailable,
      enabled: process.env.DOCKER_ENABLED !== 'false',
      socketPath: '/var/run/docker.sock',
      timestamp: new Date().toISOString()
    }
    
    if (dockerMonitor.dockerAvailable) {
      try {
        const containers = await dockerMonitor.listContainers()
        status.containers = containers.length
        status.healthy = true
      } catch (error) {
        status.healthy = false
        status.error = error.message
      }
    }
    
    res.json({ success: true, data: status })
  } catch (error) {
    next(error)
  }
})

router.get('/containers', async (req, res, next) => {
  try {
    const data = await dockerMonitor.listContainers()
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

router.get('/containers/:id/stats', async (req, res, next) => {
  try {
    const { id } = req.params
    const data = await dockerMonitor.getContainerStats(id)
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

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

module.exports = router