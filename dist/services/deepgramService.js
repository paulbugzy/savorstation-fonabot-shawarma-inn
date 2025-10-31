"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepgramService = void 0;
const sdk_1 = require("@deepgram/sdk");
const env_1 = __importDefault(require("../config/env"));
const logger_1 = __importDefault(require("../utils/logger"));
const events_1 = require("events");
class DeepgramService extends events_1.EventEmitter {
    deepgram;
    connection = null;
    constructor() {
        super();
        this.deepgram = (0, sdk_1.createClient)(env_1.default.DEEPGRAM_API_KEY);
    }
    async startTranscription() {
        try {
            this.connection = this.deepgram.listen.live({
                model: 'nova-2',
                language: 'en-US',
                smart_format: true,
                punctuate: true,
                interim_results: false,
                utterance_end_ms: 1000,
                vad_events: true,
                encoding: 'mulaw',
                sample_rate: 8000,
                channels: 1,
            });
            this.connection.on(sdk_1.LiveTranscriptionEvents.Open, () => {
                logger_1.default.info('Deepgram connection opened');
                this.emit('ready');
            });
            this.connection.on(sdk_1.LiveTranscriptionEvents.Transcript, (data) => {
                const transcript = data.channel?.alternatives?.[0]?.transcript;
                if (transcript && transcript.trim()) {
                    logger_1.default.debug({ transcript }, 'Received transcript');
                    this.emit('transcript', transcript);
                }
            });
            this.connection.on(sdk_1.LiveTranscriptionEvents.UtteranceEnd, () => {
                logger_1.default.debug('Utterance ended');
                this.emit('utteranceEnd');
            });
            this.connection.on(sdk_1.LiveTranscriptionEvents.Error, (error) => {
                logger_1.default.error({ error }, 'Deepgram error');
                this.emit('error', error);
            });
            this.connection.on(sdk_1.LiveTranscriptionEvents.Close, () => {
                logger_1.default.info('Deepgram connection closed');
                this.emit('close');
            });
        }
        catch (error) {
            logger_1.default.error({ error }, 'Failed to start Deepgram transcription');
            throw error;
        }
    }
    sendAudio(audioData) {
        if (this.connection) {
            this.connection.send(audioData);
        }
    }
    close() {
        if (this.connection) {
            this.connection.finish();
            this.connection = null;
        }
    }
}
exports.DeepgramService = DeepgramService;
exports.default = DeepgramService;
//# sourceMappingURL=deepgramService.js.map