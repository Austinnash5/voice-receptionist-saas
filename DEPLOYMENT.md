# cPanel Deployment Guide

Complete step-by-step guide for deploying AI Voice Receptionist on cPanel.

## Prerequisites Checklist

- [ ] cPanel hosting account with Node.js support
- [ ] SSH access (recommended) or cPanel Terminal access
- [ ] PostgreSQL database access
- [ ] Domain or subdomain configured
- [ ] Twilio account with phone number
- [ ] OpenAI API key
- [ ] SMTP email credentials

## Step-by-Step Deployment

### 1. Prepare Local Files

On your local machine:

```bash
# Navigate to project
cd ai-voice-receptionist

# Install dependencies and build
npm install
npm run build

# Create deployment archive
tar -czf voice-receptionist.tar.gz \
  app.js \
  package.json \
  package-lock.json \
  tsconfig.json \
  .env.example \
  dist/ \
  views/ \
  public/ \
  prisma/
```

### 2. Upload to cPanel

**Option A: File Manager (GUI)**
1. Login to cPanel
2. Open **File Manager**
3. Navigate to home directory
4. Create folder: `ai-voice-receptionist`
5. Upload `voice-receptionist.tar.gz`
6. Right-click → Extract
7. Delete the `.tar.gz` file

**Option B: SSH/FTP**
```bash
# Via SCP
scp voice-receptionist.tar.gz username@your-server.com:~/

# SSH in
ssh username@your-server.com
cd ~
tar -xzf voice-receptionist.tar.gz -C ai-voice-receptionist
```

### 3. Create PostgreSQL Database

1. In cPanel, go to **PostgreSQL Databases**
2. **Create New Database**:
   - Database Name: `voice_receptionist`
   - Click **Create Database**
3. **Create Database User**:
   - Username: `voice_user`
   - Password: Generate strong password
   - Click **Create User**
4. **Add User to Database**:
   - Select user: `voice_user`
   - Select database: `voice_receptionist`
   - Click **Add**
   - Grant **ALL PRIVILEGES**
5. **Note Connection String**:
   ```
   postgresql://voice_user:PASSWORD@localhost:5432/voice_receptionist
   ```

### 4. Configure Environment Variables

Create `.env` file in `/home/yourusername/ai-voice-receptionist/`:

```bash
cd ~/ai-voice-receptionist
cp .env.example .env
nano .env  # or use cPanel file editor
```

Fill in all values:

```env
NODE_ENV=production
PORT=3000
BASE_URL=https://receptionist.yourdomain.com

DATABASE_URL=postgresql://voice_user:YOUR_PASSWORD@localhost:5432/voice_receptionist

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token

OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4-turbo-preview

EMAIL_HOST=smtp.yourdomain.com
EMAIL_PORT=587
EMAIL_USER=no-reply@yourdomain.com
EMAIL_PASSWORD=your_email_password
EMAIL_FROM=AI Receptionist <no-reply@yourdomain.com>

SESSION_SECRET=GENERATE_64_CHAR_RANDOM_STRING_HERE

DEFAULT_ADMIN_EMAIL=admin@yourdomain.com
DEFAULT_ADMIN_PASSWORD=SecurePassword123!
```

**Generate session secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Setup Node.js Application in cPanel

1. In cPanel, search for **Setup Node.js App**
2. Click **Create Application**
3. Fill in form:
   
   | Field | Value |
   |-------|-------|
   | Node.js version | 18.17.1 (or latest 18.x) |
   | Application mode | Production |
   | Application root | ai-voice-receptionist |
   | Application URL | receptionist.yourdomain.com |
   | Application startup file | app.js |
   | Passenger log file | Leave default or specify |

4. Click **Create**

5. **Important**: Copy the command shown (looks like):
   ```bash
   source /home/yourusername/nodevenv/ai-voice-receptionist/18/bin/activate && cd /home/yourusername/ai-voice-receptionist
   ```

### 6. Install Dependencies via Terminal

Open cPanel **Terminal** or SSH:

```bash
# Activate Node.js environment
source /home/yourusername/nodevenv/ai-voice-receptionist/18/bin/activate

# Navigate to app directory
cd ~/ai-voice-receptionist

# Install dependencies
npm install --production

# Install dev dependencies needed for build
npm install --save-dev typescript @types/node ts-node prisma

# Generate Prisma client
npx prisma generate
```

### 7. Run Database Migrations

Still in terminal:

```bash
# Apply all migrations
npx prisma migrate deploy

# Verify
npx prisma db push
```

**If migrations fail**, check:
- Database credentials in `.env`
- PostgreSQL service is running
- User has correct permissions

### 8. Configure Environment in cPanel

Back in **Setup Node.js App**:

1. Click **Edit** on your application
2. Scroll to **Environment Variables**
3. Add each variable from `.env`:
   - Click **Add Variable**
   - Enter Name and Value
   - Repeat for all variables
4. Click **Save**

**Variables to add:**
- NODE_ENV
- PORT
- BASE_URL
- DATABASE_URL
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- OPENAI_API_KEY
- OPENAI_MODEL
- EMAIL_HOST
- EMAIL_PORT
- EMAIL_USER
- EMAIL_PASSWORD
- EMAIL_FROM
- SESSION_SECRET
- DEFAULT_ADMIN_EMAIL
- DEFAULT_ADMIN_PASSWORD

### 9. Build and Start Application

In terminal:

```bash
# Build application
npm run build

# Restart application
cd ~/ai-voice-receptionist
touch tmp/restart.txt

# Or use cPanel Node.js App "Restart" button
```

### 10. Verify Application is Running

```bash
# Check if process is running
ps aux | grep node

# Test application
curl http://localhost:3000/health

# Should return: {"status":"ok","timestamp":"..."}
```

### 11. Configure Reverse Proxy (if needed)

If your domain isn't automatically linked:

1. In cPanel, go to **Domains** or **Subdomains**
2. Add/edit your domain
3. Set document root to application's `public` folder
4. cPanel Passenger should auto-proxy to your Node app

**Alternative: .htaccess Method**

Create `.htaccess` in public_html:

```apache
RewriteEngine On
RewriteRule ^(.*)$ http://localhost:3000/$1 [P,L]
```

### 12. Setup SSL Certificate

1. In cPanel, go to **SSL/TLS Status**
2. Find your domain
3. Click **Run AutoSSL**
4. Wait for certificate installation
5. Update `.env`:
   ```
   BASE_URL=https://receptionist.yourdomain.com
   ```
6. Restart application

### 13. Configure Twilio Webhooks

1. Login to [Twilio Console](https://console.twilio.com)
2. Navigate to **Phone Numbers** → **Manage** → **Active Numbers**
3. Click your phone number
4. **Voice Configuration**:
   - A CALL COMES IN:
     - Webhook: `https://receptionist.yourdomain.com/twilio/voice`
     - HTTP POST
   - CALL STATUS CHANGES:
     - Webhook: `https://receptionist.yourdomain.com/twilio/call-status`
     - HTTP POST
5. **Recording**:
   - Enable "Record" if desired
   - Recording Status Callback: `https://receptionist.yourdomain.com/twilio/recording-status`
6. Click **Save**

### 14. Create First Tenant

1. Visit `https://receptionist.yourdomain.com`
2. Login with DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD
3. Navigate to **Tenants** → **Create New Tenant**
4. Fill in:
   - Name: Test Business
   - Slug: test-business
   - Admin Email: tenant@example.com
   - Admin Password: (secure password)
5. Click **Create**
6. Go to **Phone Numbers**
7. Assign your Twilio number to the new tenant

### 15. Configure Receptionist

1. Logout and login as tenant admin
2. Go to **Settings**
3. Configure:
   - Greeting message
   - Transfer targets (staff phone numbers)
   - Business hours
   - Knowledge base entries
4. Save configuration

### 16. Test End-to-End

1. Call your Twilio number
2. Listen to greeting
3. Speak to the AI receptionist
4. Test various scenarios:
   - Ask a question from knowledge base
   - Request transfer
   - Leave lead information
5. Check dashboard for call record
6. Verify email notifications

## Post-Deployment Checklist

- [ ] Application accessible at domain
- [ ] HTTPS enabled
- [ ] Database connected
- [ ] Default admin can login
- [ ] Tenant created
- [ ] Phone number assigned
- [ ] Twilio webhook responding
- [ ] Test call successful
- [ ] Call recorded in database
- [ ] Email notifications working
- [ ] Background jobs processing

## Monitoring & Logs

### Application Logs

**cPanel Passenger Log:**
```
/home/yourusername/logs/[domain].log
```

**Node.js Process:**
```bash
# View logs
tail -f ~/logs/receptionist.yourdomain.com.log

# Filter errors
grep -i error ~/logs/receptionist.yourdomain.com.log
```

### Database Access

```bash
# Connect to PostgreSQL
psql voice_receptionist

# Check recent calls
SELECT * FROM "CallSession" ORDER BY "startTime" DESC LIMIT 10;

# Check jobs
SELECT * FROM "Job" WHERE status = 'FAILED';
```

### Monitor Jobs

Create cron job to check for failed jobs:

```bash
# In cPanel: Cron Jobs
# Add job: Every hour
0 * * * * cd ~/ai-voice-receptionist && node -e "const prisma = require('./dist/db/prisma').default; prisma.job.count({where:{status:'FAILED'}}).then(c => c > 0 && console.log('ALERT: ' + c + ' failed jobs'))"
```

## Common Issues & Solutions

### Issue: App won't start

**Solutions:**
1. Check logs: `tail -n 100 ~/logs/*.log`
2. Verify environment variables are set
3. Test database connection:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```
4. Ensure `app.js` exists in root
5. Rebuild: `npm run build`

### Issue: Twilio webhooks fail

**Solutions:**
1. Check BASE_URL in `.env` matches domain
2. Test webhook manually:
   ```bash
   curl -X POST https://receptionist.yourdomain.com/twilio/voice \
     -d "CallSid=TEST123" \
     -d "From=+15551234567" \
     -d "To=+15559876543"
   ```
3. Check Twilio webhook logs in console
4. Verify SSL certificate is valid

### Issue: Database connection fails

**Solutions:**
1. Verify credentials in `.env`
2. Check PostgreSQL is running:
   ```bash
   pg_isready
   ```
3. Test connection:
   ```bash
   npx prisma db pull
   ```
4. Grant user permissions:
   ```sql
   GRANT ALL PRIVILEGES ON DATABASE voice_receptionist TO voice_user;
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO voice_user;
   ```

### Issue: Emails not sending

**Solutions:**
1. Test SMTP credentials:
   ```bash
   node -e "
   const nodemailer = require('nodemailer');
   const t = nodemailer.createTransport({
     host: process.env.EMAIL_HOST,
     port: process.env.EMAIL_PORT,
     auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD }
   });
   t.verify().then(() => console.log('OK')).catch(console.error);
   "
   ```
2. Check firewall allows SMTP port
3. Verify email credentials
4. Try different SMTP provider (Gmail, SendGrid, etc.)

## Maintenance

### Update Application

```bash
cd ~/ai-voice-receptionist
# Backup first
tar -czf backup-$(date +%Y%m%d).tar.gz dist/ views/ public/

# Upload new files or git pull
# Then:
npm install
npm run build
touch tmp/restart.txt
```

### Database Backup

```bash
# Full backup
pg_dump voice_receptionist > backup-$(date +%Y%m%d).sql

# Restore
psql voice_receptionist < backup-20260208.sql
```

### Monitor Disk Space

```bash
df -h
du -sh ~/ai-voice-receptionist
```

## Performance Tuning

### Enable Production Optimizations

In `.env`:
```env
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=2048
```

### Database Connection Pool

Update `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  
  // Add connection pooling
  pool_size = 10
  connection_limit = 5
  connect_timeout = 10
}
```

### Process Management

Consider using PM2 for better process management:

```bash
npm install -g pm2
pm2 start app.js --name voice-receptionist
pm2 startup
pm2 save
```

## Support & Troubleshooting

For additional help:
1. Review application logs
2. Check Twilio debugger: https://console.twilio.com/debugger
3. Test OpenAI API key
4. Verify all environment variables are set
5. Ensure Node.js 18+ is being used

## Security Hardening

1. **Change default admin password immediately**
2. Use strong SESSION_SECRET (64+ characters)
3. Enable Twilio webhook validation
4. Configure firewall to restrict database access
5. Set up automated backups
6. Use environment-specific API keys
7. Enable rate limiting (add express-rate-limit)
8. Configure CORS properly
9. Keep dependencies updated: `npm audit fix`

---

🎉 **Deployment Complete!** Your AI Voice Receptionist is now live on cPanel.
