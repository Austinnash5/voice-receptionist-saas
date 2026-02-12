# AI Voice Receptionist SaaS

A production-ready, multi-tenant AI Voice Receptionist SaaS platform built with Node.js, TypeScript, Express, PostgreSQL, and Twilio Voice. Designed for deployment on cPanel.

## 🌟 Features

### Multi-Tenant Architecture
- Platform owner can create and manage multiple business accounts
- Complete tenant isolation with per-tenant configurations
- Each business has its own phone numbers, routing rules, and AI knowledge base

### AI Voice Receptionist
- Automated call answering with natural language processing
- Intelligent intent detection (sales, service, support, billing)
- Knowledge base integration for FAQ responses
- Deterministic state machine for consistent call flow
- Lead capture when human transfer is unavailable

### Call Management
- Real-time call handling via Twilio Voice webhooks
- Speech-to-text conversation processing
- Automatic call transfer to available staff
- Call recording and transcription
- AI-powered call summarization

### Background Job System
- In-process job queue (no Redis required)
- Email notifications for leads and call summaries
- Automatic retry on failure
- PostgreSQL-backed job persistence

### Admin Dashboard
- Super admin: Create tenants, assign numbers, configure platform
- Tenant admin: Manage receptionist scripts, view calls, track leads
- Real-time statistics and analytics
- Call transcript viewer

## 🏗️ Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Telephony**: Twilio Voice API
- **AI**: OpenAI GPT-4
- **Email**: Nodemailer (SMTP)
- **Views**: EJS templates
- **Session**: express-session (in-memory)

## 📋 Prerequisites

- Node.js 18.x or higher
- PostgreSQL 12.x or higher
- Twilio account with Voice API access
- OpenAI API key
- SMTP email service
- cPanel hosting with Node.js support

## 🚀 Installation

### 1. Clone and Install Dependencies

```bash
cd /home/yourusername/ai-voice-receptionist
npm install
```

### 2. Configure Environment

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
NODE_ENV=production
PORT=3000
BASE_URL=https://your-domain.com

DATABASE_URL=postgresql://user:password@localhost:5432/voice_receptionist

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token

OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4-turbo-preview

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=notifications@yourdomain.com
EMAIL_PASSWORD=your_password
EMAIL_FROM=AI Receptionist <notifications@yourdomain.com>

SESSION_SECRET=change_this_to_random_64_char_string

DEFAULT_ADMIN_EMAIL=admin@yourdomain.com
DEFAULT_ADMIN_PASSWORD=change_this_password
```

### 3. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy
```

### 4. Build Application

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder and copies views and public assets.

### 5. Start Application

```bash
npm start
```

The app will run on the port specified in `process.env.PORT` (default: 3000).

## 🔧 cPanel Deployment

### Step 1: Upload Files

1. Upload the entire project to your cPanel home directory:
   - `/home/yourusername/ai-voice-receptionist/`

2. Via cPanel File Manager or FTP, upload:
   - All source files
   - `package.json`
   - `.env` (configured with your credentials)

### Step 2: Create PostgreSQL Database

1. In cPanel, go to **PostgreSQL Databases**
2. Create a new database: `voice_receptionist`
3. Create a database user with password
4. Grant all privileges to the user
5. Note the connection string for `.env`

### Step 3: Setup Node.js App in cPanel

1. Go to **Setup Node.js App** in cPanel
2. Click **Create Application**
3. Configure:
   - **Node.js version**: 18.x or higher
   - **Application mode**: Production
   - **Application root**: `ai-voice-receptionist`
   - **Application URL**: Choose your domain/subdomain
   - **Application startup file**: `app.js`
   - **Passenger log file**: (optional, for debugging)

4. Click **Create**

### Step 4: Install Dependencies

After creating the app, cPanel shows a command to run. Copy and run it:

```bash
source /home/yourusername/nodevenv/ai-voice-receptionist/18/bin/activate
cd /home/yourusername/ai-voice-receptionist
npm install
```

### Step 5: Set Environment Variables

In the Node.js App section:
1. Click **Edit** on your application
2. Add each environment variable from your `.env` file
3. Save changes

### Step 6: Run Database Migrations

SSH into your server or use cPanel Terminal:

```bash
source /home/yourusername/nodevenv/ai-voice-receptionist/18/bin/activate
cd /home/yourusername/ai-voice-receptionist
npx prisma generate
npx prisma migrate deploy
```

### Step 7: Build and Start

```bash
npm run build
```

Then restart the application in cPanel Node.js App interface.

### Step 8: Configure Twilio Webhooks

1. Log in to [Twilio Console](https://console.twilio.com)
2. Go to **Phone Numbers** → **Manage** → **Active Numbers**
3. Click on your phone number
4. Under **Voice & Fax**, configure:
   - **A CALL COMES IN**: Webhook, `https://your-domain.com/twilio/voice`, HTTP POST
   - **CALL STATUS CHANGES**: `https://your-domain.com/twilio/call-status`, HTTP POST
5. Save

### Step 9: Test the System

1. Visit `https://your-domain.com`
2. Login with default admin credentials (from `.env`)
3. Create a tenant business
4. Assign a Twilio phone number to the tenant
5. Configure the receptionist settings
6. Call the phone number to test!

## 📞 Twilio Configuration

### Required Webhooks

| Webhook | URL | Method | Purpose |
|---------|-----|--------|---------|
| Voice | `/twilio/voice` | POST | Initial call handling |
| Gather | `/twilio/gather` | POST | Process speech input |
| Transfer Status | `/twilio/transfer-status` | POST | Handle transfer results |
| Call Status | `/twilio/call-status` | POST | Track call completion |
| Recording Status | `/twilio/recording-status` | POST | Save call recordings |

### Phone Number Setup

For each Twilio number:
1. Configure Voice webhook URL
2. Enable call recording (optional)
3. Set status callback URL
4. Assign to tenant in admin dashboard

## 🎯 Usage Guide

### Super Admin

1. **Create Tenants**: Add businesses that will use the AI receptionist
2. **Assign Phone Numbers**: Connect Twilio numbers to specific tenants
3. **Monitor Platform**: View overall statistics and system health

### Tenant Admin

1. **Configure Receptionist**:
   - Set greeting message
   - Define personality
   - Customize prompts

2. **Manage Knowledge Base**:
   - Add FAQs with answers
   - Set keywords for matching
   - Organize by category

3. **Setup Call Routing**:
   - Add transfer targets
   - Set priorities
   - Configure business hours

4. **Track Calls & Leads**:
   - View call history
   - Read transcripts
   - Manage captured leads

## 🔒 Security

- All passwords hashed with bcrypt
- Session-based authentication
- SQL injection protection via Prisma
- XSS protection with Helmet
- CSRF protection (recommended: add csurf middleware)
- Environment variables for secrets
- Twilio webhook signature validation (recommended to enable)

## 🐛 Troubleshooting

### App Won't Start

1. Check logs in cPanel: `/home/yourusername/logs/`
2. Verify `.env` file exists with correct values
3. Ensure database connection works: `psql -h localhost -U user -d database`
4. Check Node.js version: `node --version` (must be 18+)

### Database Connection Issues

```bash
# Test connection
psql $DATABASE_URL

# Check if migrations ran
npx prisma migrate status
```

### Twilio Webhooks Not Working

1. Verify BASE_URL in `.env` matches your domain
2. Check webhook URLs in Twilio console
3. Test webhook manually with curl:
   ```bash
   curl -X POST https://your-domain.com/health
   ```
4. Review Twilio debugger for webhook errors

### Jobs Not Processing

- Check job processor is running (should start with app)
- View job status in database:
  ```sql
  SELECT * FROM "Job" WHERE status = 'FAILED';
  ```

## 📊 Database Schema

Key models:
- **Tenant**: Business accounts
- **User**: Admin and tenant users
- **TwilioNumber**: Phone number assignments
- **CallSession**: Call records
- **Lead**: Captured lead information
- **Job**: Background job queue
- **KnowledgeBaseEntry**: FAQ database
- **TransferTarget**: Call routing destinations

## 🔄 Maintenance

### Database Backups

```bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

### Log Rotation

Configure log rotation in cPanel or use logrotate:

```
/home/yourusername/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 yourusername yourusername
}
```

### Update Application

```bash
cd /home/yourusername/ai-voice-receptionist
git pull  # or upload new files
npm install
npm run build
# Restart in cPanel Node.js App interface
```

## 📈 Scaling

- **Vertical**: Increase cPanel resources (RAM, CPU)
- **Database**: Use connection pooling, add replicas
- **Jobs**: If job queue grows, consider moving to Redis + Bull
- **Sessions**: Move to Redis for multi-server deployments

## 🤝 Support

For issues or questions:
1. Check application logs
2. Review Twilio debugger
3. Verify environment configuration
4. Test database connectivity

## 📄 License

MIT License - See LICENSE file for details

## 🎉 Credits

Built with:
- Express.js
- Prisma ORM
- Twilio Voice API
- OpenAI GPT-4
- TypeScript
