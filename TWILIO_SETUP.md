# Twilio Webhook Configuration Guide

Complete guide for configuring Twilio webhooks to work with your AI Voice Receptionist.

## Base Configuration

**Your Base URL**: `https://receptionist.yourdomain.com`

Replace this with your actual domain throughout this guide.

## Phone Number Configuration

### 1. Access Twilio Console

1. Log in to [Twilio Console](https://console.twilio.com)
2. Navigate to **Phone Numbers** → **Manage** → **Active Numbers**
3. Click on the phone number you want to configure

### 2. Voice & Fax Configuration

In the **Voice Configuration** section:

#### A Call Comes In

- **Type**: Webhook
- **URL**: `https://receptionist.yourdomain.com/twilio/voice`
- **Method**: HTTP POST
- **Fallback URL**: `https://receptionist.yourdomain.com/twilio/voice` (optional)
- **Fallback Method**: HTTP POST

#### Call Status Changes

- **Type**: Webhook
- **URL**: `https://receptionist.yourdomain.com/twilio/call-status`
- **Method**: HTTP POST

### 3. Recording Configuration (Optional)

If you want call recordings:

#### Record

- **Enable**: Check "Record"
- **When**: "Record from answer"
- **Recording Status Callback**: `https://receptionist.yourdomain.com/twilio/recording-status`
- **Method**: HTTP POST

### 4. Save Configuration

Click **Save** at the bottom of the page.

## Webhook Endpoints Reference

| Endpoint | Purpose | Trigger | Expected Response |
|----------|---------|---------|-------------------|
| `/twilio/voice` | Initial call handler | Incoming call | TwiML (greeting + gather) |
| `/twilio/gather` | Process speech input | User speaks during gather | TwiML (next action) |
| `/twilio/transfer-status` | Handle transfer results | After dial attempt | TwiML (continue or end) |
| `/twilio/call-status` | Track call state | Status changes | 200 OK (no TwiML) |
| `/twilio/recording-status` | Save recording info | Recording completed | 200 OK (no TwiML) |

## Testing Webhooks

### Method 1: Twilio Console Test

1. Go to **Phone Numbers** → your number
2. Click **Test** button next to each webhook
3. View response and debug any issues

### Method 2: Manual cURL Test

```bash
# Test voice webhook
curl -X POST https://receptionist.yourdomain.com/twilio/voice \
  -d "CallSid=TEST_CALL_SID_123" \
  -d "From=+15551234567" \
  -d "To=+15559876543" \
  -d "CallStatus=ringing" \
  -d "Direction=inbound"

# Should return TwiML response
```

### Method 3: Actual Call Test

1. Call your Twilio number
2. Listen for greeting
3. Speak when prompted
4. Check Twilio debugger for any errors

## Common Webhook Issues

### Issue: 404 Not Found

**Cause**: Webhook URL is incorrect or app is not running

**Solutions**:
1. Verify BASE_URL in `.env` matches your domain
2. Ensure application is running: check cPanel Node.js App
3. Test with: `curl https://receptionist.yourdomain.com/health`
4. Check domain DNS is pointing to cPanel server

### Issue: 500 Internal Server Error

**Cause**: Application error during webhook processing

**Solutions**:
1. Check application logs: `~/logs/*.log`
2. Verify database connection works
3. Check all environment variables are set
4. Review Twilio debugger for error details

### Issue: Timeout (11200 Error)

**Cause**: Webhook took too long to respond (> 10 seconds)

**Solutions**:
1. Optimize database queries
2. Check OpenAI API response times
3. Increase server resources
4. Review slow operations in logs

### Issue: Invalid TwiML Response

**Cause**: Application returned non-TwiML or malformed XML

**Solutions**:
1. Check TwiML generation code
2. Ensure Content-Type header is `text/xml`
3. Validate TwiML structure
4. Review Twilio debugger for specific error

## Webhook Security (Optional but Recommended)

### Enable Signature Validation

Add middleware to verify Twilio signatures:

```typescript
import twilio from 'twilio';

function validateTwilioSignature(req: Request, res: Response, next: NextFunction) {
  const signature = req.headers['x-twilio-signature'] as string;
  const url = `${process.env.BASE_URL}${req.originalUrl}`;
  
  const isValid = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    url,
    req.body
  );

  if (!isValid) {
    return res.status(403).send('Forbidden');
  }

  next();
}

// Apply to Twilio routes
router.use('/twilio', validateTwilioSignature);
```

## Debugging Webhooks

### Twilio Debugger

1. Go to [Twilio Console Debugger](https://console.twilio.com/monitor/debugger)
2. Filter by your phone number
3. Click on specific call
4. View all webhook requests and responses
5. Check for errors and response times

### Application Logs

```bash
# View recent logs
tail -n 100 ~/logs/receptionist.yourdomain.com.log

# Follow logs in real-time
tail -f ~/logs/receptionist.yourdomain.com.log

# Search for errors
grep -i error ~/logs/receptionist.yourdomain.com.log

# Search for specific call
grep "CALL_SID" ~/logs/receptionist.yourdomain.com.log
```

### Database Inspection

```sql
-- View recent calls
SELECT "callSid", "fromNumber", "status", "state", "startTime"
FROM "CallSession"
ORDER BY "startTime" DESC
LIMIT 10;

-- View call events
SELECT ce."eventType", ce."state", ce."timestamp", ce."data"
FROM "CallEvent" ce
JOIN "CallSession" cs ON cs.id = ce."callSessionId"
WHERE cs."callSid" = 'CA123...'
ORDER BY ce."timestamp" ASC;

-- View transcripts
SELECT cs."callSid", cs."fromNumber", t."fullText"
FROM "Transcript" t
JOIN "CallSession" cs ON cs.id = t."callSessionId"
ORDER BY cs."startTime" DESC
LIMIT 5;
```

## Local Development with ngrok

For testing webhooks locally:

### 1. Install ngrok

```bash
npm install -g ngrok
# or
brew install ngrok  # macOS
```

### 2. Start Application Locally

```bash
npm run dev
```

### 3. Create ngrok Tunnel

```bash
ngrok http 3000
```

### 4. Update Twilio Webhooks

Use the ngrok URL (e.g., `https://abc123.ngrok.io`) as your base URL:

- Voice: `https://abc123.ngrok.io/twilio/voice`
- Gather: `https://abc123.ngrok.io/twilio/gather`
- etc.

### 5. Update .env

```env
BASE_URL=https://abc123.ngrok.io
```

### 6. Test

Call your Twilio number and watch logs in your terminal.

## TwiML Examples

### Greeting with Gather

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="https://your-domain.com/twilio/gather" 
          method="POST" timeout="3" speechTimeout="auto" language="en-US">
    <Say voice="Polly.Joanna">
      Thank you for calling. How can I help you today?
    </Say>
  </Gather>
  <Say>I didn't hear anything. Let me try again.</Say>
  <Redirect>https://your-domain.com/twilio/gather</Redirect>
</Response>
```

### Transfer to Human

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Let me connect you with someone who can help.</Say>
  <Pause length="1"/>
  <Dial timeout="30" action="https://your-domain.com/twilio/transfer-status" 
        method="POST">
    +15551234567
  </Dial>
  <Say>I'm sorry, no one is available. May I take your information?</Say>
  <Redirect>https://your-domain.com/twilio/gather</Redirect>
</Response>
```

### End Call

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you for calling. Have a great day!</Say>
  <Pause length="1"/>
  <Hangup/>
</Response>
```

## Multiple Phone Numbers

To configure multiple phone numbers for different tenants:

1. Add each number in Twilio Console
2. Configure all webhooks to use the same base URLs
3. In admin dashboard, assign each number to a tenant
4. The app automatically routes calls based on the "To" number

Example:
- `+15551111111` → Tenant A
- `+15552222222` → Tenant B
- Both use same webhook: `https://receptionist.yourdomain.com/twilio/voice`
- App identifies tenant by looking up the "To" number in database

## Webhook Rate Limits

Twilio has no hard rate limits on webhooks, but be aware:

- Webhook timeout: 10 seconds (15s for voice)
- Retry policy: 8 attempts with exponential backoff
- Max TwiML size: 4KB

Optimize your webhook handlers to respond quickly (<2 seconds is ideal).

## Production Checklist

- [ ] All webhook URLs use HTTPS
- [ ] BASE_URL in .env matches production domain
- [ ] SSL certificate is valid
- [ ] Signature validation enabled (optional)
- [ ] Error handling implemented
- [ ] Logs configured and monitored
- [ ] Database connection pooling configured
- [ ] Twilio debugger notifications set up
- [ ] Test call completed successfully
- [ ] Fallback URLs configured (optional)

## Support Resources

- [Twilio Voice Documentation](https://www.twilio.com/docs/voice)
- [TwiML Reference](https://www.twilio.com/docs/voice/twiml)
- [Twilio Debugger](https://console.twilio.com/monitor/debugger)
- [Webhook Security](https://www.twilio.com/docs/usage/webhooks/webhooks-security)

---

For additional help, check application logs and Twilio debugger for detailed error information.
