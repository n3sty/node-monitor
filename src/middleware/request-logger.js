const logger = require('../utils/logger')

const requestLoggerMiddleware = (req, res, next) => {
  const start = Date.now()
  const { method, url, ip, headers } = req
  const requestId = req.id
  
  // Create base request context
  const requestContext = {
    requestId,
    method,
    url,
    ip: ip || req.connection?.remoteAddress || 'unknown',
    userAgent: headers['user-agent']?.substring(0, 100) || 'unknown'
  }

  // Log request start with appropriate detail level
  const logLevel = process.env.LOG_LEVEL || 'info'
  if (logLevel === 'debug' || process.env.NODE_ENV !== 'production') {
    logger.info('Request started', {
      ...requestContext,
      contentType: headers['content-type'],
      contentLength: headers['content-length'],
      authorization: headers.authorization ? '[REDACTED]' : undefined,
      origin: headers.origin,
      referer: headers.referer
    })
  }

  // Capture the original end function
  const originalEnd = res.end

  // Override the end function to log response
  res.end = function(...args) {
    const duration = Date.now() - start
    const { statusCode } = res
    
    const responseContext = {
      ...requestContext,
      statusCode,
      duration,
      responseSize: res.get('content-length') || 0
    }

    // Log based on status code and environment
    if (statusCode >= 400) {
      logger.warn('Request completed with error', responseContext)
    } else if (logLevel === 'debug' || process.env.NODE_ENV !== 'production') {
      logger.info('Request completed', responseContext)
    } else {
      // Concise production logging for successful requests
      logger.info(`${method} ${url} ${statusCode} ${duration}ms`, { requestId })
    }

    // Call the original end function
    originalEnd.apply(this, args)
  }

  next()
}

module.exports = { requestLoggerMiddleware }