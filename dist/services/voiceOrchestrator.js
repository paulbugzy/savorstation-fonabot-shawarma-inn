"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceOrchestrator = void 0;
const deepgramService_1 = __importDefault(require("./deepgramService"));
const openaiSttService_1 = __importDefault(require("./openaiSttService"));
const elevenlabsService_1 = __importDefault(require("./elevenlabsService"));
const aiAgent_1 = __importDefault(require("./aiAgent"));
const sessionManager_1 = __importDefault(require("./sessionManager"));
const laravelClient_1 = __importDefault(require("./laravelClient"));
const logger_1 = __importDefault(require("../utils/logger"));
const orderReducer_1 = require("./orderReducer");
const env_1 = __importDefault(require("../config/env"));
class VoiceOrchestrator {
    twilioWs;
    callSid;
    sttService;
    session = null;
    streamSid = null;
    transcriptBuffer = '';
    isSpeaking = false;
    utteranceTimeout = null;
    hasGreeted = false;
    sttReady = false;
    pendingAudio = [];
    updateStreamSid(possibleSid) {
        if (possibleSid && possibleSid !== this.streamSid) {
            this.streamSid = possibleSid;
            logger_1.default.info({ callSid: this.callSid, streamSid: this.streamSid }, 'Updated Twilio stream SID');
        }
    }
    constructor(twilioWs, callSid) {
        this.twilioWs = twilioWs;
        this.callSid = callSid;
        if (env_1.default.STT_PROVIDER === 'openai') {
            logger_1.default.info({ callSid }, 'Using OpenAI STT provider');
            this.sttService = new openaiSttService_1.default();
        }
        else {
            logger_1.default.info({ callSid }, 'Using Deepgram STT provider');
            this.sttService = new deepgramService_1.default();
        }
    }
    async start(phone) {
        try {
            this.session = await sessionManager_1.default.createSession(this.callSid, phone);
            await sessionManager_1.default.addConversationMessage(this.callSid, 'system', 'Call started');
            await this.sttService.startTranscription();
            this.sttService.on('transcript', (transcript) => {
                this.handleTranscript(transcript);
            });
            this.sttService.on('utteranceEnd', () => {
                this.handleUtteranceEnd();
            });
            this.sttService.on('ready', () => {
                this.sttReady = true;
                if (this.pendingAudio.length) {
                    logger_1.default.debug({ callSid: this.callSid, bufferedChunks: this.pendingAudio.length }, `Flushing buffered audio to ${env_1.default.STT_PROVIDER} STT`);
                }
                while (this.pendingAudio.length) {
                    const chunk = this.pendingAudio.shift();
                    if (chunk) {
                        this.sttService.sendAudio(chunk);
                    }
                }
            });
            this.sttService.on('close', () => {
                this.sttReady = false;
                this.pendingAudio = [];
            });
            this.sttService.on('error', (error) => {
                logger_1.default.error({
                    callSid: this.callSid,
                    error: error?.message ?? error,
                }, `${env_1.default.STT_PROVIDER} STT error`);
            });
            this.twilioWs.on('close', () => {
                this.handleCallEnd();
            });
            this.twilioWs.on('error', (error) => {
                logger_1.default.error({ error, callSid: this.callSid }, 'Twilio WebSocket error');
            });
        }
        catch (error) {
            logger_1.default.error({ error, callSid: this.callSid }, 'Failed to start voice orchestrator');
            throw error;
        }
    }
    async handleTwilioEvent(msg) {
        try {
            switch (msg.event) {
                case 'connected':
                    logger_1.default.info({ callSid: this.callSid }, 'Twilio media stream connected');
                    break;
                case 'start':
                    this.updateStreamSid(msg.streamSid ?? msg.start?.streamSid);
                    logger_1.default.info({ callSid: this.callSid, streamSid: this.streamSid }, 'Media stream started');
                    if (!this.hasGreeted && this.streamSid) {
                        const greeting = await this.generateGreeting();
                        await this.speak(greeting);
                        this.hasGreeted = true;
                    }
                    break;
                case 'media':
                    this.updateStreamSid(msg.streamSid);
                    if (msg.media?.payload) {
                        const audioBuffer = Buffer.from(msg.media.payload, 'base64');
                        if (this.sttReady) {
                            this.sttService.sendAudio(audioBuffer);
                        }
                        else {
                            this.pendingAudio.push(audioBuffer);
                        }
                    }
                    break;
                case 'stop':
                    logger_1.default.info({ callSid: this.callSid }, 'Media stream stopped');
                    await this.handleCallEnd();
                    break;
                default:
                    logger_1.default.debug({ event: msg.event }, 'Unhandled Twilio event');
            }
        }
        catch (error) {
            logger_1.default.error({ error }, 'Error handling Twilio message');
        }
    }
    handleTranscript(transcript) {
        if (this.isSpeaking) {
            return;
        }
        this.transcriptBuffer += ' ' + transcript;
        if (this.utteranceTimeout) {
            clearTimeout(this.utteranceTimeout);
        }
        this.utteranceTimeout = setTimeout(() => {
            this.processTranscript();
        }, 1500);
    }
    handleUtteranceEnd() {
        if (this.utteranceTimeout) {
            clearTimeout(this.utteranceTimeout);
        }
        if (this.transcriptBuffer.trim()) {
            this.processTranscript();
        }
    }
    async processTranscript() {
        const userMessage = this.transcriptBuffer.trim();
        this.transcriptBuffer = '';
        if (!userMessage || !this.session) {
            return;
        }
        logger_1.default.info({ callSid: this.callSid, userMessage }, 'Processing user message');
        await sessionManager_1.default.addConversationMessage(this.callSid, 'user', userMessage);
        try {
            const { response, updates } = await aiAgent_1.default.processUserInput(this.session, userMessage);
            for (const update of updates) {
                this.session = await this.applyUpdate(update);
            }
            await sessionManager_1.default.updateSession(this.callSid, this.session);
            await sessionManager_1.default.addConversationMessage(this.callSid, 'assistant', response);
            await this.speak(response);
            if (this.shouldCreateOrder()) {
                await this.createOrder();
            }
        }
        catch (error) {
            logger_1.default.error({ error, callSid: this.callSid }, 'Error processing transcript');
            await this.speak("I'm sorry, I encountered an error. Let me transfer you to someone who can help.");
        }
    }
    async applyUpdate(update) {
        if (!this.session) {
            throw new Error('No active session');
        }
        if (update && update.success === false) {
            logger_1.default.warn({ callSid: this.callSid, error: update.error }, 'Tool update indicated failure');
            return this.session;
        }
        if (update?.reducerUpdate) {
            return orderReducer_1.OrderReducer.reduce(this.session, update.reducerUpdate);
        }
        if (typeof update.orderType !== 'undefined') {
            return orderReducer_1.OrderReducer.reduce(this.session, {
                type: 'SET_ORDER_TYPE',
                payload: update.orderType,
            });
        }
        if (typeof update.branchId !== 'undefined') {
            return orderReducer_1.OrderReducer.reduce(this.session, {
                type: 'SET_BRANCH',
                payload: update.branchId,
            });
        }
        if (typeof update.customerId !== 'undefined') {
            return orderReducer_1.OrderReducer.reduce(this.session, {
                type: 'SET_CUSTOMER',
                payload: update.customerId,
            });
        }
        if (typeof update.addressId !== 'undefined') {
            return orderReducer_1.OrderReducer.reduce(this.session, {
                type: 'SET_ADDRESS',
                payload: update.addressId,
            });
        }
        return this.session;
    }
    shouldCreateOrder() {
        if (!this.session)
            return false;
        return !!(this.session.orderType &&
            this.session.branchId &&
            this.session.customerId &&
            this.session.items.length > 0 &&
            this.session.paymentMethod);
    }
    async createOrder() {
        if (!this.session) {
            throw new Error('No active session');
        }
        const isDuplicate = await sessionManager_1.default.checkIdempotency(this.session.idempotencyToken);
        if (isDuplicate) {
            logger_1.default.warn({ callSid: this.callSid }, 'Duplicate order prevented by idempotency');
            return;
        }
        try {
            const orderData = {
                token: this.session.idempotencyToken,
                customer_id: this.session.customerId,
                branch_id: this.session.branchId,
                subtotal: this.session.subtotal,
                discount: this.session.discount,
                delivery_charge: this.session.deliveryCharge,
                total: this.session.total,
                order_type: this.session.orderType,
                is_advance_order: 0,
                address_id: this.session.addressId,
                delivery_time: this.session.deliveryTime,
                coupon_id: null,
                source: parseInt(env_1.default.AI_ORDER_SOURCE),
                tip_amount: this.session.tipAmount,
                pos_payment_method: this.session.paymentMethod,
                pos_payment_note: this.session.paymentNote,
                pos_received_amount: this.session.receivedAmount,
                items: JSON.stringify(this.session.items),
            };
            const order = await laravelClient_1.default.createPosOrder(orderData);
            await sessionManager_1.default.completeSession(this.callSid, order.id, order.order_serial_no);
            const confirmationMessage = `Great! Your order has been placed successfully. Your order number is ${order.order_serial_no}. The total is $${order.total.toFixed(2)}. Thank you for choosing SavorStation!`;
            await this.speak(confirmationMessage);
            logger_1.default.info({ callSid: this.callSid, orderId: order.id, orderSerialNo: order.order_serial_no }, 'Order created successfully');
        }
        catch (error) {
            logger_1.default.error({ error, callSid: this.callSid }, 'Failed to create order');
            await sessionManager_1.default.failSession(this.callSid, error instanceof Error ? error.message : 'Unknown error');
            throw error;
        }
    }
    async speak(text) {
        if (!this.streamSid) {
            logger_1.default.warn('Cannot speak: no stream SID');
            return;
        }
        try {
            this.isSpeaking = true;
            const audioBuffer = await elevenlabsService_1.default.generateSpeech(text);
            const base64Audio = audioBuffer.toString('base64');
            const chunks = this.chunkAudio(base64Audio, 8192);
            for (const chunk of chunks) {
                const message = JSON.stringify({
                    event: 'media',
                    streamSid: this.streamSid,
                    media: {
                        payload: chunk,
                    },
                });
                this.twilioWs.send(message);
                await new Promise((resolve) => setTimeout(resolve, 20));
            }
            const markMessage = JSON.stringify({
                event: 'mark',
                streamSid: this.streamSid,
                mark: {
                    name: 'speech_end',
                },
            });
            this.twilioWs.send(markMessage);
            setTimeout(() => {
                this.isSpeaking = false;
            }, 500);
        }
        catch (error) {
            logger_1.default.error({ error }, 'Failed to speak');
            this.isSpeaking = false;
        }
    }
    chunkAudio(base64Audio, chunkSize) {
        const chunks = [];
        for (let i = 0; i < base64Audio.length; i += chunkSize) {
            chunks.push(base64Audio.slice(i, i + chunkSize));
        }
        return chunks;
    }
    async generateGreeting() {
        return "Hello! Thank you for calling SavorStation. I'm here to help you place an order. Would you like this for delivery, pickup, or dine-in?";
    }
    async handleCallEnd() {
        logger_1.default.info({ callSid: this.callSid }, 'Call ended');
        this.sttService.close();
        this.sttReady = false;
        this.pendingAudio = [];
        this.isSpeaking = false;
        if (this.session && this.session.items.length === 0) {
            await sessionManager_1.default.abandonSession(this.callSid);
        }
        if (this.utteranceTimeout) {
            clearTimeout(this.utteranceTimeout);
        }
    }
}
exports.VoiceOrchestrator = VoiceOrchestrator;
exports.default = VoiceOrchestrator;
//# sourceMappingURL=voiceOrchestrator.js.map