#!/bin/bash

# AI Voice Receptionist - cPanel Deployment Script
# Run this script from your project directory on the cPanel server

set -e  # Exit on error

echo "🚀 AI Voice Receptionist - Deployment Script"
echo "=============================================="
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create .env file from .env.example and configure it."
    exit 1
fi

echo "✅ Environment file found"

# Load Node.js environment (adjust path as needed)
if [ -d "$HOME/nodevenv" ]; then
    NODE_ENV_DIR=$(find $HOME/nodevenv -type d -name "bin" | head -n 1)
    if [ -n "$NODE_ENV_DIR" ]; then
        echo "🔧 Activating Node.js environment..."
        source "$NODE_ENV_DIR/activate"
    fi
fi

# Check Node.js version
NODE_VERSION=$(node --version)
echo "📦 Node.js version: $NODE_VERSION"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install --production

# Install dev dependencies for build
echo "📦 Installing build dependencies..."
npm install --save-dev typescript @types/node ts-node prisma

# Generate Prisma client
echo ""
echo "🔨 Generating Prisma client..."
npx prisma generate

# Run database migrations
echo ""
echo "🗄️  Running database migrations..."
npx prisma migrate deploy

# Build application
echo ""
echo "🏗️  Building application..."
npm run build

# Create necessary directories
echo ""
echo "📁 Creating directories..."
mkdir -p logs tmp

# Set permissions
echo "🔒 Setting permissions..."
chmod +x app.js

# Check if app.js exists
if [ ! -f "app.js" ]; then
    echo "❌ Error: app.js not found!"
    exit 1
fi

echo ""
echo "✅ Build complete!"
echo ""
echo "📋 Next steps:"
echo "1. Verify .env configuration"
echo "2. Restart application in cPanel Node.js App"
echo "3. Configure Twilio webhooks"
echo "4. Test the application"
echo ""
echo "🎉 Deployment preparation complete!"
