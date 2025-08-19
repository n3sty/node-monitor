const express = require('express')
const router = express.Router()

const checkSystemService = async () => {
  try {
    const systemMonitor = require('../services/system-monitor')
    await systemMonitor.getSystemOverview()
    return { status: 'healthy' }
  } catch (error) {
    return { status: 'unhealthy', error: error.message }
  }
}

const checkDockerService = async () => {
  try {
    const dockerMonitor = require('../services/docker-monitor')
    await dockerMonitor.listContainers()
    return { status: 'healthy' }
  } catch (error) {
    return { status: 'unhealthy', error: error.message }
  }
}

const checkCacheService = async () => {
  try {
    const cacheService = require('../services/cache-service')
    await cacheService.set('health:test', 'ok', 1)
    const result = await cacheService.get('health:test')
    return result === 'ok' ? { status: 'healthy' } : { status: 'unhealthy' }
  } catch (error) {
    return { status: 'unhealthy', error: error.message }
  }
}

router.get('/', async (req, res) => {
  const [system, docker, cache] = await Promise.all([
    checkSystemService(),
    checkDockerService(),
    checkCacheService()
  ])

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    services: { system, docker, cache }
  }
  
  const hasUnhealthy = Object.values(health.services).some(s => s.status === 'unhealthy')
  if (hasUnhealthy) health.status = 'degraded'
  
  res.json(health)
})

module.exports = router