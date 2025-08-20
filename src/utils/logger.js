const winston = require('winston')

// Detect if running in Docker container
const isDocker = process.env.DOCKER || process.env.npm_config_cache === '/.npm'

// Enhanced format for better readability in Docker logs
const dockerFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''
    return `[${timestamp}] ${level.toUpperCase().padEnd(5)} [${service}] ${message}${metaStr}`
  })
)

// JSON format for production log aggregation
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

// Colorized format for local development
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta, null, 2)}` : ''
    return `[${timestamp}] ${level} [${service}] ${message}${metaStr}`
  })
)

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  defaultMeta: { 
    service: 'node-monitor',
    container: process.env.HOSTNAME || 'unknown',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: []
})

// Configure transports based on environment
if (isDocker || process.env.NODE_ENV === 'production') {
  // Docker/Production: JSON to stdout for log aggregation, readable format to stderr for debugging
  logger.add(new winston.transports.Console({
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT === 'json' ? jsonFormat : dockerFormat,
    stderrLevels: ['error', 'warn']
  }))
} else {
  // Local Development: Colorized readable format
  logger.add(new winston.transports.Console({
    level: 'debug',
    format: devFormat
  }))
  
  // Optional file logging in development
  if (process.env.LOG_TO_FILE === 'true') {
    logger.add(new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      format: jsonFormat
    }))
    logger.add(new winston.transports.File({ 
      filename: 'logs/combined.log',
      format: jsonFormat
    }))
  }
}

module.exports = logger