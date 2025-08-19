const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization
  const apiKey = process.env.API_KEY

  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }

  const token = authHeader.substring(7)
  
  if (token !== apiKey) {
    return res.status(401).json({ error: 'Invalid API key' })
  }

  next()
}

module.exports = { authMiddleware }