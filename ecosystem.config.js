module.exports = {
  apps : [{
    name   : "litenotes-app",
    script : "app.js",
    instances: "max", // Use all CPU cores
    exec_mode: "cluster", // Enable clustering for better performance
    env_production: {
       NODE_ENV: "production",
       PORT: 3000,
       // Note: Other sensitive env vars should be in .env file:
       // SECRET_KEY, PG_PASSWORD, MAIL_PASSWORD, etc.
    },
    // Auto-restart on crash
    autorestart: true,
    // Watch for file changes (disable in production)
    watch: false,
    // Max memory restart
    max_memory_restart: '1G',
    // Error logging
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    // Merge logs from all instances
    merge_logs: true
  }]
} 