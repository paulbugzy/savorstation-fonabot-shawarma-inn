import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import env from './config/env';
import logger from './utils/logger';
import twilioRoutes from './routes/twilioRoutes';
import healthRoutes from './routes/healthRoutes';
import VoiceOrchestrator from './services/voiceOrchestrator';
import laravelClient from './services/laravelClient';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/twilio/stream' });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  logger.info(
    {
      method: req.method,
      path: req.path,
      ip: req.ip,
    },
    'Incoming request'
  );
  next();
});

app.use('/', twilioRoutes);
app.use('/', healthRoutes);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({ error: err, path: req.path }, 'Unhandled error');
  res.status(500).json({
    error: 'Internal server error',
    message: env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

wss.on('connection', async (ws: WebSocket, req) => {
  const callSid = req.url?.split('=')[1] || 'unknown';
  logger.info({ callSid }, 'WebSocket connection established');

  let orchestrator: VoiceOrchestrator | null = null;

  ws.on('message', async (message: Buffer) => {
    try {
      const msg = JSON.parse(message.toString());

      if (msg.event === 'start') {
        const phone = msg.start.customParameters?.From || 'unknown';
        orchestrator = new VoiceOrchestrator(ws, msg.start.callSid);
        await orchestrator.start(phone);
      }

      if (orchestrator) {
        await orchestrator.handleTwilioEvent(msg);
      } else {
        logger.warn(
          { callSid, event: msg.event },
          'Received Twilio media event before start; ignoring'
        );
      }
    } catch (error) {
      logger.error({ error, callSid }, 'WebSocket message error');
    }
  });

  ws.on('close', () => {
    logger.info({ callSid }, 'WebSocket connection closed');
  });

  ws.on('error', (error) => {
    logger.error({ error, callSid }, 'WebSocket error');
  });
});

async function startServer() {
  try {
    await laravelClient.login();
    logger.info('Successfully authenticated with Laravel backend');

    server.listen(env.PORT, () => {
      logger.info(
        {
          port: env.PORT,
          env: env.NODE_ENV,
          publicUrl: env.PUBLIC_URL,
        },
        'Server started successfully'
      );
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

startServer();
