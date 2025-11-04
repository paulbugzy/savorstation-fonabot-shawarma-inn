import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import env from '@/config/env';
import logger from '@/utils/logger';
import { EventEmitter } from 'events';

export class DeepgramService extends EventEmitter {
  private deepgram;
  private connection: any = null;

  constructor() {
    super();
    this.deepgram = createClient(env.DEEPGRAM_API_KEY);
  }

  async startTranscription(): Promise<void> {
    try {
      const hasApiKey = !!env.DEEPGRAM_API_KEY;
      const keyPrefix = env.DEEPGRAM_API_KEY?.substring(0, 10);
      logger.info({ hasApiKey, keyPrefix }, 'Starting Deepgram Flux connection');

      this.connection = (this.deepgram.listen as any).v2.live({
        model: 'flux-general-en',
        smart_format: true,
        punctuate: true,
        interim_results: false,
        encoding: 'mulaw',
        sample_rate: 8000,
        channels: 1,
      });

      this.connection.on(LiveTranscriptionEvents.Open, () => {
        logger.info('Deepgram connection opened');
        this.emit('ready');
      });

      this.connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        if (transcript && transcript.trim()) {
          logger.debug({ transcript }, 'Received transcript');
          this.emit('transcript', transcript);
        }
      });

      this.connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
        logger.debug('Utterance ended');
        this.emit('utteranceEnd');
      });

      this.connection.on(LiveTranscriptionEvents.Error, (error: any) => {
        logger.error({
          error,
          message: error?.message,
          type: error?.type,
          description: error?.description,
          code: error?.code
        }, 'Deepgram error');
        this.emit('error', error);
      });

      this.connection.on(LiveTranscriptionEvents.Close, () => {
        logger.info('Deepgram connection closed');
        this.emit('close');
      });
    } catch (error) {
      logger.error({ error }, 'Failed to start Deepgram transcription');
      throw error;
    }
  }

  sendAudio(audioData: Buffer): void {
    if (this.connection) {
      this.connection.send(audioData);
    }
  }

  close(): void {
    if (this.connection) {
      this.connection.finish();
      this.connection = null;
    }
  }
}

export default DeepgramService;
