# SavorStation Voice Agent

A production-ready conversational AI phone ordering system for SavorStation restaurant. This system uses voice AI to handle incoming calls, take orders, and create them in the Laravel POS system.

## Features

- **Natural Voice Conversations**: Uses OpenAI GPT-4o for intelligent dialog management
- **Real-time Speech Processing**: Deepgram for speech-to-text, ElevenLabs for text-to-speech
- **Order Type Support**: Delivery, Pickup, and Dine-In orders
- **Smart Branch Detection**: Automatic branch assignment for delivery orders based on address
- **Location Selection**: For pickup/dine-in, customers choose between Chicago or Park Ridge
- **Complete Order Management**: Item selection, modifiers, extras, tips, and payment
- **Secure Payment Handling**: Only stores last 4 digits of cards or transaction references
- **Idempotency**: Prevents duplicate orders with unique tokens
- **Session Persistence**: Stores call data in Supabase for audit and recovery

## Architecture

```
Incoming Call → Twilio → WebSocket → Voice Orchestrator
                                      ↓
                                   Deepgram (STT)
                                      ↓
                                   OpenAI GPT-4o
                                      ↓
                                   Laravel API
                                      ↓
                                   ElevenLabs (TTS)
                                      ↓
                                   Twilio (Audio Stream)
```

## Tech Stack

- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Express + WebSocket
- **AI/Voice**: OpenAI GPT-4o, Deepgram, ElevenLabs
- **Telephony**: Twilio Programmable Voice
- **Backend**: Laravel REST API (Sanctum auth)
- **Database**: Supabase (PostgreSQL)
- **Cache**: Redis (optional)
- **Deployment**: Docker + Docker Compose

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- Twilio account with phone number
- Deepgram API key
- ElevenLabs API key
- OpenAI API key
- Laravel backend running
- Supabase project

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd savorstation-voice-agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and fill in all required values:
   - Twilio credentials and webhook paths
   - Deepgram API key
   - ElevenLabs API key and voice ID
   - OpenAI API key
   - Laravel backend URL and credentials
   - Supabase URL and anon key
   - Redis URL (if using)
   - MIX_API_KEY for branch detection

4. **Run database migrations**

   The Supabase schema is already set up. Verify by checking the `call_sessions` table exists.

## Development

**Run in development mode**
```bash
npm run dev
```

**Run tests**
```bash
npm test
npm run test:watch
```

**Build for production**
```bash
npm run build
```

**Run dry-run script**
```bash
npm run dry-run
```

This will test creating a complete order through the Laravel API.

## Docker Deployment

1. **Build and start containers**
   ```bash
   docker-compose up -d
   ```

2. **View logs**
   ```bash
   docker-compose logs -f app
   ```

3. **Stop containers**
   ```bash
   docker-compose down
   ```

## Twilio Configuration

1. **Purchase a phone number** in your Twilio account

2. **Configure voice webhook**
   - Voice & Fax → Configure
   - A CALL COMES IN: Webhook
   - URL: `https://your-domain.com/twilio/voice`
   - Method: POST

3. **Configure status callback**
   - Status Callback URL: `https://your-domain.com/twilio/status`
   - Method: POST

## Call Flow

1. **Incoming Call**: Twilio receives call and opens WebSocket connection
2. **Greeting**: Agent greets customer and asks for order type
3. **Branch Selection**:
   - **Pickup/Dine-In**: Customer selects Chicago or Park Ridge
   - **Delivery**: Customer provides address, system detects branch
4. **Customer Info**: Collect name, phone, email (optional)
5. **Menu Selection**: Agent helps select items with required modifiers
6. **Extras & Instructions**: Collect additional items and special requests
7. **Tip**: Ask if customer wants to add a tip
8. **Payment**: Collect payment method (cash, card last 4, or mobile ref)
9. **Confirmation**: Read back total and order details
10. **Order Creation**: Submit to Laravel API with `source = AI_ORDER_SOURCE`
11. **Completion**: Provide order number and thank customer

## Order Types & Branch IDs

**Order Types** (from Laravel `OrderType` enum):
- `5` = DELIVERY
- `10` = TAKEAWAY (Pickup)
- `20` = DINING_TABLE (Dine-In)

**Branch IDs**:
- `1` = Chicago
- `2` = Park Ridge

**Payment Methods**:
- `1` = Cash
- `2` = Card (requires last 4 digits in `pos_payment_note`)
- `3` = Mobile Banking (requires transaction ref in `pos_payment_note`)
- `4` = Other

## Branch Detection for Delivery

The system uses two methods to detect which branch serves a delivery address:

1. **API Method** (Primary): Call Laravel endpoint `GET /api/frontend/branch/lat-long`
   - Geocode address to lat/lng
   - Send to API with `x-api-key` header
   - Returns matching branch or 422 if out of service area

2. **Local Fallback**: Cache branch polygons and run point-in-polygon check locally

## Security & Compliance

- **PCI Compliance**: Never logs or stores full card numbers
- **PII Protection**: Phone numbers are hashed in database
- **Twilio Signature Validation**: All webhooks validate signatures
- **HTTPS Only**: All connections use TLS
- **Idempotency**: Prevents duplicate orders with unique tokens
- **RLS**: Supabase Row Level Security enabled on all tables

## API Endpoints

- `POST /twilio/voice` - Twilio voice webhook (handles incoming calls)
- `POST /twilio/status` - Call status updates
- `WS /twilio/stream` - WebSocket for media streaming
- `GET /health` - Health check endpoint
- `GET /ready` - Readiness probe

## Environment Variables

See `.env.example` for all required variables. Key variables:

- `PUBLIC_URL`: Your public HTTPS URL
- `BACKEND_BASE_URL`: Laravel API base URL
- `AI_ORDER_SOURCE`: Source code for AI orders (default: 30)
- `TWILIO_*`: Twilio credentials
- `DEEPGRAM_API_KEY`: Deepgram API key
- `ELEVEN_API_KEY`: ElevenLabs API key
- `OPENAI_API_KEY`: OpenAI API key
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anon key

## Monitoring & Logs

All logs use structured JSON format with Pino logger. Logs include:
- Call events (start, end, status)
- Transcripts (user and assistant)
- Tool executions (API calls)
- Errors and warnings

Sensitive data (phone, email, card info) is automatically redacted.

## Testing

**Unit Tests**:
```bash
npm test
```

Tests cover:
- Order validation logic
- Order state reducer
- Total calculations
- Required modifier enforcement

**Integration Test**:
```bash
npm run dry-run
```

Creates a complete test order through the Laravel API.

## Troubleshooting

**Audio quality issues**:
- Check Twilio region settings
- Verify codec settings (μ-law, 8kHz)
- Monitor network latency

**Authentication failures**:
- Verify Laravel credentials
- Check token expiration
- Ensure Sanctum is configured

**Branch detection fails**:
- Verify MIX_API_KEY is correct
- Check geocoding service
- Validate zone polygons

**Orders not appearing in AI Orders**:
- Verify `AI_ORDER_SOURCE` is set correctly
- Check Laravel backend logs
- Ensure `source` field is sent in request

## License

MIT

## Support

For issues or questions, contact the development team or open an issue in the repository.
