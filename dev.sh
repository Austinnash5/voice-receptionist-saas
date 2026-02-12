#!/bin/bash

# Development startup script
# Run with: npm run dev

echo "🚀 Starting AI Voice Receptionist in development mode..."
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check Node.js version
NODE_VERSION=$(node --version)
echo "📦 Node.js: $NODE_VERSION"
echo ""

# Check if Prisma client is generated
if [ ! -d "node_modules/.prisma" ]; then
    echo "🔨 Generating Prisma client..."
    npx prisma generate
fi

# Check if database is accessible
echo "🗄️  Checking database connection..."
npx prisma db pull --force > /dev/null 2>&1 && echo "✅ Database connected" || echo "⚠️  Database connection failed"

echo ""
echo "🏃 Starting development server with auto-reload..."
echo ""

# Run with ts-node-dev for auto-reload
npx ts-node-dev --respawn --transpile-only src/index.ts
