#!/bin/bash

# GitHub Deployment Script for VPS
# Usage: ./github-deploy.sh

set -e

echo "🚀 Starting deployment from GitHub..."

# Configuration
REPO_URL="https://github.com/yourusername/ai-voice-receptionist.git"
BRANCH="main"
APP_DIR="$HOME/ai-voice-receptionist"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if we're in the app directory
if [ ! -d "$APP_DIR" ]; then
    print_error "Directory $APP_DIR not found!"
    echo "Creating directory and cloning repository..."
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
else
    cd "$APP_DIR"
fi

# Stash any local changes
print_status "Stashing local changes..."
git stash

# Pull latest changes
print_status "Pulling latest changes from GitHub..."
git pull origin "$BRANCH"

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found!"
    print_warning "Please create .env file before continuing."
    print_warning "You can use .env.docker as a template:"
    echo ""
    echo "  cp .env.docker .env"
    echo "  nano .env"
    echo ""
    exit 1
fi

# Build and restart containers
print_status "Building Docker images..."
docker compose build

print_status "Starting containers..."
docker compose up -d

# Wait for database to be ready
print_status "Waiting for database to be ready..."
sleep 5

# Run database migrations
print_status "Running database migrations..."
docker compose exec -T app npx prisma migrate deploy

# Check if containers are running
print_status "Checking container status..."
docker compose ps

# View recent logs
print_status "Recent application logs:"
docker compose logs --tail=50 app

# Health check
print_status "Performing health check..."
sleep 3
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    print_status "✅ Application is healthy!"
else
    print_warning "Health check failed. Check logs with: docker compose logs app"
fi

echo ""
print_status "🎉 Deployment complete!"
echo ""
echo "Useful commands:"
echo "  View logs:        docker compose logs -f app"
echo "  Restart app:      docker compose restart app"
echo "  Stop all:         docker compose down"
echo "  View status:      docker compose ps"
echo ""
