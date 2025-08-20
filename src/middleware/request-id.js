const { randomUUID } = require('crypto')

const requestIdMiddleware = (req, res, next) => {
  // Generate or use existing request ID
  const requestId = req.get('X-Request-ID') || randomUUID()
  
  // Set request ID on request object
  req.id = requestId
  
  // Add to response headers for debugging
  res.set('X-Request-ID', requestId)
  
  next()
}

module.exports = { requestIdMiddleware }