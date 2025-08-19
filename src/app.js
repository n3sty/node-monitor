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
const logger = require('./utils/logger')

const app = express()

app.use(helmet())
app.use(compression())
app.use(corsMiddleware)
app.use(rateLimiter)

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
server.listen(PORT, () => {
  logger.info(`Node Monitor running on port ${PORT} ${sslEnabled ? '(HTTPS)' : '(HTTP)'}`)
})