# Project Summary: SavorStation Voice Agent

## Overview

A complete, production-ready conversational AI voice ordering system that integrates with your Laravel POS backend. The system handles incoming phone calls, conducts natural conversations, collects order details, and creates orders that appear under "AI Orders" in your Laravel admin.

## ✅ What's Implemented

### Core Components

1. **Voice Call Orchestrator** (`src/services/voiceOrchestrator.ts`)
   - Manages entire call lifecycle from greeting to order completion
   - Coordinates between STT, AI agent, TTS, and backend API
   - Handles audio streaming to/from Twilio
   - Implements conversation state management

2. **AI Conversation Agent** (`src/services/aiAgent.ts`)
   - OpenAI GPT-4o integration with function/tool calling
   - Natural language understanding and response generation
   - Tool execution for customer management, menu queries, and order creation
   - Context-aware conversation flow

3. **Laravel API Client** (`src/services/laravelClient.ts`)
   - Sanctum authentication with automatic token refresh
   - Complete CRUD operations: customers, addresses, menu, orders
   - Retry logic with exponential backoff
   - Comprehensive error handling

4. **Session Management** (`src/services/sessionManager.ts`)
   - Supabase-backed persistent sessions
   - Conversation history tracking
   - Idempotency token management
   - Call status tracking (active, completed, failed, abandoned)

5. **Order Management** (`src/services/orderReducer.ts`, `src/services/orderValidator.ts`)
   - Redux-style state management for orders
   - Real-time total calculations
   - Required modifier validation
   - Item quantity and pricing validation

6. **Branch Detection** (`src/services/branchDetection.ts`)
   - Primary: Laravel API-based detection via `/api/frontend/branch/lat-long`
   - Fallback: Local point-in-polygon check with cached zones
   - Geocoding integration for address-to-coordinates conversion
   - Out-of-service-area handling

7. **Speech Processing**
   - **Deepgram** (`src/services/deepgramService.ts`): Real-time STT with utterance detection
   - **ElevenLabs** (`src/services/elevenlabsService.ts`): High-quality TTS with μ-law encoding

8. **Twilio Integration** (`src/routes/twilioRoutes.ts`)
   - Voice webhook handling
   - WebSocket media streaming
   - Signature validation
   - Status callbacks

## 📁 Project Structure

```
savorstation-voice-agent/
├── src/
│   ├── config/
│   │   └── env.ts                    # Environment validation with Zod
│   ├── types/
│   │   └── index.ts                  # TypeScript interfaces & enums
│   ├── utils/
│   │   └── logger.ts                 # Pino structured logging
│   ├── services/
│   │   ├── laravelClient.ts          # Laravel API integration
│   │   ├── sessionManager.ts         # Supabase session storage
│   │   ├── orderValidator.ts         # Order validation logic
│   │   ├── orderReducer.ts           # Order state management
│   │   ├── branchDetection.ts        # Branch/zone detection
│   │   ├── aiAgent.ts                # OpenAI GPT-4o agent
│   │   ├── deepgramService.ts        # Speech-to-text
│   │   ├── elevenlabsService.ts      # Text-to-speech
│   │   ├── voiceOrchestrator.ts      # Main call handler
│   │   └── __tests__/                # Unit tests
│   ├── routes/
│   │   ├── twilioRoutes.ts           # Twilio webhooks
│   │   └── healthRoutes.ts           # Health checks
│   ├── scripts/
│   │   └── dryRunCreatePosOrder.ts   # Test script
│   └── index.ts                       # Express server + WebSocket
├── supabase/
│   └── migrations/
│       └── 20251030175315_create_call_sessions_table.sql
├── Dockerfile                         # Multi-stage Docker build
├── docker-compose.yml                 # App + Redis setup
├── package.json                       # Dependencies & scripts
├── tsconfig.json                      # TypeScript config
├── jest.config.js                     # Test configuration
├── .env.example                       # Environment template
├── README.md                          # Architecture & usage
├── DEPLOYMENT.md                      # Deployment guide
└── PROJECT_SUMMARY.md                 # This file
```

## 🔄 Call Flow Implementation

1. **Incoming Call** → Twilio webhook → WebSocket connection
2. **Greeting** → "Would you like delivery, pickup, or dine-in?"
3. **Branch Selection**:
   - Pickup/Dine-in: "Chicago or Park Ridge?"
   - Delivery: "What's the delivery address?"
4. **Address Validation** (delivery only):
   - Geocode address
   - Call branch detection API
   - Handle out-of-service gracefully
5. **Customer Lookup/Creation**:
   - Search by phone
   - Create new customer if needed
   - Link delivery address
6. **Menu Selection**:
   - Fetch menu for selected branch
   - Help choose items
   - Validate required modifiers (e.g., protein selection)
   - Collect extras and special instructions
7. **Order Details**:
   - Ask about tips
   - Collect payment method (cash/card/mobile)
   - For card: collect last 4 digits only
8. **Confirmation**:
   - Read back total
   - Confirm order details
9. **Order Creation**:
   - Build POS order request
   - Check idempotency
   - Submit to `/api/pos` with `source = AI_ORDER_SOURCE`
   - Receive order ID and serial number
10. **Completion**:
    - "Your order number is X, total is $Y"
    - Thank customer
    - End call

## 🎯 Key Features

### Order Type Support
- **Delivery (5)**: Full address collection + branch detection
- **Pickup (10)**: Location selection (Chicago/Park Ridge)
- **Dine-In (20)**: Location selection (Chicago/Park Ridge)

### Branch Detection Logic
```
IF order_type == DELIVERY:
    1. Collect address from customer
    2. Geocode address → lat/lng
    3. Call GET /api/frontend/branch/lat-long
       Headers: x-api-key, Accept: application/json
    4. IF 200: Use returned branch_id
       IF 422 (out_of_service_area): Apologize, offer callback
       IF error: Fallback to local polygon check
ELSE IF order_type IN [PICKUP, DINE_IN]:
    1. Ask "Chicago or Park Ridge?"
    2. Map answer → branch_id (1 or 2)
```

### Payment Handling
- **Cash (1)**: Record `pos_received_amount`
- **Card (2)**: Store only last 4 digits in `pos_payment_note`
- **Mobile (3)**: Store transaction ref in `pos_payment_note`
- **Never** store full PAN/CVV

### Security Features
- Phone numbers hashed (SHA-256) before storage
- PII redaction in logs
- Twilio signature validation
- Laravel Sanctum token authentication
- HTTPS-only connections
- Idempotency tokens prevent duplicate orders
- Row Level Security on Supabase tables

## 📊 Database Schema

### call_sessions table
```sql
- id (uuid, PK)
- call_sid (text, unique)           # Twilio identifier
- phone (text)                      # Hashed phone number
- started_at (timestamptz)
- ended_at (timestamptz, nullable)
- idempotency_token (text, unique)  # Prevents duplicates
- order_type (int, nullable)        # 5/10/20
- branch_id (int, nullable)         # 1=Chicago, 2=Park Ridge
- customer_id (int, nullable)       # Laravel customer ID
- address_id (int, nullable)
- order_id (int, nullable)          # Created order ID
- order_serial_no (text, nullable)  # Order confirmation #
- session_data (jsonb)              # Full state snapshot
- conversation_history (jsonb)      # Message array
- status (text)                     # active/completed/failed/abandoned
- error_message (text, nullable)
- created_at, updated_at (timestamptz)
```

**Indexes**: call_sid, idempotency_token, phone, created_at

## 🧪 Testing

### Unit Tests
- `orderValidator.test.ts`: Validates items, totals, required modifiers
- `orderReducer.test.ts`: Tests state transitions and calculations

### Integration Test
```bash
npm run dry-run
```
Creates a complete test order:
1. Authenticates with Laravel
2. Creates/finds test customer
3. Creates delivery address
4. Fetches menu
5. Builds order with items
6. Submits to `/api/pos`
7. Prints order serial number

### Manual Testing Checklist
- [ ] Call Twilio number, hear greeting
- [ ] Test delivery order with valid address
- [ ] Test delivery with out-of-service address
- [ ] Test pickup order (choose Chicago)
- [ ] Test pickup order (choose Park Ridge)
- [ ] Test dine-in order
- [ ] Verify order appears in Laravel under "AI Orders"
- [ ] Check order has correct `source` value
- [ ] Verify payment methods (cash, card, mobile)
- [ ] Test conversation interruption/recovery
- [ ] Check Supabase has session records

## 🚀 Deployment Checklist

- [ ] Configure all `.env` variables
- [ ] Set up Twilio phone number and webhooks
- [ ] Deploy to server with HTTPS
- [ ] Configure domain and SSL certificate
- [ ] Update Twilio webhook URLs
- [ ] Test authentication with Laravel backend
- [ ] Verify Supabase connection
- [ ] Run dry-run script
- [ ] Make test call
- [ ] Monitor logs for errors
- [ ] Set up monitoring/alerts
- [ ] Configure backups

## 📦 Dependencies

### Production
- **express**: HTTP server
- **ws**: WebSocket support
- **twilio**: Voice webhooks & validation
- **openai**: GPT-4o conversation agent
- **@deepgram/sdk**: Speech-to-text
- **elevenlabs**: Text-to-speech
- **@supabase/supabase-js**: Database client
- **axios**: HTTP client for Laravel API
- **zod**: Environment validation
- **pino**: Structured logging
- **ioredis**: Redis client (optional)

### Development
- **typescript**: Type safety
- **tsx**: Development runner
- **jest**: Testing framework
- **eslint**: Code linting
- **prettier**: Code formatting

## 🔧 Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Compile TypeScript to JavaScript
npm start            # Run production server
npm test             # Run test suite
npm run dry-run      # Test POS order creation
npm run lint         # Lint TypeScript code
npm run format       # Format code with Prettier
```

## 📈 Monitoring & Observability

### Logs
All logs use structured JSON format (Pino):
- Call lifecycle events
- User transcripts
- Assistant responses
- Tool executions
- API requests/responses
- Errors with stack traces
- Performance metrics

### Metrics to Monitor
- Call duration (average, p95, p99)
- Order completion rate
- API response times
- Speech recognition accuracy
- TTS latency
- Error rates by type
- Branch detection success rate

### Health Endpoints
- `GET /health` - Full health check (tests Laravel connection)
- `GET /ready` - Readiness probe (server is running)

## 🎓 Learning Resources

For team members getting up to speed:

1. **Architecture**: Read `README.md` for system overview
2. **Deployment**: Follow `DEPLOYMENT.md` step-by-step
3. **Code Tour**: Start with `src/index.ts` → `voiceOrchestrator.ts` → `aiAgent.ts`
4. **Testing**: Run tests and dry-run script to see flow
5. **API Integration**: Review `laravelClient.ts` for backend calls

## 🔒 Security Best Practices

1. **Never log sensitive data**: Card numbers, CVVs, full addresses
2. **Hash PII**: Phone numbers hashed before Supabase storage
3. **Validate webhooks**: Twilio signature verification enabled
4. **Use HTTPS**: All production traffic encrypted
5. **Token rotation**: Laravel tokens auto-refresh
6. **Least privilege**: Supabase RLS limits data access
7. **Input validation**: Zod schemas validate all inputs
8. **Rate limiting**: Consider adding for production
9. **Audit trail**: All calls logged in Supabase

## 📞 Support & Maintenance

### Common Issues
1. **"No audio on call"**: Check WebSocket URL, verify HTTPS
2. **"Auth failed"**: Verify Laravel credentials, check Sanctum
3. **"Branch not detected"**: Check MIX_API_KEY, test API endpoint
4. **"Orders in wrong section"**: Verify AI_ORDER_SOURCE matches Laravel config

### Maintenance Tasks
- Review Supabase logs weekly
- Monitor API error rates
- Update AI agent prompts based on call quality
- Rotate API keys quarterly
- Update dependencies monthly
- Review and archive old call sessions

## 🎉 Success Criteria

The system is working correctly when:
- ✅ Calls connect and agent responds immediately
- ✅ Conversations feel natural and fluid
- ✅ Branch is correctly detected for delivery
- ✅ Orders appear under "AI Orders" in Laravel
- ✅ Order totals match itemized calculations
- ✅ Duplicate orders are prevented
- ✅ Payment information is securely handled
- ✅ Call sessions are logged in Supabase
- ✅ Error recovery is graceful

## 🚧 Future Enhancements

Potential improvements for v2:
- SMS order confirmation
- Email receipts
- Multi-language support
- Voice authentication
- Loyalty program integration
- Real-time order tracking updates
- Calendar integration for advance orders
- Payment processing (Stripe/Square)
- Analytics dashboard
- A/B testing for conversation flows

---

**Version**: 1.0.0
**Built**: October 2025
**Status**: Production Ready ✅
