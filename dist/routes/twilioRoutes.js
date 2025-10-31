"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const twilio_1 = __importDefault(require("twilio"));
const env_1 = __importDefault(require("../config/env"));
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
const validateTwilioRequest = (req, res, next) => {
    const signature = req.headers['x-twilio-signature'];
    const url = `${env_1.default.PUBLIC_URL}${req.originalUrl}`;
    const isValid = twilio_1.default.validateRequest(env_1.default.TWILIO_AUTH_TOKEN, signature, url, req.body);
    if (!isValid && env_1.default.NODE_ENV === 'production') {
        logger_1.default.warn({ url }, 'Invalid Twilio signature');
        return res.status(403).send('Forbidden');
    }
    next();
};
router.post(env_1.default.TWILIO_VOICE_WEBHOOK_PATH, validateTwilioRequest, (req, res) => {
    const { CallSid, From, To } = req.body;
    logger_1.default.info({ callSid: CallSid, from: From, to: To }, 'Incoming call');
    const response = new twilio_1.default.twiml.VoiceResponse();
    response.say({
        voice: 'Polly.Joanna',
    }, 'Connecting you now, please wait.');
    const connect = response.connect();
    const stream = connect.stream({
        url: `wss://${env_1.default.PUBLIC_URL.replace(/^https?:\/\//, '')}/twilio/stream`,
    });
    const parameters = [
        ['CallSid', CallSid],
        ['From', From],
        ['To', To],
    ];
    parameters.forEach(([name, value]) => {
        if (value) {
            stream.parameter({ name, value });
        }
    });
    res.type('text/xml');
    res.send(response.toString());
});
router.post(env_1.default.TWILIO_STATUS_WEBHOOK_PATH, validateTwilioRequest, (req, res) => {
    const { CallSid, CallStatus } = req.body;
    logger_1.default.info({ callSid: CallSid, status: CallStatus }, 'Call status update');
    res.sendStatus(200);
});
exports.default = router;
//# sourceMappingURL=twilioRoutes.js.map