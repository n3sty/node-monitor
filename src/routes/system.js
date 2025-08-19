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
      await cacheService.set(cacheKey, data, 30)
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

router.get('/cpu', async (req, res, next) => {
  try {
    const data = await systemMonitor.getCpuMetrics()
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

router.get('/memory', async (req, res, next) => {
  try {
    const data = await systemMonitor.getMemoryMetrics()
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

router.get('/disk', async (req, res, next) => {
  try {
    const data = await systemMonitor.getDiskMetrics()
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

router.get('/network', async (req, res, next) => {
  try {
    const data = await systemMonitor.getNetworkMetrics()
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

module.exports = router