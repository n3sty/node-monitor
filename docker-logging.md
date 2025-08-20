# Docker Logging Configuration

This service now includes enhanced logging specifically optimized for Docker environments.

## Environment Variables

Set these environment variables for optimal Docker logging:

```bash
# Basic configuration
NODE_ENV=production          # Enables production logging mode
LOG_LEVEL=info              # Available: error, warn, info, debug
LOG_FORMAT=json             # Use 'json' for log aggregation, omit for readable format
DOCKER=true                 # Force Docker-optimized logging

# Optional
LOG_TO_FILE=false           # Disable file logging in containers (recommended)
```

## Log Formats

### Development/Readable Format (default in Docker)
```
[2024-01-15 10:30:25.123] INFO  [node-monitor] Node Monitor started successfully {"port":3001,"protocol":"HTTP"...}
[2024-01-15 10:30:26.456] INFO  [node-monitor] Request completed {"requestId":"abc-123","method":"GET","url":"/api/health"...}
```

### JSON Format (for log aggregation)
Set `LOG_FORMAT=json`:
```json
{"timestamp":"2024-01-15T10:30:25.123Z","level":"info","message":"Node Monitor started successfully","service":"node-monitor","container":"app-123","port":3001}
```

## Docker Compose Example

```yaml
version: '3.8'
services:
  node-monitor:
    build: .
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - LOG_FORMAT=json
      - DOCKER=true
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Viewing Logs

```bash
# View live logs
docker logs -f container-name

# View with timestamps
docker logs -t container-name

# Filter by log level (with JSON format)
docker logs container-name 2>&1 | grep '"level":"error"'

# Follow specific request
docker logs container-name 2>&1 | grep 'abc-123'  # requestId
```

## Log Levels

- **error**: Server errors, uncaught exceptions, Docker connection issues
- **warn**: Client errors (4xx), connection problems, service warnings  
- **info**: Request completion, startup/shutdown, important events
- **debug**: Request details, environment config, detailed troubleshooting

## Features

- **Request tracing**: Each request gets a unique ID for full lifecycle tracking
- **Container metadata**: Automatic container hostname and version tracking
- **Error categorization**: Different log levels for client vs server errors
- **Docker detection**: Automatic format optimization for containerized environments
- **Graceful shutdown**: Proper logging of shutdown signals and cleanup
- **Security**: Sensitive data (API keys, auth headers) automatically redacted

## Troubleshooting

If logs aren't appearing:
1. Check `NODE_ENV` and `LOG_LEVEL` environment variables
2. Ensure Docker container has proper stdout/stderr handling
3. Verify log driver configuration in Docker
4. Check for uncaught exceptions preventing startup logging