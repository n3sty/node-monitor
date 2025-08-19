const NodeCache = require('node-cache')

class CacheService {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: parseInt(process.env.CACHE_TTL) || 30000,
      checkperiod: 600
    })
  }

  async get(key) {
    return this.cache.get(key)
  }

  async set(key, value, ttl) {
    return this.cache.set(key, value, ttl)
  }

  async del(key) {
    return this.cache.del(key)
  }

  async flush() {
    return this.cache.flushAll()
  }
}

module.exports = new CacheService()