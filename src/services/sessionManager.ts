import { createClient, SupabaseClient } from '@supabase/supabase-js';
import env from '@/config/env';
import logger from '@/utils/logger';
import { CallSession } from '@/types';
import crypto from 'crypto';

class SessionManager {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      env.VITE_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  private hashPhone(phone: string): string {
    return crypto.createHash('sha256').update(phone).digest('hex');
  }

  async createSession(callSid: string, phone: string): Promise<CallSession> {
    const idempotencyToken = `VOICE-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Date.now()}-${callSid}`;
    const hashedPhone = this.hashPhone(phone);

    const session: CallSession = {
      callSid,
      phone: hashedPhone,
      startedAt: new Date().toISOString(),
      idempotencyToken,
      items: [],
      subtotal: 0,
      discount: 0,
      deliveryCharge: 0,
      tipAmount: 0,
      total: 0,
      conversationHistory: [],
    };

    const { data, error } = await this.supabase
      .from('call_sessions')
      .insert({
        call_sid: callSid,
        phone: hashedPhone,
        started_at: session.startedAt,
        idempotency_token: idempotencyToken,
        session_data: session,
        conversation_history: [],
        status: 'active',
      })
      .select()
      .maybeSingle();

    if (error) {
      logger.error({ error, callSid }, 'Failed to create session in Supabase');
      throw new Error('Failed to create session');
    }

    logger.info({ callSid, idempotencyToken }, 'Created new call session');
    return session;
  }

  async getSession(callSid: string): Promise<CallSession | null> {
    const { data, error } = await this.supabase
      .from('call_sessions')
      .select('session_data, conversation_history')
      .eq('call_sid', callSid)
      .maybeSingle();

    if (error) {
      logger.error({ error, callSid }, 'Failed to get session from Supabase');
      return null;
    }

    if (!data) {
      return null;
    }

    const session = data.session_data as CallSession;
    // Override with the latest conversation history from the dedicated column
    session.conversationHistory = data.conversation_history || [];
    return session;
  }

  async updateSession(callSid: string, updates: Partial<CallSession>): Promise<void> {
    const currentSession = await this.getSession(callSid);
    if (!currentSession) {
      throw new Error(`Session not found: ${callSid}`);
    }

    const updatedSession = { ...currentSession, ...updates };

    // Use raw SQL to avoid PostgREST schema cache issues
    const { error } = await this.supabase.rpc('update_call_session', {
      p_call_sid: callSid,
      p_session_data: updatedSession,
      p_conversation_history: updatedSession.conversationHistory,
      p_order_type: updatedSession.orderType || null,
      p_branch_id: updatedSession.branchId || null,
      p_customer_id: updatedSession.customerId || null,
      p_address_id: updatedSession.addressId || null,
    });

    if (error) {
      logger.error({ error, callSid }, 'Failed to update session in Supabase');
      throw new Error('Failed to update session');
    }

    logger.debug({ callSid }, 'Updated session');
  }

  async addConversationMessage(
    callSid: string,
    role: 'system' | 'user' | 'assistant',
    content: string
  ): Promise<void> {
    const session = await this.getSession(callSid);
    if (!session) {
      throw new Error(`Session not found: ${callSid}`);
    }

    session.conversationHistory.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });

    logger.debug(
      {
        callSid,
        role,
        conversationHistoryLength: session.conversationHistory.length,
      },
      'Adding conversation message'
    );

    await this.updateSession(callSid, { conversationHistory: session.conversationHistory });
  }

  async completeSession(
    callSid: string,
    orderId?: number,
    orderSerialNo?: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('call_sessions')
      .update({
        ended_at: new Date().toISOString(),
        status: 'completed',
        order_id: orderId,
        order_serial_no: orderSerialNo,
        updated_at: new Date().toISOString(),
      })
      .eq('call_sid', callSid);

    if (error) {
      logger.error({ error, callSid }, 'Failed to complete session');
      throw new Error('Failed to complete session');
    }

    logger.info({ callSid, orderId, orderSerialNo }, 'Completed session');
  }

  async failSession(callSid: string, errorMessage: string): Promise<void> {
    const { error } = await this.supabase
      .from('call_sessions')
      .update({
        ended_at: new Date().toISOString(),
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('call_sid', callSid);

    if (error) {
      logger.error({ error, callSid }, 'Failed to mark session as failed');
    }

    logger.warn({ callSid, errorMessage }, 'Session failed');
  }

  async abandonSession(callSid: string): Promise<void> {
    const { error } = await this.supabase
      .from('call_sessions')
      .update({
        ended_at: new Date().toISOString(),
        status: 'abandoned',
        updated_at: new Date().toISOString(),
      })
      .eq('call_sid', callSid);

    if (error) {
      logger.error({ error, callSid }, 'Failed to mark session as abandoned');
    }

    logger.info({ callSid }, 'Session abandoned');
  }

  async checkIdempotency(token: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('call_sessions')
      .select('id')
      .eq('idempotency_token', token)
      .not('order_id', 'is', null)
      .maybeSingle();

    return !!data;
  }
}

export default new SessionManager();
