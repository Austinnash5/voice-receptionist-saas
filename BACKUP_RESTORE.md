# Backup & Restore Guide - Voice Receptionist v1.0.0

**Backup Date:** February 17, 2026  
**Version:** v1.0.0-voice-only (Standalone AI Voice Receptionist - Pre-CRM Integration)

---

## 🎯 What Was Backed Up

This is the **standalone AI Voice Receptionist** before integrating CRM, SMS Marketing, Email Marketing, and Chatbot features.

### Features in This Version:
- ✅ Multi-tenant AI voice receptionist
- ✅ Twilio voice integration
- ✅ Flow builder with custom flows
- ✅ Menu system with delays
- ✅ Lead collection with custom fields
- ✅ Knowledge base with RAG
- ✅ Business hours scheduling
- ✅ Call analytics
- ✅ Lead CSV export
- ✅ Email notifications
- ✅ Admin & tenant dashboards

---

## 📦 Backup Locations

### 1. Git Repository Backups (PRIMARY)

**Release Branch:**
```bash
# Clone the specific release branch
git clone -b release/voice-only-v1.0.0 https://github.com/Austinnash5/voice-receptionist-saas.git voice-receptionist-standalone

# Or checkout from existing repo
git checkout release/voice-only-v1.0.0
```

**Git Tag:**
```bash
# Checkout the tagged version
git checkout v1.0.0-voice-only

# Or create branch from tag
git checkout -b voice-only-restore v1.0.0-voice-only
```

**Latest Commit Hash:** `cabc79a` (includes custom lead fields feature)

### 2. Local Archive Backup
- **Location:** `~/Backups/voice-receptionist-v1.0.0-20260217.tar.gz`
- **Size:** ~500KB (without node_modules)
- **Contents:** Full source code, config, migrations, views

```bash
# To restore from archive
cd ~/Desktop
tar -xzf ~/Backups/voice-receptionist-v1.0.0-20260217.tar.gz -C ./voice-receptionist-restored
cd ./voice-receptionist-restored
npm install
```

### 3. Database Schema State

**Migrations Included:**
- `000_init` - Initial schema (Tenant, PhoneNumber, Call, Lead, etc.)
- `001_add_menu_option_delay` - Menu delay feature
- `002_add_lead_custom_fields` - LeadField model for custom lead data

**Models in v1.0.0:**
- Tenant
- PhoneNumber
- User
- Call
- CallMetadata
- Lead
- LeadField (custom fields)
- BusinessHour
- KnowledgeDocument
- KnowledgeChunk
- FAQ
- FlowConfig
- FlowStep
- MenuOption

---

## 🚀 How to Redeploy Standalone Version

### Option 1: New Server Deployment (Recommended)

```bash
# 1. Clone the release branch
git clone -b release/voice-only-v1.0.0 https://github.com/Austinnash5/voice-receptionist-saas.git voice-standalone
cd voice-standalone

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your values

# 4. Set up database (ensure PostgreSQL with pgvector is running)
npx prisma generate
npx prisma migrate deploy

# 5. Build
npm run build

# 6. Run
npm start
```

### Option 2: Docker Deployment

```bash
# 1. Clone repository
git clone -b release/voice-only-v1.0.0 https://github.com/Austinnash5/voice-receptionist-saas.git
cd voice-receptionist-saas

# 2. Build and run with Docker Compose
docker-compose up -d

# 3. Run migrations inside container
docker exec voice-receptionist-app npx prisma generate
docker exec voice-receptionist-app npx prisma migrate deploy
```

### Option 3: Deploy to Existing Production Server

```bash
# SSH into server
ssh austin@66.29.152.63

# Stop current app
cd /opt/voice-app/app
docker-compose down

# Checkout release branch
git fetch origin
git checkout release/voice-only-v1.0.0

# Rebuild and restart
docker-compose up -d --build

# Run migrations
docker exec voice-receptionist-app npx prisma generate
docker exec voice-receptionist-app npx prisma migrate deploy
```

---

## 🔄 Restore from Archive (Manual Method)

If GitHub is unavailable or you need the exact files:

```bash
# 1. Extract archive
tar -xzf ~/Backups/voice-receptionist-v1.0.0-20260217.tar.gz -C ~/voice-standalone
cd ~/voice-standalone

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env file

# 4. Database setup
npx prisma generate
npx prisma migrate deploy

# 5. Start application
npm run build
npm start
```

---

## 📊 Database Restoration

### To Restore Schema Only (structure, no data):

```bash
# If you have schema backup file
psql -U voice_user -d voice_receptionist_restored < voice-schema-v1.0.0.sql
```

### To Restore Full Database (with data):

```bash
# Create database dump on production first
ssh austin@66.29.152.63
docker exec voice-receptionist-postgres pg_dump -U voice_user voice_receptionist > /tmp/voice-full-backup.sql

# Download locally
scp austin@66.29.152.63:/tmp/voice-full-backup.sql ~/Backups/

# Restore to new database
createdb voice_receptionist_standalone
psql -U postgres -d voice_receptionist_standalone < ~/Backups/voice-full-backup.sql
```

---

## 🏷️ Version Identification

To verify you're running the standalone version:

```bash
# Check git tag
git describe --tags
# Should show: v1.0.0-voice-only

# Check git branch
git branch
# Should show: release/voice-only-v1.0.0

# Check commit
git log --oneline -1
# Should show: cabc79a feat: add collect lead information flow step with custom questions
```

---

## 🔧 Configuration Differences

When deploying standalone version separately from CRM suite:

### **Environment Variables (Same as current):**
- `DATABASE_URL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `OPENAI_API_KEY`
- `SESSION_SECRET`
- `BASE_URL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

### **No Additional Variables Needed**
The standalone version doesn't need CRM/SMS/Email/Chatbot credentials

---

## 🎯 Use Cases for Standalone Redeployment

1. **Separate Product Offering:**
   - Sell "Voice-Only" tier at lower price ($49-99/mo)
   - Upsell to full suite ($199-499/mo)

2. **Client-Specific Instance:**
   - Enterprise client wants voice-only features
   - Simpler, focused product

3. **Testing Environment:**
   - Test voice features without CRM complexity

4. **White Label:**
   - Partner wants voice receptionist only
   - Rebrand and deploy independently

5. **Rollback Option:**
   - If CRM integration causes issues
   - Quick rollback to stable version

---

## 📋 Pre-CRM Integration Checklist

Before you started adding CRM features, this version included:

**Core Features:**
- [x] Tenant management
- [x] Phone number provisioning
- [x] AI voice conversations
- [x] Flow builder
- [x] Menu system with customizable delays
- [x] Lead capture with custom questions
- [x] Knowledge base with vector search
- [x] Business hours
- [x] Call logging and analytics
- [x] Email notifications
- [x] CSV export
- [x] Multi-tenant isolation
- [x] Admin dashboard
- [x] Tenant dashboard

**Not Included (Coming in Suite):**
- [ ] Full CRM (contacts, deals, pipeline)
- [ ] SMS marketing campaigns
- [ ] Email marketing
- [ ] AI chatbot widget
- [ ] WordPress plugin
- [ ] Advanced automation
- [ ] Multi-channel timeline

---

## 🆘 Troubleshooting Restore

### Issue: "Module not found" errors
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: Database connection errors
```bash
# Check PostgreSQL is running with pgvector
docker ps | grep postgres

# Verify DATABASE_URL in .env
cat .env | grep DATABASE_URL
```

### Issue: Prisma client errors
```bash
npx prisma generate
npx prisma migrate deploy
```

### Issue: Port already in use
```bash
# Change PORT in .env or kill process
lsof -ti:3000 | xargs kill -9
```

---

## 📞 Support

If you need to restore this version:

1. Check this document first
2. Review git tag/branch: `v1.0.0-voice-only` / `release/voice-only-v1.0.0`
3. Use archive backup: `~/Backups/voice-receptionist-v1.0.0-20260217.tar.gz`
4. Consult original `README.md`, `QUICKSTART.md`, `DEPLOYMENT.md` in the repo

---

## 🔐 Security Note

This backup includes:
- ✅ Source code
- ✅ Database schema
- ✅ Configuration templates

This backup does NOT include:
- ❌ Environment variables (.env)
- ❌ Production database data
- ❌ API keys/secrets
- ❌ node_modules

**Always configure new .env file with fresh credentials when redeploying.**

---

**Created:** February 17, 2026  
**Last Updated:** February 17, 2026  
**Status:** Ready for CRM integration on main branch  
**Backup Status:** ✅ Complete and verified
