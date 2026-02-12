# Quick Start Guide

Get your AI Voice Receptionist running in 15 minutes.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL running
- Twilio account
- OpenAI API key

## 5-Step Setup

### 1. Install

```bash
git clone <repository>
cd ai-voice-receptionist
npm install
```

### 2. Configure

```bash
cp .env.example .env
nano .env
```

Minimum required:
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/voice_receptionist
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
OPENAI_API_KEY=sk-xxxx
BASE_URL=http://localhost:3000
SESSION_SECRET=random-64-char-string
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@email.com
EMAIL_PASSWORD=yourpassword
EMAIL_FROM=AI Receptionist <your@email.com>
DEFAULT_ADMIN_EMAIL=admin@test.com
DEFAULT_ADMIN_PASSWORD=admin123
```

### 3. Setup Database

```bash
npx prisma generate
npx prisma migrate deploy
```

### 4. Build & Run

```bash
npm run build
npm start
```

App runs at: http://localhost:3000

### 5. Configure Twilio

1. Go to Twilio Console → Phone Numbers
2. Select your number
3. Set Voice webhook: `http://your-domain.com/twilio/voice` (POST)
4. Set Status callback: `http://your-domain.com/twilio/call-status` (POST)
5. Save

## First Use

1. Visit http://localhost:3000
2. Login with admin credentials
3. Create a tenant business
4. Assign phone number
5. Configure receptionist in Settings
6. Call the number to test!

## Development Mode

```bash
npm run dev
```

Auto-reloads on code changes.

## Test Call Flow

1. Call your Twilio number
2. Hear greeting
3. Say: "What are your hours?"
4. AI responds from knowledge base
5. Say: "I want to speak to someone"
6. Gets transferred or captures lead info

## Common Issues

**Database connection failed**
- Check PostgreSQL is running
- Verify DATABASE_URL

**Twilio webhook 404**
- Check BASE_URL matches your domain
- Use ngrok for local testing: `ngrok http 3000`

**OpenAI errors**
- Verify API key
- Check quota/billing

## Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for cPanel setup.

## Architecture

```
Call Flow:
Twilio → /twilio/voice → AI Service → State Machine → Response → TwiML → Twilio

Components:
- Express server (src/server.ts)
- Twilio webhooks (src/controllers/twilioController.ts)
- AI logic (src/services/ai/)
- Job processor (src/services/jobs/)
- Dashboard (views/)
```

## Next Steps

1. Add business hours in tenant settings
2. Create knowledge base entries
3. Add transfer targets
4. Customize greeting message
5. Test various call scenarios

## Resources

- [Twilio Voice Docs](https://www.twilio.com/docs/voice)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Prisma Docs](https://www.prisma.io/docs)

## Support

Check:
- Application logs
- Twilio debugger
- Database records

Need help? Review the full [README.md](./README.md)
