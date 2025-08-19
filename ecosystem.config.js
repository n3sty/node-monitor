module.exports = {
  apps: [{
    name: 'node-monitor',
    script: 'src/app.js',
    interpreter: 'bun',
    cwd: '/opt/node-monitor',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/node-monitor/error.log',
    out_file: '/var/log/node-monitor/out.log',
    log_file: '/var/log/node-monitor/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}