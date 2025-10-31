import OpenAI from 'openai';
import env from '@/config/env';
import logger from '@/utils/logger';
import { EventEmitter } from 'events';
import { Readable } from 'stream';

export class OpenAISttService extends EventEmitter {
  private openai: OpenAI;
  private audioBuffer: Buffer[] = [];
  private isProcessing = false;
  private processTimer: NodeJS.Timeout | null = null;
  private silenceTimer: NodeJS.Timeout | null = null;
  private readonly PROCESS_INTERVAL_MS = 2000;
  private readonly SILENCE_THRESHOLD_MS = 1500;
  private readonly MIN_AUDIO_LENGTH = 4000;

  constructor() {
    super();
    this.openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  async startTranscription(): Promise<void> {
    try {
      logger.info('OpenAI STT service started');
      this.emit('ready');

      this.processTimer = setInterval(() => {
        this.processAudioBuffer();
      }, this.PROCESS_INTERVAL_MS);
    } catch (error) {
      logger.error({ error }, 'Failed to start OpenAI STT');
      throw error;
    }
  }

  sendAudio(audioData: Buffer): void {
    this.audioBuffer.push(audioData);

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }

    this.silenceTimer = setTimeout(() => {
      logger.debug('Utterance ended (silence detected)');
      this.emit('utteranceEnd');
    }, this.SILENCE_THRESHOLD_MS);
  }

  private async processAudioBuffer(): Promise<void> {
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
        logger.debug({ transcript }, 'Received transcript from OpenAI');
        this.emit('transcript', transcript);
      }
    } catch (error) {
      logger.error({ error }, 'OpenAI transcription error');
      this.emit('error', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async transcribeAudio(audioBuffer: Buffer): Promise<string> {
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
    } catch (error) {
      logger.error({ error }, 'Failed to transcribe audio with OpenAI');
      throw error;
    }
  }

  private convertMulawToWav(mulawBuffer: Buffer): Buffer {
    const mulawToLinear = (mulaw: number): number => {
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

  close(): void {
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
    logger.info('OpenAI STT service closed');
    this.emit('close');
  }
}

export default OpenAISttService;
