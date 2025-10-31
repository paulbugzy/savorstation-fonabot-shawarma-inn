import { WebSocket } from 'ws';
import DeepgramService from './deepgramService';
import elevenlabsService from './elevenlabsService';
import aiAgent from './aiAgent';
import sessionManager from './sessionManager';
import laravelClient from './laravelClient';
import logger from '@/utils/logger';
import { CallSession, OrderType, PosPaymentMethod } from '@/types';
import { OrderReducer } from './orderReducer';
import env from '@/config/env';

export class VoiceOrchestrator {
  private twilioWs: WebSocket;
  private callSid: string;
  private deepgram: DeepgramService;
  private session: CallSession | null = null;
  private streamSid: string | null = null;
  private transcriptBuffer: string = '';
  private isSpeaking: boolean = false;
  private utteranceTimeout: NodeJS.Timeout | null = null;
  private hasGreeted: boolean = false;
  private deepgramReady: boolean = false;
  private pendingAudio: Buffer[] = [];

  private updateStreamSid(possibleSid: string | undefined): void {
    if (possibleSid && possibleSid !== this.streamSid) {
      this.streamSid = possibleSid;
      logger.info({ callSid: this.callSid, streamSid: this.streamSid }, 'Updated Twilio stream SID');
    }
  }

  constructor(twilioWs: WebSocket, callSid: string) {
    this.twilioWs = twilioWs;
    this.callSid = callSid;
    this.deepgram = new DeepgramService();
  }

  async start(phone: string): Promise<void> {
    try {
      this.session = await sessionManager.createSession(this.callSid, phone);
      await sessionManager.addConversationMessage(
        this.callSid,
        'system',
        'Call started'
      );

      await this.deepgram.startTranscription();

      this.deepgram.on('transcript', (transcript: string) => {
        this.handleTranscript(transcript);
      });

      this.deepgram.on('utteranceEnd', () => {
        this.handleUtteranceEnd();
      });

      this.deepgram.on('ready', () => {
        this.deepgramReady = true;
        if (this.pendingAudio.length) {
          logger.debug(
            { callSid: this.callSid, bufferedChunks: this.pendingAudio.length },
            'Flushing buffered audio to Deepgram'
          );
        }
        while (this.pendingAudio.length) {
          const chunk = this.pendingAudio.shift();
          if (chunk) {
            this.deepgram.sendAudio(chunk);
          }
        }
      });

      this.deepgram.on('close', () => {
        this.deepgramReady = false;
        this.pendingAudio = [];
      });

      this.deepgram.on('error', (error: any) => {
        logger.error(
          {
            callSid: this.callSid,
            error: error?.message ?? error,
          },
          'Deepgram error'
        );
      });

      this.twilioWs.on('close', () => {
        this.handleCallEnd();
      });

      this.twilioWs.on('error', (error) => {
        logger.error({ error, callSid: this.callSid }, 'Twilio WebSocket error');
      });
    } catch (error) {
      logger.error({ error, callSid: this.callSid }, 'Failed to start voice orchestrator');
      throw error;
    }
  }

  async handleTwilioEvent(msg: any): Promise<void> {
    try {
      switch (msg.event) {
        case 'connected':
          logger.info({ callSid: this.callSid }, 'Twilio media stream connected');
          break;

        case 'start':
          this.updateStreamSid(msg.streamSid ?? msg.start?.streamSid);
          logger.info(
            { callSid: this.callSid, streamSid: this.streamSid },
            'Media stream started'
          );
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
            if (this.deepgramReady) {
              this.deepgram.sendAudio(audioBuffer);
            } else {
              this.pendingAudio.push(audioBuffer);
            }
          }
          break;

        case 'stop':
          logger.info({ callSid: this.callSid }, 'Media stream stopped');
          await this.handleCallEnd();
          break;

        default:
          logger.debug({ event: msg.event }, 'Unhandled Twilio event');
      }
    } catch (error) {
      logger.error({ error }, 'Error handling Twilio message');
    }
  }

  private handleTranscript(transcript: string): void {
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

  private handleUtteranceEnd(): void {
    if (this.utteranceTimeout) {
      clearTimeout(this.utteranceTimeout);
    }

    if (this.transcriptBuffer.trim()) {
      this.processTranscript();
    }
  }

  private async processTranscript(): Promise<void> {
    const userMessage = this.transcriptBuffer.trim();
    this.transcriptBuffer = '';

    if (!userMessage || !this.session) {
      return;
    }

    logger.info({ callSid: this.callSid, userMessage }, 'Processing user message');

    await sessionManager.addConversationMessage(this.callSid, 'user', userMessage);

    try {
      const { response, updates } = await aiAgent.processUserInput(
        this.session,
        userMessage
      );

      for (const update of updates) {
        this.session = await this.applyUpdate(update);
      }

      await sessionManager.updateSession(this.callSid, this.session);
      await sessionManager.addConversationMessage(this.callSid, 'assistant', response);

      await this.speak(response);

      if (this.shouldCreateOrder()) {
        await this.createOrder();
      }
    } catch (error) {
      logger.error({ error, callSid: this.callSid }, 'Error processing transcript');
      await this.speak(
        "I'm sorry, I encountered an error. Let me transfer you to someone who can help."
      );
    }
  }

  private async applyUpdate(update: any): Promise<CallSession> {
    if (!this.session) {
      throw new Error('No active session');
    }

    if (update && update.success === false) {
      logger.warn(
        { callSid: this.callSid, error: update.error },
        'Tool update indicated failure'
      );
      return this.session;
    }

    if (update?.reducerUpdate) {
      return OrderReducer.reduce(this.session, update.reducerUpdate);
    }

    if (typeof update.orderType !== 'undefined') {
      return OrderReducer.reduce(this.session, {
        type: 'SET_ORDER_TYPE',
        payload: update.orderType,
      });
    }

    if (typeof update.branchId !== 'undefined') {
      return OrderReducer.reduce(this.session, {
        type: 'SET_BRANCH',
        payload: update.branchId,
      });
    }

    if (typeof update.customerId !== 'undefined') {
      return OrderReducer.reduce(this.session, {
        type: 'SET_CUSTOMER',
        payload: update.customerId,
      });
    }

    if (typeof update.addressId !== 'undefined') {
      return OrderReducer.reduce(this.session, {
        type: 'SET_ADDRESS',
        payload: update.addressId,
      });
    }

    return this.session;
  }

  private shouldCreateOrder(): boolean {
    if (!this.session) return false;

    return !!(
      this.session.orderType &&
      this.session.branchId &&
      this.session.customerId &&
      this.session.items.length > 0 &&
      this.session.paymentMethod
    );
  }

  private async createOrder(): Promise<void> {
    if (!this.session) {
      throw new Error('No active session');
    }

    const isDuplicate = await sessionManager.checkIdempotency(
      this.session.idempotencyToken
    );

    if (isDuplicate) {
      logger.warn({ callSid: this.callSid }, 'Duplicate order prevented by idempotency');
      return;
    }

    try {
      const orderData = {
        token: this.session.idempotencyToken,
        customer_id: this.session.customerId!,
        branch_id: this.session.branchId!,
        subtotal: this.session.subtotal,
        discount: this.session.discount,
        delivery_charge: this.session.deliveryCharge,
        total: this.session.total,
        order_type: this.session.orderType!,
        is_advance_order: 0 as 0 | 1,
        address_id: this.session.addressId,
        delivery_time: this.session.deliveryTime,
        coupon_id: null,
        source: parseInt(env.AI_ORDER_SOURCE),
        tip_amount: this.session.tipAmount,
        pos_payment_method: this.session.paymentMethod!,
        pos_payment_note: this.session.paymentNote,
        pos_received_amount: this.session.receivedAmount,
        items: JSON.stringify(this.session.items),
      };

      const order = await laravelClient.createPosOrder(orderData);

      await sessionManager.completeSession(
        this.callSid,
        order.id,
        order.order_serial_no
      );

      const confirmationMessage = `Great! Your order has been placed successfully. Your order number is ${order.order_serial_no}. The total is $${order.total.toFixed(2)}. Thank you for choosing SavorStation!`;

      await this.speak(confirmationMessage);

      logger.info(
        { callSid: this.callSid, orderId: order.id, orderSerialNo: order.order_serial_no },
        'Order created successfully'
      );
    } catch (error) {
      logger.error({ error, callSid: this.callSid }, 'Failed to create order');
      await sessionManager.failSession(
        this.callSid,
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  private async speak(text: string): Promise<void> {
    if (!this.streamSid) {
      logger.warn('Cannot speak: no stream SID');
      return;
    }

    try {
      this.isSpeaking = true;

      const audioBuffer = await elevenlabsService.generateSpeech(text);
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
    } catch (error) {
      logger.error({ error }, 'Failed to speak');
      this.isSpeaking = false;
    }
  }

  private chunkAudio(base64Audio: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < base64Audio.length; i += chunkSize) {
      chunks.push(base64Audio.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private async generateGreeting(): Promise<string> {
    return "Hello! Thank you for calling SavorStation. I'm here to help you place an order. Would you like this for delivery, pickup, or dine-in?";
  }

  private async handleCallEnd(): Promise<void> {
    logger.info({ callSid: this.callSid }, 'Call ended');

    this.deepgram.close();
    this.deepgramReady = false;
    this.pendingAudio = [];
    this.isSpeaking = false;

    if (this.session && this.session.items.length === 0) {
      await sessionManager.abandonSession(this.callSid);
    }

    if (this.utteranceTimeout) {
      clearTimeout(this.utteranceTimeout);
    }
  }
}

export default VoiceOrchestrator;
