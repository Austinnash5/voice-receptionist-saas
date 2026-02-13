# 🔧 Database Update Required

## Critical Issue
Your VPS database is missing the new tables: `FAQ`, `KnowledgeBaseEntry`, and `CallFlow`.

## Quick Fix (Run on VPS)

```bash
# SSH into your VPS
ssh root@66.29.152.63

# Navigate to app directory
cd /opt/voice-app/app

# Pull latest code
git pull origin main

# Make update script executable
chmod +x update-database.sh

# Run the database update (inside the app container)
docker compose run --rm app ./update-database.sh

# Restart the application
docker compose restart app

# Check logs
docker compose logs -f app
```

## Alternative: Manual Update

If the script doesn't work, run these commands:

```bash
# SSH into VPS
ssh root@66.29.152.63
cd /opt/voice-app/app

# Update database schema
docker compose run --rm app npx prisma generate
docker compose run --rm app npx prisma db push

# Restart
docker compose restart app
```

## What This Fixes

✅ **FAQ Creation** - Creates the `FAQ` table
✅ **Knowledge Base** - Creates the `KnowledgeBaseEntry` table  
✅ **Call Flows** - Creates the `CallFlow` table and `FlowType` enum
✅ **Tenants Dropdown** - Fixed in views/admin/numbers.ejs

## Verification

After running the update, test:
1. Create a new FAQ
2. Create a Knowledge Base entry
3. Create a Call Flow
4. Assign a phone number (tenants should appear in dropdown)

All should work without errors.

## What Happened?

When we added the new features, we updated the Prisma schema file but never applied those changes to your production database. The schema file is just a blueprint - you need to run `prisma db push` to actually create the tables in PostgreSQL.
