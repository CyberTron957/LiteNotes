#!/bin/bash

# LiteNotes Production Deployment Script
# Usage: ./deploy.sh

set -e  # Exit on error

echo "🚀 Starting LiteNotes deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm ci --production=false

# Step 2: Build production bundle
echo -e "${YELLOW}🔨 Building production bundle...${NC}"
npm run build

# Step 3: Create logs directory
echo -e "${YELLOW}📁 Creating logs directory...${NC}"
mkdir -p logs

# Step 4: Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  WARNING: .env file not found!${NC}"
    echo "Please create .env file with required variables:"
    echo "  - SECRET_KEY"
    echo "  - PG_USER, PG_HOST, PG_DATABASE, PG_PASSWORD, PG_PORT"
    echo "  - MAIL_USERNAME, MAIL_PASSWORD"
    echo "  - REDIS_URL"
    exit 1
fi

# Step 5: Stop PM2 if running
echo -e "${YELLOW}🛑 Stopping existing PM2 process...${NC}"
pm2 stop litenotes-app || true

# Step 6: Start PM2 with ecosystem file
echo -e "${YELLOW}▶️  Starting PM2 process...${NC}"
pm2 start ecosystem.config.js --env production

# Step 7: Save PM2 configuration
echo -e "${YELLOW}💾 Saving PM2 configuration...${NC}"
pm2 save

# Step 8: Setup PM2 startup script
echo -e "${YELLOW}🔄 Setting up PM2 to start on boot...${NC}"
pm2 startup || true

# Step 9: Show PM2 status
echo -e "${GREEN}✅ Deployment complete!${NC}"
pm2 status

# Step 10: Show logs
echo -e "${YELLOW}📋 Showing recent logs...${NC}"
pm2 logs litenotes-app --lines 20 --nostream

echo ""
echo -e "${GREEN}🎉 LiteNotes is now running!${NC}"
echo ""
echo "Useful commands:"
echo "  pm2 status              - Check app status"
echo "  pm2 logs litenotes-app  - View logs"
echo "  pm2 restart litenotes-app - Restart app"
echo "  pm2 stop litenotes-app  - Stop app"
echo "  pm2 monit               - Monitor resources"
