const logger = require('../utils/logger')

const requestLoggerMiddleware = (req, res, next) => {
  const start = Date.now()
  const { method, url, ip, headers } = req
  
  // Log request start in development with detailed info
  if (process.env.NODE_ENV !== 'production') {
    logger.info('Incoming request', {
      method,
      url,
      ip: ip || req.connection.remoteAddress,
      userAgent: headers['user-agent'],
      contentType: headers['content-type'],
      authorization: headers.authorization ? '[REDACTED]' : 'none',
      timestamp: new Date().toISOString()
    })
  }

  // Capture the original end function
  const originalEnd = res.end

  // Override the end function to log response
  res.end = function(...args) {
    const duration = Date.now() - start
    const { statusCode } = res
    
    if (process.env.NODE_ENV !== 'production') {
      // Detailed logging in development
      logger.info('Request completed', {
        method,
        url,
        statusCode,
        duration: `${duration}ms`,
        ip: ip || req.connection.remoteAddress,
        contentLength: res.get('content-length') || 0,
        timestamp: new Date().toISOString()
      })
    } else {
      // Concise logging in production
      logger.info(`${method} ${url} ${statusCode} ${duration}ms`)
    }

    // Call the original end function
    originalEnd.apply(this, args)
  }

  next()
}

module.exports = { requestLoggerMiddleware }