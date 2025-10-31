"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const ws_1 = require("ws");
const env_1 = __importDefault(require("./config/env"));
const logger_1 = __importDefault(require("./utils/logger"));
const twilioRoutes_1 = __importDefault(require("./routes/twilioRoutes"));
const healthRoutes_1 = __importDefault(require("./routes/healthRoutes"));
const voiceOrchestrator_1 = __importDefault(require("./services/voiceOrchestrator"));
const laravelClient_1 = __importDefault(require("./services/laravelClient"));
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const wss = new ws_1.WebSocketServer({ server, path: '/twilio/stream' });
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((req, res, next) => {
    logger_1.default.info({
        method: req.method,
        path: req.path,
        ip: req.ip,
    }, 'Incoming request');
    next();
});
app.use('/', twilioRoutes_1.default);
app.use('/', healthRoutes_1.default);
app.use((err, req, res, next) => {
    logger_1.default.error({ error: err, path: req.path }, 'Unhandled error');
    res.status(500).json({
        error: 'Internal server error',
        message: env_1.default.NODE_ENV === 'development' ? err.message : undefined,
    });
});
wss.on('connection', async (ws, req) => {
    const callSid = req.url?.split('=')[1] || 'unknown';
    logger_1.default.info({ callSid }, 'WebSocket connection established');
    let orchestrator = null;
    ws.on('message', async (message) => {
        try {
            const msg = JSON.parse(message.toString());
            if (msg.event === 'start') {
                const phone = msg.start.customParameters?.From || 'unknown';
                orchestrator = new voiceOrchestrator_1.default(ws, msg.start.callSid);
                await orchestrator.start(phone);
            }
            if (orchestrator) {
                await orchestrator.handleTwilioEvent(msg);
            }
            else {
                logger_1.default.warn({ callSid, event: msg.event }, 'Received Twilio media event before start; ignoring');
            }
        }
        catch (error) {
            logger_1.default.error({ error, callSid }, 'WebSocket message error');
        }
    });
    ws.on('close', () => {
        logger_1.default.info({ callSid }, 'WebSocket connection closed');
    });
    ws.on('error', (error) => {
        logger_1.default.error({ error, callSid }, 'WebSocket error');
    });
});
async function startServer() {
    try {
        await laravelClient_1.default.login();
        logger_1.default.info('Successfully authenticated with Laravel backend');
        server.listen(env_1.default.PORT, () => {
            logger_1.default.info({
                port: env_1.default.PORT,
                env: env_1.default.NODE_ENV,
                publicUrl: env_1.default.PUBLIC_URL,
            }, 'Server started successfully');
        });
    }
    catch (error) {
        logger_1.default.error({ error }, 'Failed to start server');
        process.exit(1);
    }
}
process.on('SIGTERM', () => {
    logger_1.default.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger_1.default.info('Server closed');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    logger_1.default.info('SIGINT received, shutting down gracefully');
    server.close(() => {
        logger_1.default.info('Server closed');
        process.exit(0);
    });
});
startServer();
//# sourceMappingURL=index.js.map