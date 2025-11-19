# 🚀 LiteNotes Production Deployment Guide

## Prerequisites

- ✅ Node.js 16+ installed
- ✅ PM2 installed globally (`npm install -g pm2`)
- ✅ Caddy installed
- ✅ PostgreSQL database running
- ✅ Redis server running

---

## 📋 Deployment Checklist

### 1️⃣ **Prepare Your Server**

```bash
# SSH into your server
ssh user@your-server.com

# Navigate to your app directory
cd /path/to/LiteNotes

# Pull latest changes (if using git)
git pull origin main
```

### 2️⃣ **Configure Environment Variables**

Ensure your `.env` file has all required variables:

```bash
# CRITICAL - Set these in production!
NODE_ENV=production
SECRET_KEY=your-super-secret-key-min-32-chars
PORT=3000

# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=fastnotes_db
PG_USER=notes_user
PG_PASSWORD=your_secure_password_here

# Redis
REDIS_URL=redis://localhost:6379

# Email (Gmail SMTP)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password

# Base URL
BASE_URL=https://litenotes.xyz
```

**⚠️ IMPORTANT:**
- Never commit `.env` to git
- Use strong random values for `SECRET_KEY`
- Use app passwords for Gmail (not your main password)

---

### 3️⃣ **Run Deployment Script**

```bash
# Make script executable (first time only)
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

This will:
- ✅ Install dependencies
- ✅ Build production bundle
- ✅ Start PM2 cluster mode
- ✅ Configure auto-restart
- ✅ Save PM2 configuration

---

### 4️⃣ **Configure Caddy**

**Edit the Caddyfile:**

```bash
# Update the path in Caddyfile
nano Caddyfile

# Change this line to your actual path:
root * /path/to/LiteNotes/dist
```

**Copy Caddyfile to Caddy config directory:**

```bash
# Option 1: Copy to /etc/caddy/
sudo cp Caddyfile /etc/caddy/Caddyfile

# Option 2: Or create symlink
sudo ln -s /path/to/LiteNotes/Caddyfile /etc/caddy/Caddyfile
```

**Reload Caddy:**

```bash
# Test configuration
sudo caddy validate --config /etc/caddy/Caddyfile

# Reload Caddy
sudo systemctl reload caddy

# Or restart if needed
sudo systemctl restart caddy
```

---

### 5️⃣ **Verify Deployment**

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs litenotes-app --lines 50

# Monitor performance
pm2 monit

# Check Caddy status
sudo systemctl status caddy

# Test the API
curl https://litenotes.xyz/home
```

---

## 🔄 **Quick Deployment Commands**

### Deploy Updates

```bash
git pull origin main
./deploy.sh
```

### Restart App

```bash
pm2 restart litenotes-app
```

### View Logs

```bash
# PM2 logs
pm2 logs litenotes-app

# Application logs
tail -f logs/out.log
tail -f logs/err.log

# Caddy logs
sudo tail -f /var/log/caddy/litenotes.log
```

### Rollback

```bash
# Stop current version
pm2 stop litenotes-app

# Checkout previous version
git checkout <previous-commit>

# Redeploy
./deploy.sh
```

---

## 🎯 **Performance Optimization**

Your deployment is already optimized with:

✅ **Brotli + Gzip compression** (via Vite + Caddy)
✅ **HTTP/2** (automatic with Caddy)
✅ **Cluster mode** (multi-core support via PM2)
✅ **Aggressive caching** (1 year for static assets)
✅ **Minified bundles** (Terser)
✅ **Code splitting** (Socket.io separate chunk)
✅ **Optimized images** (WebP, 99% smaller)
✅ **Security headers** (Helmet + Caddy)
✅ **Rate limiting** (per endpoint)

---

## 🔒 **Security Best Practices**

- ✅ HTTPS enforced (automatic with Caddy)
- ✅ Security headers configured
- ✅ Rate limiting enabled
- ✅ CSRF protection (sameSite cookies)
- ✅ XSS protection (CSP headers)
- ✅ Session security (httpOnly, secure cookies)

---

## 🐛 **Troubleshooting**

### App won't start

```bash
# Check logs
pm2 logs litenotes-app --lines 100

# Check environment variables
pm2 env 0

# Test manually
NODE_ENV=production node app.js
```

### Database connection issues

```bash
# Test PostgreSQL connection
psql -h localhost -U notes_user -d fastnotes_db

# Check if database exists
sudo -u postgres psql -l
```

### Redis connection issues

```bash
# Check Redis status
redis-cli ping

# Should return "PONG"
```

### Caddy issues

```bash
# Check Caddy config
sudo caddy validate --config /etc/caddy/Caddyfile

# Check Caddy logs
sudo journalctl -u caddy -f
```

### Socket.IO not connecting

```bash
# Ensure WebSocket proxy is configured in Caddyfile
# Check if port 3000 is accessible
curl http://localhost:3000/socket.io/

# Check firewall
sudo ufw status
```

---

## 📊 **Monitoring**

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Web dashboard (optional)
pm2 install pm2-server-monit
```

### Check Performance

```bash
# Using curl
curl -w "@-" -o /dev/null -s https://litenotes.xyz << 'EOF'
    time_namelookup:  %{time_namelookup}\n
       time_connect:  %{time_connect}\n
          time_total:  %{time_total}\n
         size_download:  %{size_download}\n
EOF
```

### Lighthouse Score

```bash
# Install lighthouse CLI
npm install -g lighthouse

# Run audit
lighthouse https://litenotes.xyz --view
```

---

## 🎉 **Expected Results**

After deployment, you should see:

- ⚡ **Page load < 1s** (on fast connection)
- 🎯 **Lighthouse Score: 95+**
- 📦 **Initial bundle: ~60 KB**
- 🚀 **Time to Interactive: <1s**
- 💾 **Assets cached for 1 year**

---

## 📞 **Support**

If you encounter issues:

1. Check logs: `pm2 logs litenotes-app`
2. Check system logs: `sudo journalctl -u caddy`
3. Verify environment variables
4. Test database/Redis connections
5. Check firewall rules

---

**Your app is now production-ready with enterprise-grade security and performance! 🎊**
