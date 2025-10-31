import { ElevenLabsClient, stream } from 'elevenlabs';
import env from '@/config/env';
import logger from '@/utils/logger';
import { Readable } from 'stream';

export class ElevenLabsService {
  private client: ElevenLabsClient;

  constructor() {
    this.client = new ElevenLabsClient({
      apiKey: env.ELEVEN_API_KEY,
    });
  }

  async generateSpeech(text: string): Promise<Buffer> {
    try {
      logger.debug({ textLength: text.length }, 'Generating speech');

      const audio = await this.client.generate({
        voice: env.ELEVEN_VOICE_ID,
        text,
        model_id: 'eleven_turbo_v2',
        output_format: 'ulaw_8000',
      });

      const chunks: Buffer[] = [];
      for await (const chunk of audio) {
        chunks.push(Buffer.from(chunk));
      }

      const audioBuffer = Buffer.concat(chunks);
      logger.debug({ size: audioBuffer.length }, 'Speech generated');

      return audioBuffer;
    } catch (error) {
      logger.error({ error, text }, 'Failed to generate speech');
      throw error;
    }
  }

  async streamSpeech(text: string): Promise<Readable> {
    try {
      logger.debug({ textLength: text.length }, 'Streaming speech');

      const audioStream = await this.client.generate({
        voice: env.ELEVEN_VOICE_ID,
        text,
        model_id: 'eleven_turbo_v2',
        output_format: 'ulaw_8000',
        stream: true,
      });

      const readable = new Readable({
        async read() {
          try {
            for await (const chunk of audioStream) {
              this.push(Buffer.from(chunk));
            }
            this.push(null);
          } catch (error) {
            this.destroy(error as Error);
          }
        },
      });

      return readable;
    } catch (error) {
      logger.error({ error, text }, 'Failed to stream speech');
      throw error;
    }
  }

  encodeToMulaw(pcmBuffer: Buffer): Buffer {
    const mulawBuffer = Buffer.alloc(pcmBuffer.length / 2);

    for (let i = 0, j = 0; i < pcmBuffer.length; i += 2, j++) {
      const sample = pcmBuffer.readInt16LE(i);
      mulawBuffer[j] = this.linearToMulaw(sample);
    }

    return mulawBuffer;
  }

  private linearToMulaw(sample: number): number {
    const BIAS = 0x84;
    const CLIP = 32635;

    let sign: number;
    let exponent: number;
    let mantissa: number;
    let mulawByte: number;

    sign = (sample >> 8) & 0x80;
    if (sign !== 0) sample = -sample;
    if (sample > CLIP) sample = CLIP;

    sample = sample + BIAS;
    exponent = Math.floor(Math.log2(sample) - 7);
    mantissa = (sample >> (exponent + 3)) & 0x0f;
    mulawByte = ~(sign | (exponent << 4) | mantissa);

    return mulawByte & 0xff;
  }
}

export default new ElevenLabsService();
