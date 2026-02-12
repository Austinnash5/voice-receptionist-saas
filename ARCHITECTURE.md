# AI Voice Receptionist - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         TWILIO CLOUD                         │
│  ┌──────────────┐                                            │
│  │ Phone Call   │──────────────────────────────────────────┐ │
│  └──────────────┘                                           │ │
└─────────────────────────────────────────────────────────────┼─┘
                                                              │
                         ▼ HTTP POST Webhooks                 │
                                                              │
┌─────────────────────────────────────────────────────────────┼─┐
│                    CPANEL NODE.JS SERVER                    │ │
│  ┌──────────────────────────────────────────────────────────▼┐│
│  │                    Express.js App                         ││
│  │  ┌────────────────────────────────────────────────────┐  ││
│  │  │         Twilio Webhook Controllers                 │  ││
│  │  │  /voice  /gather  /call-status  /transfer-status  │  ││
│  │  └───────────────────┬────────────────────────────────┘  ││
│  │                      │                                    ││
│  │                      ▼                                    ││
│  │  ┌────────────────────────────────────────────────────┐  ││
│  │  │              AI Service Layer                      │  ││
│  │  │  ┌──────────────────┐  ┌─────────────────────┐    │  ││
│  │  │  │  State Machine   │  │   Tool Functions    │    │  ││
│  │  │  │  (Call Flow)     │  │  (KB, Hours, Lead)  │    │  ││
│  │  │  └─────────┬────────┘  └─────────┬───────────┘    │  ││
│  │  │            │                      │                 │  ││
│  │  │            ▼                      │                 │  ││
│  │  │  ┌──────────────────────────────┐│                 │  ││
│  │  │  │   OpenAI GPT-4 Service       ││                 │  ││
│  │  │  └──────────────────────────────┘│                 │  ││
│  │  └────────────────┬────────────────┬─────────────────┘  ││
│  │                   │                │                     ││
│  │                   ▼                ▼                     ││
│  │  ┌────────────────────────────────────────────────────┐ ││
│  │  │           Business Logic Services                  │ ││
│  │  │  • CallService    • LeadService                   │ ││
│  │  │  • TwilioService  • KnowledgeService              │ ││
│  │  └────────────────────┬───────────────────────────────┘ ││
│  │                       │                                  ││
│  │                       ▼                                  ││
│  │  ┌────────────────────────────────────────────────────┐ ││
│  │  │           Prisma ORM (Database Layer)             │ ││
│  │  └────────────────────┬───────────────────────────────┘ ││
│  │                       │                                  ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │        Background Job Processor (In-Process)       │││
│  │  │  • Email Notifications  • Call Summarization       │││
│  │  │  • Lead Notifications   • Cleanup Tasks            │││
│  │  └─────────────────────────────────────────────────────┘││
│  │                                                           ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │              Web Dashboard (EJS Views)             │││
│  │  │  • Super Admin  • Tenant Admin  • Call Logs        │││
│  │  └─────────────────────────────────────────────────────┘││
│  └───────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┬─┘
                                                              │
                                    ▼                          │
┌─────────────────────────────────────────────────────────────┼─┐
│                      PostgreSQL Database                    │ │
│  ┌──────────────────────────────────────────────────────────▼┐│
│  │  Tables:                                                  ││
│  │  • Tenant          • CallSession      • KnowledgeBase    ││
│  │  • User            • Lead             • Job              ││
│  │  • TwilioNumber    • Transcript       • AuditLog         ││
│  │  • Department      • Recording                           ││
│  └───────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┬─┘
```

## Call Flow Sequence

```
1. Inbound Call
   Twilio → POST /twilio/voice
   ├─ Identify tenant by phone number
   ├─ Create CallSession record
   ├─ Load ReceptionistConfig
   └─ Return TwiML with greeting + Gather

2. User Speaks
   Twilio → POST /twilio/gather (SpeechResult)
   ├─ Build CallContext from database
   ├─ AI State Machine processes input
   │  ├─ State: GREETING → INTENT
   │  ├─ State: INTENT → FAQ or TRANSFER_ATTEMPT
   │  ├─ State: FAQ → continue conversation
   │  └─ State: LEAD_CAPTURE → collect info
   ├─ Generate AI response
   ├─ Save conversation turn to Transcript
   └─ Return TwiML:
      ├─ If gathering: <Gather> + <Say>
      ├─ If transfer: <Dial> + callback
      └─ If end: <Say> + <Hangup>

3. Transfer Attempt
   Twilio → Executes <Dial>
   Twilio → POST /twilio/transfer-status
   ├─ If connected: Mark success, end call
   └─ If failed: Go to LEAD_CAPTURE state

4. Call Completion
   Twilio → POST /twilio/call-status
   ├─ Update CallSession status
   ├─ Create background jobs:
   │  ├─ summarize_call
   │  └─ lead_notification (if lead captured)
   └─ Jobs processed by JobProcessor

5. Background Processing
   JobProcessor (polls every 5s)
   ├─ Process summarize_call job:
   │  ├─ Get transcript
   │  ├─ Call OpenAI summarization
   │  ├─ Save CallSummary
   │  └─ Email summary to tenant
   └─ Process lead_notification job:
      ├─ Get lead details
      └─ Email notification to tenant admin
```

## State Machine Flow

```
┌─────────────┐
│   GREETING  │ Initial greeting message
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    INTENT   │ Identify caller's need
└──────┬──────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌─────────────┐   ┌──────────────────┐
│     FAQ     │   │ TRANSFER_ATTEMPT │ Try to connect
└──────┬──────┘   └────────┬─────────┘
       │                   │
       │ If can't          │ If failed/closed
       │ answer            │
       │                   │
       └───────┬───────────┘
               │
               ▼
       ┌──────────────┐
       │ LEAD_CAPTURE │ Collect contact info
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │ CONFIRMATION │ Verify captured data
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │   WRAP_UP    │ Closing message
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │    ENDED     │ Call complete
       └──────────────┘
```

## Multi-Tenant Isolation

Every database table includes `tenantId` for isolation:

```sql
-- All queries automatically filtered by tenant
SELECT * FROM "CallSession" WHERE "tenantId" = '<tenant-id>';

-- Relationships enforce tenant boundary
TwilioNumber → Tenant (CASCADE DELETE)
CallSession → TwilioNumber → Tenant
Lead → Tenant
KnowledgeBaseEntry → Tenant
```

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Language**: TypeScript (compiled to JavaScript)
- **Framework**: Express.js 4.x
- **Database**: PostgreSQL 12+ via Prisma ORM
- **Telephony**: Twilio Voice API (webhooks)
- **AI**: OpenAI GPT-4 Turbo
- **Email**: Nodemailer (SMTP)
- **Authentication**: express-session + bcrypt

### Frontend
- **Templating**: EJS (Embedded JavaScript)
- **CSS**: Custom CSS (responsive design)
- **JavaScript**: Vanilla JS (no framework)

### Infrastructure
- **Hosting**: cPanel Node.js App
- **Process Manager**: cPanel Passenger
- **Reverse Proxy**: Apache/Nginx (cPanel managed)
- **SSL**: Let's Encrypt (cPanel AutoSSL)

## Key Design Decisions

### 1. No Redis Required
- **Background Jobs**: PostgreSQL-backed queue with in-process worker
- **Sessions**: In-memory (express-session default)
- **Rationale**: Simplifies cPanel deployment

### 2. No Docker
- **Deployment**: Direct Node.js execution via cPanel
- **Rationale**: cPanel doesn't require containers, simpler setup

### 3. In-Process Job Queue
- **Implementation**: PostgreSQL Job table + polling worker
- **Polling Interval**: 5 seconds
- **Rationale**: Sufficient for SaaS scale, no extra infrastructure

### 4. TwiML-based Voice (Not Real-Time)
- **Method**: Twilio <Gather> + webhooks for turn-by-turn
- **Future**: Can upgrade to Media Streams for real-time
- **Rationale**: Simpler implementation, lower latency requirements

### 5. Single Node Process
- **Scalability**: Vertical scaling on cPanel
- **Future**: Can add clustering if needed
- **Rationale**: Most cPanel deployments run single process

## Security Considerations

1. **Password Hashing**: bcrypt with salt rounds
2. **Session Security**: httpOnly cookies, signed sessions
3. **SQL Injection**: Prevented by Prisma ORM
4. **XSS Protection**: Helmet middleware
5. **Environment Secrets**: All sensitive data in .env
6. **Tenant Isolation**: Database-level with tenantId checks
7. **Twilio Validation**: Webhook signature validation (recommended to enable)

## Performance Optimizations

1. **Database Indexing**: 
   - All foreign keys indexed
   - Common query fields (slug, email, callSid) indexed

2. **Connection Pooling**: 
   - Prisma manages connection pool
   - Configurable pool size

3. **Async Processing**: 
   - Heavy tasks (summarization, emails) offloaded to jobs
   - Non-blocking I/O throughout

4. **Caching Strategy**:
   - Tenant configs cached per request
   - Knowledge base loaded once per call

## Monitoring & Observability

1. **Logs**: 
   - Application logs via console.log
   - cPanel Passenger logs
   - Twilio webhook debugger

2. **Metrics** (to implement):
   - Call duration averages
   - Lead conversion rates
   - Transfer success rates
   - Job processing times

3. **Alerts** (to implement):
   - Failed job threshold
   - Database connection issues
   - Email delivery failures

## Scaling Strategy

### Phase 1: Single Server (Current)
- cPanel Node.js App
- PostgreSQL on same server
- In-process jobs

### Phase 2: Vertical Scaling
- Increase cPanel resources (RAM, CPU)
- Optimize database queries
- Add database connection pooling

### Phase 3: Horizontal Scaling
- Move jobs to Redis + Bull
- Add load balancer
- Database read replicas
- Session storage in Redis
- Consider microservices split

## Future Enhancements

1. **Real-Time Voice**: Migrate to Twilio Media Streams
2. **Advanced AI**: Custom fine-tuned models per tenant
3. **Analytics Dashboard**: Charts, graphs, insights
4. **CRM Integration**: Salesforce, HubSpot, etc.
5. **SMS Support**: Text message conversations
6. **Multi-Language**: i18n support
7. **Voice Cloning**: Custom voice per business
8. **Appointment Scheduling**: Calendar integration
9. **Payment Processing**: Take payments over phone
10. **Advanced Routing**: Skill-based, round-robin, IVR

---

This architecture is designed for production deployment on cPanel while maintaining scalability and maintainability for future growth.
