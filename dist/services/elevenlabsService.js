"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElevenLabsService = void 0;
const elevenlabs_1 = require("elevenlabs");
const env_1 = __importDefault(require("../config/env"));
const logger_1 = __importDefault(require("../utils/logger"));
const stream_1 = require("stream");
class ElevenLabsService {
    client;
    constructor() {
        this.client = new elevenlabs_1.ElevenLabsClient({
            apiKey: env_1.default.ELEVEN_API_KEY,
        });
    }
    async generateSpeech(text) {
        try {
            logger_1.default.debug({ textLength: text.length }, 'Generating speech');
            const audio = await this.client.generate({
                voice: env_1.default.ELEVEN_VOICE_ID,
                text,
                model_id: 'eleven_turbo_v2',
                output_format: 'ulaw_8000',
            });
            const chunks = [];
            for await (const chunk of audio) {
                chunks.push(Buffer.from(chunk));
            }
            const audioBuffer = Buffer.concat(chunks);
            logger_1.default.debug({ size: audioBuffer.length }, 'Speech generated');
            return audioBuffer;
        }
        catch (error) {
            logger_1.default.error({ error, text }, 'Failed to generate speech');
            throw error;
        }
    }
    async streamSpeech(text) {
        try {
            logger_1.default.debug({ textLength: text.length }, 'Streaming speech');
            const audioStream = await this.client.generate({
                voice: env_1.default.ELEVEN_VOICE_ID,
                text,
                model_id: 'eleven_turbo_v2',
                output_format: 'ulaw_8000',
                stream: true,
            });
            const readable = new stream_1.Readable({
                async read() {
                    try {
                        for await (const chunk of audioStream) {
                            this.push(Buffer.from(chunk));
                        }
                        this.push(null);
                    }
                    catch (error) {
                        this.destroy(error);
                    }
                },
            });
            return readable;
        }
        catch (error) {
            logger_1.default.error({ error, text }, 'Failed to stream speech');
            throw error;
        }
    }
    encodeToMulaw(pcmBuffer) {
        const mulawBuffer = Buffer.alloc(pcmBuffer.length / 2);
        for (let i = 0, j = 0; i < pcmBuffer.length; i += 2, j++) {
            const sample = pcmBuffer.readInt16LE(i);
            mulawBuffer[j] = this.linearToMulaw(sample);
        }
        return mulawBuffer;
    }
    linearToMulaw(sample) {
        const BIAS = 0x84;
        const CLIP = 32635;
        let sign;
        let exponent;
        let mantissa;
        let mulawByte;
        sign = (sample >> 8) & 0x80;
        if (sign !== 0)
            sample = -sample;
        if (sample > CLIP)
            sample = CLIP;
        sample = sample + BIAS;
        exponent = Math.floor(Math.log2(sample) - 7);
        mantissa = (sample >> (exponent + 3)) & 0x0f;
        mulawByte = ~(sign | (exponent << 4) | mantissa);
        return mulawByte & 0xff;
    }
}
exports.ElevenLabsService = ElevenLabsService;
exports.default = new ElevenLabsService();
//# sourceMappingURL=elevenlabsService.js.map