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
        logger.error({ error }, 'Deepgram error');
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
