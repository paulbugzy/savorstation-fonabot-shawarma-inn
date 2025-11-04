# Deployment Guide

## Quick Start

### 1. Configure Environment

Copy `.env.example` to `.env` and fill in all required values:

```bash
cp .env.example .env
nano .env  # or use your preferred editor
```

**Critical environment variables to configure:**

- `PUBLIC_URL` - Your publi c HTTPS domain (e.g., `https://voice.shawarma-inn.com`)
- `BACKEND_BASE_URL` - Laravel API URL
- `BACKEND_EMAIL` and `BACKEND_PASSWORD` - Laravel service account credentials
- `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` - From Twilio console
- `DEEPGRAM_API_KEY` - From Deepgram dashboard
- `ELEVEN_API_KEY` and `ELEVEN_VOICE_ID` - From ElevenLabs
- `OPENAI_API_KEY` - From OpenAI
- `MIX_API_KEY` - For branch detection API
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` - From Supabase project

### 2. Run Locally (Development)

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The server will start on port 8080 (or PORT from .env).

### 3. Test the API Connection

```bash
# Run the dry-run script to test Laravel API integration
npm run dry-run
```

This will:
- Authenticate with Laravel
- Create/find a test customer
- Create a test address
- Fetch menu items
- Create a complete order through the POS API
- Print the order number

### 4. Run Tests

```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch
```

## Production Deployment

### Option 1: Docker Compose (Recommended)

```bash
# Build and start containers
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop containers
docker-compose down
```

The docker-compose setup includes:
- App container with Node.js application
- Redis container for caching/sessions
- Health checks and automatic restarts

### Option 2: Manual Deployment

```bash
# Build the application
npm run build

# Start production server
NODE_ENV=production npm start
```

### Option 3: Deploy to Cloud Platform

#### Heroku
```bash
heroku create savorstation-voice
heroku config:set NODE_ENV=production
heroku config:set PUBLIC_URL=https://savorstation-voice.herokuapp.com
# Set all other environment variables
git push heroku main
```

#### AWS EC2 / DigitalOcean
1. SSH into server
2. Install Node.js 20+
3. Clone repository
4. Run `npm install --production`
5. Set up environment variables
6. Use PM2 for process management:
   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name voice-agent
   pm2 save
   pm2 startup
   ```

#### Docker on Cloud
```bash
# Build image
docker build -t savorstation-voice .

# Run container
docker run -d \
  --name voice-agent \
  -p 8080:8080 \
  --env-file .env \
  savorstation-voice
```

## Twilio Configuration

### 1. Configure Voice Webhook

In Twilio Console:
1. Go to Phone Numbers → Manage → Active numbers
2. Click on your phone number
3. Under "Voice & Fax", set:
   - **A CALL COMES IN**: Webhook
   - **URL**: `https://your-domain.com/twilio/voice`
   - **HTTP Method**: POST

### 2. Configure Status Callback

In the same section:
- **Status Callback URL**: `https://your-domain.com/twilio/status`
- **HTTP Method**: POST

### 3. Test the Setup

Call your Twilio phone number. You should hear:
- Initial greeting
- AI agent asking about order type

## Monitoring & Maintenance

### Health Checks

```bash
# Check server health
curl https://your-domain.com/health

# Check readiness
curl https://your-domain.com/ready
```

### View Logs

```bash
# Docker Compose
docker-compose logs -f app

# PM2
pm2 logs voice-agent

# View raw logs
tail -f /path/to/logs/app.log
```

### Database Queries (Supabase)

Check call sessions:
```sql
SELECT
  call_sid,
  phone,
  status,
  order_serial_no,
  created_at
FROM call_sessions
ORDER BY created_at DESC
LIMIT 10;
```

Check recent successful orders:
```sql
SELECT
  call_sid,
  order_id,
  order_serial_no,
  status,
  created_at
FROM call_sessions
WHERE status = 'completed'
  AND order_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;
```

### Common Issues

**Issue**: Calls connect but no audio
- Check Twilio WebSocket URL in voice webhook
- Verify PUBLIC_URL matches your domain
- Ensure HTTPS is enabled

**Issue**: Authentication failures with Laravel
- Verify BACKEND_EMAIL and BACKEND_PASSWORD
- Check Laravel Sanctum is configured
- Test login endpoint directly

**Issue**: Branch detection fails
- Verify MIX_API_KEY is correct
- Check geocoding service is working
- Test branch API directly

**Issue**: Orders don't appear in AI Orders
- Verify AI_ORDER_SOURCE is set correctly
- Check Laravel backend logs
- Ensure `source` field is in request

## Scaling Considerations

### Horizontal Scaling

The application is stateless (sessions stored in Supabase), so you can run multiple instances:

```bash
# Docker Compose with replicas
docker-compose up --scale app=3
```

### Load Balancing

Use a load balancer (Nginx, HAProxy, ALB) to distribute calls:

```nginx
upstream voice_backend {
    least_conn;
    server app1:8080;
    server app2:8080;
    server app3:8080;
}

server {
    listen 443 ssl;
    server_name voice.shawarma-inn.com;

    location / {
        proxy_pass http://voice_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Performance Tuning

- Enable Redis for session caching (already configured in docker-compose)
- Use CDN for static assets (if any)
- Monitor response times and optimize AI agent prompts
- Consider voice latency optimizations

## Security Checklist

- [ ] All environment variables configured securely
- [ ] HTTPS enabled with valid SSL certificate
- [ ] Twilio webhook signature validation enabled
- [ ] Laravel API uses Sanctum token authentication
- [ ] PII (phone numbers) hashed in database
- [ ] No card numbers stored, only last 4 digits
- [ ] Logs configured to redact sensitive data
- [ ] Firewall rules configured (only ports 80/443 open)
- [ ] Regular security updates applied
- [ ] Backup strategy for Supabase database

## Backup & Recovery

### Supabase Backups

Supabase automatically backs up your database. To manually export:

```bash
# Export call sessions
npx supabase db dump -f backup.sql
```

### Application Backups

```bash
# Backup environment and configs
tar -czf backup-$(date +%Y%m%d).tar.gz .env docker-compose.yml

# Store in secure location
aws s3 cp backup-*.tar.gz s3://your-backup-bucket/
```

## Support

For issues or questions:
1. Check logs for errors
2. Review this deployment guide
3. Consult README.md for architecture details
4. Contact development team
