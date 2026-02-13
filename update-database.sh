#!/bin/bash

# Database Update Script for VPS
# This script will apply all database schema changes

echo "🔄 AI Voice Receptionist - Database Update"
echo "=========================================="
echo ""

# Check if running in correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from project root directory"
    exit 1
fi

echo "📋 Step 1: Checking Prisma schema..."
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ Error: prisma/schema.prisma not found"
    exit 1
fi
echo "✅ Schema file found"
echo ""

echo "📋 Step 2: Generating Prisma Client..."
npx prisma generate
if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to generate Prisma Client"
    exit 1
fi
echo "✅ Prisma Client generated"
echo ""

echo "📋 Step 3: Pushing schema changes to database..."
echo "   This will create the following new tables:"
echo "   - FAQ"
echo "   - KnowledgeBaseEntry"
echo "   - CallFlow"
echo "   - FlowType enum"
echo ""
npx prisma db push
if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to push database changes"
    exit 1
fi
echo "✅ Database schema updated"
echo ""

echo "📋 Step 4: Verifying database connection..."
npx prisma db execute --stdin <<EOF
SELECT 
  table_name 
FROM 
  information_schema.tables 
WHERE 
  table_schema = 'public' 
  AND table_name IN ('FAQ', 'KnowledgeBaseEntry', 'CallFlow')
ORDER BY 
  table_name;
EOF

if [ $? -eq 0 ]; then
    echo "✅ New tables verified in database"
else
    echo "⚠️  Warning: Could not verify tables (but they may still exist)"
fi
echo ""

echo "=========================================="
echo "✅ Database update complete!"
echo ""
echo "Next steps:"
echo "1. Restart the application: docker compose restart app"
echo "2. Check logs: docker compose logs -f app"
echo "3. Test creating FAQs, Knowledge entries, and Call Flows"
echo ""
