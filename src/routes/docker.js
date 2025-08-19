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