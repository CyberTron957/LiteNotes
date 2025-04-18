module.exports = {
  apps : [{
    name   : "litenotes-app", // Choose a name for your app
    script : "app.js",        // The script PM2 will run
    env_production: {       // Environment variables for production
       NODE_ENV: "production",
       // You might need to add other production env vars here,
       // like PORT, SECRET_KEY, DB credentials, if they aren't
       // already set globally on your server or in a .env file
       // PORT: 3000, 
       // SECRET_KEY: 'your_production_secret'
    }
  }]
} 