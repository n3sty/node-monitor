require('dotenv').config()
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
const { requestLoggerMiddleware } = require('./middleware/request-logger')
const { requestIdMiddleware } = require('./middleware/request-id')
const logger = require('./utils/logger')

const app = express()

app.use(helmet())
app.use(compression())
app.use(corsMiddleware)
app.use(requestIdMiddleware)
app.use(rateLimiter)
app.use(requestLoggerMiddleware)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.use('/api', authMiddleware)

app.use('/api/system', systemRoutes)
app.use('/api/docker', dockerRoutes)
app.use('/api/health', healthRoutes)

app.use(errorHandler)

const sslEnabled = process.env.SSL_ENABLED === 'true'
const server = sslEnabled 
  ? createServer({
      key: readFileSync(process.env.SSL_KEY_PATH),
      cert: readFileSync(process.env.SSL_CERT_PATH)
    }, app)
  : require('http').createServer(app)

websocketService.initialize(server)

const PORT = process.env.PORT || 3001

// Enhanced startup logging
server.listen(PORT, () => {
  const startupInfo = {
    port: PORT,
    protocol: sslEnabled ? 'HTTPS' : 'HTTP',
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    pid: process.pid,
    version: process.env.npm_package_version || '1.0.0',
    hostname: require('os').hostname(),
    platform: process.platform,
    nodeVersion: process.version,
    memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    uptime: `${Math.round(process.uptime())}s`
  }
  
  logger.info('Node Monitor started successfully', startupInfo)
  
  // Log environment configuration (without sensitive data)
  logger.debug('Environment configuration', {
    SSL_ENABLED: process.env.SSL_ENABLED,
    API_KEY_SET: !!process.env.API_KEY,
    ALLOWED_ORIGINS_SET: !!process.env.ALLOWED_ORIGINS,
    LOG_LEVEL: process.env.LOG_LEVEL,
    NODE_ENV: process.env.NODE_ENV
  })
})

// Enhanced shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')
  server.close(() => {
    logger.info('Server closed successfully')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully')
  server.close(() => {
    logger.info('Server closed successfully')  
    process.exit(0)
  })
})

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack })
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', { reason, promise })
  process.exit(1)
})