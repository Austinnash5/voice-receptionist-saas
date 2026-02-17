# Version History & Roadmap

## v1.0.0 - Voice-Only (STABLE BACKUP) - Feb 17, 2026

**Git Tag:** `v1.0.0-voice-only`  
**Branch:** `release/voice-only-v1.0.0`  
**Status:** ✅ Backed up and frozen - can be redeployed anytime

### Features:
- Multi-tenant AI voice receptionist
- Twilio voice integration  
- Flow builder with menu delays
- Custom lead collection with flexible fields
- Knowledge base with RAG
- Business hours scheduling
- Call analytics & reporting
- Lead CSV export
- Email notifications

### Database Models (9):
`Tenant`, `PhoneNumber`, `User`, `Call`, `CallMetadata`, `Lead`, `LeadField`, `BusinessHour`, `KnowledgeDocument`, `KnowledgeChunk`, `FAQ`, `FlowConfig`, `FlowStep`, `MenuOption`

---

## v2.0.0 - Marketing Suite (IN DEVELOPMENT)

**Target:** April-May 2026  
**Branch:** `main` (development)  
**Status:** 🚧 In progress

### Planned Features:

#### Phase 1: CRM Foundation (Weeks 1-3)
- [ ] Contact management (merge with Lead)
- [ ] Contact timeline (all interactions)
- [ ] Tags and segments
- [ ] Custom fields
- [ ] Notes and activities
- [ ] Deal pipeline

#### Phase 2: SMS Marketing (Weeks 4-6)
- [ ] SMS conversations (2-way messaging)
- [ ] SMS campaigns
- [ ] Drip sequences
- [ ] Templates with merge fields
- [ ] Unsubscribe handling
- [ ] SMS automation triggers

#### Phase 3: Email Marketing (Weeks 7-9)
- [ ] Email campaign builder
- [ ] WYSIWYG email editor
- [ ] List segmentation
- [ ] A/B testing
- [ ] Open/click tracking
- [ ] Email automation

#### Phase 4: AI Chatbot (Weeks 10-12)
- [ ] Chatbot configuration UI
- [ ] JavaScript widget generator
- [ ] WordPress plugin
- [ ] WebSocket real-time chat
- [ ] Chatbot analytics
- [ ] Live chat handoff

### New Database Models (Estimated):
- **CRM:** `Contact`, `ContactTag`, `ContactNote`, `ContactActivity`, `Deal`, `Task`
- **SMS:** `SmsMessage`, `SmsConversation`, `SmsCampaign`, `SmsCampaignRecipient`, `SmsTemplate`
- **Email:** `EmailMessage`, `EmailCampaign`, `EmailTemplate`, `EmailList`
- **Chatbot:** `ChatbotConfig`, `ChatConversation`, `ChatMessage`, `ChatbotTrainingData`

### Pricing Evolution:
- **v1.0 (Voice-Only):** $49-99/mo
- **v2.0 (Full Suite):** $199-499/mo

---

## Deployment Strategy

### Main Branch (main)
- Active development of v2.0
- New features added here
- Continuous integration/deployment to production

### Release Branch (release/voice-only-v1.0.0)
- Frozen state of v1.0
- No new features
- Only critical security patches if needed
- Available for separate deployment

### Use Cases:
1. **Continue on main:** Full suite development (default)
2. **Deploy from release branch:** Standalone voice product offering
3. **Create new branch from release:** White-label customizations

---

## Migration Strategy from v1.0 to v2.0

### Backward Compatible:
- All v1.0 features remain functional
- Existing tenants upgraded automatically
- Database migrations are additive (new tables)
- API endpoints unchanged (new ones added)

### Data Migration:
- `Lead` model → unified with or linked to `Contact`
- `Call` history preserved and appears in contact timeline
- `LeadField` becomes contact custom fields
- No data loss

### Rollback Plan:
- Can always redeploy v1.0 from release branch
- Database migrations can be rolled back
- Feature flags for gradual rollout

---

## Development Guidelines

### When Working on v2.0 (main branch):
```bash
git checkout main
# Make changes
# Test thoroughly
git add .
git commit -m "feat: add CRM contact management"
git push origin main
```

### When Bug Fixes Needed for v1.0:
```bash
git checkout release/voice-only-v1.0.0
# Fix critical bug
git add .
git commit -m "fix: security patch for voice handler"
git push origin release/voice-only-v1.0.0
# Tag as v1.0.1 if needed
```

### Creating New Releases:
```bash
# For major milestones
git tag -a v2.0.0-beta -m "Marketing Suite Beta"
git push origin v2.0.0-beta

# Create release branch when stable
git checkout -b release/marketing-suite-v2.0.0
git push origin release/marketing-suite-v2.0.0
```

---

## Architecture Differences

### v1.0 (Voice-Only):
- Single-channel (voice)
- Simple lead capture
- Minimal external dependencies
- ~15 database models
- ~8 main routes
- ~300KB codebase

### v2.0 (Full Suite):
- Multi-channel (voice, SMS, email, chat)
- Full CRM with pipeline
- Multiple integrations (Twilio SMS, SendGrid, Stripe)
- ~30-40 database models
- ~20+ main routes  
- ~800KB+ codebase

---

## Testing Matrix

### v1.0 Features (Must Always Work):
- [ ] Phone calls handled correctly
- [ ] Flows execute properly
- [ ] Menu delays work
- [ ] Lead capture functions
- [ ] Custom fields save correctly
- [ ] CSV export works
- [ ] Email notifications send
- [ ] Knowledge base searches
- [ ] Business hours respected

### v2.0 New Features (Test Before Release):
- [ ] Contact CRUD operations
- [ ] SMS send/receive
- [ ] Email campaigns
- [ ] Chatbot conversations
- [ ] Cross-channel timeline
- [ ] Automation triggers
- [ ] Integrations work

---

## Quick Reference Commands

### Deploy v1.0 Standalone:
```bash
git clone -b release/voice-only-v1.0.0 https://github.com/Austinnash5/voice-receptionist-saas.git
cd voice-receptionist-saas
npm install && npm run build && npm start
```

### Continue v2.0 Development:
```bash
git checkout main
git pull origin main
npm install
npm run dev
```

### Check Current Version:
```bash
git describe --tags --abbrev=0
git branch --show-current
```

---

**Last Updated:** February 17, 2026  
**Current Stage:** Ready to begin CRM integration  
**Blocked By:** None - backup complete, ready to proceed
