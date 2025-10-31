"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAISttService = void 0;
const openai_1 = __importDefault(require("openai"));
const env_1 = __importDefault(require("../config/env"));
const logger_1 = __importDefault(require("../utils/logger"));
const events_1 = require("events");
class OpenAISttService extends events_1.EventEmitter {
    openai;
    audioBuffer = [];
    isProcessing = false;
    processTimer = null;
    silenceTimer = null;
    PROCESS_INTERVAL_MS = 2000;
    SILENCE_THRESHOLD_MS = 1500;
    MIN_AUDIO_LENGTH = 4000;
    constructor() {
        super();
        this.openai = new openai_1.default({ apiKey: env_1.default.OPENAI_API_KEY });
    }
    async startTranscription() {
        try {
            logger_1.default.info('OpenAI STT service started');
            this.emit('ready');
            this.processTimer = setInterval(() => {
                this.processAudioBuffer();
            }, this.PROCESS_INTERVAL_MS);
        }
        catch (error) {
            logger_1.default.error({ error }, 'Failed to start OpenAI STT');
            throw error;
        }
    }
    sendAudio(audioData) {
        this.audioBuffer.push(audioData);
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
        }
        this.silenceTimer = setTimeout(() => {
            logger_1.default.debug('Utterance ended (silence detected)');
            this.emit('utteranceEnd');
        }, this.SILENCE_THRESHOLD_MS);
    }
    async processAudioBuffer() {
        if (this.isProcessing || this.audioBuffer.length === 0) {
            return;
        }
        const totalLength = this.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
        if (totalLength < this.MIN_AUDIO_LENGTH) {
            return;
        }
        this.isProcessing = true;
        const audioToProcess = Buffer.concat(this.audioBuffer);
        this.audioBuffer = [];
        try {
            const transcript = await this.transcribeAudio(audioToProcess);
            if (transcript && transcript.trim()) {
                logger_1.default.debug({ transcript }, 'Received transcript from OpenAI');
                this.emit('transcript', transcript);
            }
        }
        catch (error) {
            logger_1.default.error({ error }, 'OpenAI transcription error');
            this.emit('error', error);
        }
        finally {
            this.isProcessing = false;
        }
    }
    async transcribeAudio(audioBuffer) {
        try {
            const wavBuffer = this.convertMulawToWav(audioBuffer);
            const file = new File([wavBuffer], 'audio.wav', { type: 'audio/wav' });
            const transcription = await this.openai.audio.transcriptions.create({
                file: file,
                model: 'whisper-1',
                language: 'en',
                response_format: 'text',
            });
            return typeof transcription === 'string' ? transcription : '';
        }
        catch (error) {
            logger_1.default.error({ error }, 'Failed to transcribe audio with OpenAI');
            throw error;
        }
    }
    convertMulawToWav(mulawBuffer) {
        const mulawToLinear = (mulaw) => {
            mulaw = ~mulaw;
            const sign = mulaw & 0x80;
            const exponent = (mulaw >> 4) & 0x07;
            const mantissa = mulaw & 0x0f;
            let sample = (mantissa << 3) + 132;
            sample <<= exponent;
            sample -= 132;
            return sign ? -sample : sample;
        };
        const pcmData = Buffer.alloc(mulawBuffer.length * 2);
        for (let i = 0; i < mulawBuffer.length; i++) {
            const pcmSample = mulawToLinear(mulawBuffer[i]);
            pcmData.writeInt16LE(pcmSample, i * 2);
        }
        const wavHeader = Buffer.alloc(44);
        wavHeader.write('RIFF', 0);
        wavHeader.writeUInt32LE(36 + pcmData.length, 4);
        wavHeader.write('WAVE', 8);
        wavHeader.write('fmt ', 12);
        wavHeader.writeUInt32LE(16, 16);
        wavHeader.writeUInt16LE(1, 20);
        wavHeader.writeUInt16LE(1, 22);
        wavHeader.writeUInt32LE(8000, 24);
        wavHeader.writeUInt32LE(16000, 28);
        wavHeader.writeUInt16LE(2, 32);
        wavHeader.writeUInt16LE(16, 34);
        wavHeader.write('data', 36);
        wavHeader.writeUInt32LE(pcmData.length, 40);
        return Buffer.concat([wavHeader, pcmData]);
    }
    close() {
        if (this.processTimer) {
            clearInterval(this.processTimer);
            this.processTimer = null;
        }
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
        this.audioBuffer = [];
        this.isProcessing = false;
        logger_1.default.info('OpenAI STT service closed');
        this.emit('close');
    }
}
exports.OpenAISttService = OpenAISttService;
exports.default = OpenAISttService;
//# sourceMappingURL=openaiSttService.js.map