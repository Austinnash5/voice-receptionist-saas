#!/bin/bash

# GitHub Deployment Script for VPS
# This script automates pulling latest changes and redeploying the application

set -e  # Exit on error

echo "🚀 Starting deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    exit 1
}

# Check if running in the correct directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "docker-compose.yml not found. Please run this script from the project root."
fi

# Stash any local changes
echo "📦 Stashing local changes..."
git stash

# Pull latest changes from GitHub
echo "📥 Pulling latest changes from GitHub..."
if git pull origin main; then
    print_success "Code updated successfully"
else
    print_error "Failed to pull from GitHub"
fi

# Restore stashed changes if any
if git stash list | grep -q "stash@{0}"; then
    print_warning "Restoring stashed changes..."
    git stash pop || print_warning "Could not restore stashed changes"
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found"
    if [ -f ".env.docker" ]; then
        echo "📋 Would you like to copy .env.docker to .env? (y/n)"
        read -r response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            cp .env.docker .env
            print_success "Created .env from .env.docker"
            print_warning "Please edit .env and update all values before continuing"
            exit 0
        else
            print_error "Cannot proceed without .env file"
        fi
    else
        print_error ".env file required for deployment"
    fi
fi

# Rebuild the application
echo "🔨 Building Docker images..."
if docker compose build app; then
    print_success "Docker images built successfully"
else
    print_error "Failed to build Docker images"
fi

# Run database migrations
echo "🗃️  Running database migrations..."
if docker compose up -d postgres redis && sleep 5 && docker compose exec -T app npx prisma migrate deploy; then
    print_success "Database migrations completed"
else
    print_warning "Failed to run migrations (may be normal if DB is not ready yet)"
fi

# Restart the application
echo "🔄 Restarting application..."
if docker compose up -d app; then
    print_success "Application restarted"
else
    print_error "Failed to restart application"
fi

# Restart nginx if it's running
if docker compose ps | grep -q "nginx"; then
    echo "🔄 Restarting nginx..."
    docker compose restart nginx
    print_success "Nginx restarted"
fi

# Wait for health check
echo "🏥 Checking application health..."
sleep 10

if curl -f -s http://localhost:3000/health > /dev/null; then
    print_success "Application is healthy"
else
    print_warning "Health check failed, application may still be starting..."
fi

# Show container status
echo ""
echo "📊 Container Status:"
docker compose ps

# Show recent logs
echo ""
echo "📝 Recent application logs:"
docker compose logs --tail=20 app

echo ""
print_success "Deployment completed!"
echo ""
echo "💡 Useful commands:"
echo "   View logs:      docker compose logs -f app"
echo "   Check status:   docker compose ps"
echo "   Restart:        docker compose restart app"
echo "   Stop all:       docker compose down"
echo ""
