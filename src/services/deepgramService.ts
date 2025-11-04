import env from '@/config/env';
import logger from '@/utils/logger';
import { EventEmitter } from 'events';
import WebSocket from 'ws';

export class DeepgramService extends EventEmitter {
  private connection: WebSocket | null = null;

  constructor() {
    super();
  }

  async startTranscription(): Promise<void> {
    try {
      const hasApiKey = !!env.DEEPGRAM_API_KEY;
      const keyPrefix = env.DEEPGRAM_API_KEY?.substring(0, 10);
      logger.info({ hasApiKey, keyPrefix }, 'Starting Deepgram Flux connection');

      const wsUrl = new URL('wss://api.deepgram.com/v2/listen');
      wsUrl.searchParams.set('model', 'flux-general-en');
      wsUrl.searchParams.set('encoding', 'mulaw');
      wsUrl.searchParams.set('sample_rate', '8000');

      logger.info({ url: wsUrl.toString() }, 'Connecting to Deepgram Flux');

      this.connection = new WebSocket(wsUrl.toString(), {
        headers: {
          'Authorization': `Token ${env.DEEPGRAM_API_KEY}`,
        },
      });

      this.connection.on('open', () => {
        logger.info('Deepgram Flux connection opened');
        this.emit('ready');
      });

      this.connection.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'TurnInfo') {
            if (message.event === 'EndOfTurn' && message.transcript && message.transcript.trim()) {
              const transcript = message.transcript;
              logger.info({ transcript, turnIndex: message.turn_index }, 'End of turn - emitting transcript');
              this.emit('transcript', transcript);
            }
          }
        } catch (err) {
          logger.error({ err, data: data.toString() }, 'Failed to parse Deepgram message');
        }
      });

      this.connection.on('error', (error: Error) => {
        logger.error({
          error,
          message: error.message,
        }, 'Deepgram Flux error');
        this.emit('error', error);
      });

      this.connection.on('close', (code: number, reason: Buffer) => {
        logger.info({ code, reason: reason.toString() }, 'Deepgram Flux connection closed');
        this.emit('close');
      });
    } catch (error) {
      logger.error({
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, 'Failed to start Deepgram transcription');
      throw error;
    }
  }

  sendAudio(audioData: Buffer): void {
    if (this.connection && this.connection.readyState === WebSocket.OPEN) {
      this.connection.send(audioData);
    } else {
      logger.warn({
        hasConnection: !!this.connection,
        readyState: this.connection?.readyState,
        expectedState: WebSocket.OPEN
      }, 'Cannot send audio - connection not ready');
    }
  }

  close(): void {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
  }
}

export default DeepgramService;
