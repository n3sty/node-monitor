const logger = require('../utils/logger')

const errorHandler = (err, req, res, next) => {
  // Enhanced error logging with more context
  const errorContext = {
    error: err.message,
    name: err.name,
    code: err.code,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    requestId: req.id || 'unknown',
    body: req.method !== 'GET' && req.body ? JSON.stringify(req.body).substring(0, 1000) : undefined,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    params: Object.keys(req.params).length > 0 ? req.params : undefined
  }

  // Log different levels based on error type
  if (err.status >= 400 && err.status < 500) {
    logger.warn('Client error occurred', errorContext)
  } else {
    logger.error('Server error occurred', errorContext)
  }

  // Enhanced error responses with better categorization
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.message,
      timestamp: new Date().toISOString()
    })
  }

  if (err.code === 'ENOENT' || err.code === 'ENOTFOUND') {
    return res.status(404).json({
      error: 'Resource not found',
      timestamp: new Date().toISOString()
    })
  }

  if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
    logger.error('Connection error - service may be down', { code: err.code, message: err.message })
    return res.status(503).json({
      error: 'Service temporarily unavailable',
      timestamp: new Date().toISOString()
    })
  }

  // Handle Docker-related errors more specifically
  if (err.name === 'Docker error' || 
      err.message?.includes('Docker') || 
      err.message?.includes('docker') ||
      err.message?.includes('Was there a typo in the url or port') ||
      err.code === 'ENOENT' && err.message?.includes('docker.sock')) {
    logger.error('Docker service error', { originalError: err.message })
    return res.status(503).json({
      error: 'Docker service unavailable',
      message: 'Docker daemon is not accessible or not running',
      timestamp: new Date().toISOString()
    })
  }

  // Default internal server error
  const isDevelopment = process.env.NODE_ENV !== 'production'
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: isDevelopment ? err.message : 'Something went wrong',
    stack: isDevelopment ? err.stack : undefined,
    timestamp: new Date().toISOString()
  })
}

module.exports = { errorHandler }