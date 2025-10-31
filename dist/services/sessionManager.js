"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const env_1 = __importDefault(require("../config/env"));
const logger_1 = __importDefault(require("../utils/logger"));
const crypto_1 = __importDefault(require("crypto"));
class SessionManager {
    supabase;
    constructor() {
        this.supabase = (0, supabase_js_1.createClient)(env_1.default.VITE_SUPABASE_URL, env_1.default.SUPABASE_SERVICE_ROLE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });
    }
    hashPhone(phone) {
        return crypto_1.default.createHash('sha256').update(phone).digest('hex');
    }
    async createSession(callSid, phone) {
        const idempotencyToken = `VOICE-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Date.now()}-${callSid}`;
        const hashedPhone = this.hashPhone(phone);
        const session = {
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
            logger_1.default.error({ error, callSid }, 'Failed to create session in Supabase');
            throw new Error('Failed to create session');
        }
        logger_1.default.info({ callSid, idempotencyToken }, 'Created new call session');
        return session;
    }
    async getSession(callSid) {
        const { data, error } = await this.supabase
            .from('call_sessions')
            .select('session_data')
            .eq('call_sid', callSid)
            .maybeSingle();
        if (error) {
            logger_1.default.error({ error, callSid }, 'Failed to get session from Supabase');
            return null;
        }
        if (!data) {
            return null;
        }
        return data.session_data;
    }
    async updateSession(callSid, updates) {
        const currentSession = await this.getSession(callSid);
        if (!currentSession) {
            throw new Error(`Session not found: ${callSid}`);
        }
        const updatedSession = { ...currentSession, ...updates };
        const { error } = await this.supabase
            .from('call_sessions')
            .update({
            session_data: updatedSession,
            conversation_history: updatedSession.conversationHistory,
            order_type: updatedSession.orderType,
            branch_id: updatedSession.branchId,
            customer_id: updatedSession.customerId,
            address_id: updatedSession.addressId,
            updated_at: new Date().toISOString(),
        })
            .eq('call_sid', callSid);
        if (error) {
            logger_1.default.error({ error, callSid }, 'Failed to update session in Supabase');
            throw new Error('Failed to update session');
        }
        logger_1.default.debug({ callSid }, 'Updated session');
    }
    async addConversationMessage(callSid, role, content) {
        const session = await this.getSession(callSid);
        if (!session) {
            throw new Error(`Session not found: ${callSid}`);
        }
        session.conversationHistory.push({
            role,
            content,
            timestamp: new Date().toISOString(),
        });
        await this.updateSession(callSid, { conversationHistory: session.conversationHistory });
    }
    async completeSession(callSid, orderId, orderSerialNo) {
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
            logger_1.default.error({ error, callSid }, 'Failed to complete session');
            throw new Error('Failed to complete session');
        }
        logger_1.default.info({ callSid, orderId, orderSerialNo }, 'Completed session');
    }
    async failSession(callSid, errorMessage) {
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
            logger_1.default.error({ error, callSid }, 'Failed to mark session as failed');
        }
        logger_1.default.warn({ callSid, errorMessage }, 'Session failed');
    }
    async abandonSession(callSid) {
        const { error } = await this.supabase
            .from('call_sessions')
            .update({
            ended_at: new Date().toISOString(),
            status: 'abandoned',
            updated_at: new Date().toISOString(),
        })
            .eq('call_sid', callSid);
        if (error) {
            logger_1.default.error({ error, callSid }, 'Failed to mark session as abandoned');
        }
        logger_1.default.info({ callSid }, 'Session abandoned');
    }
    async checkIdempotency(token) {
        const { data } = await this.supabase
            .from('call_sessions')
            .select('id')
            .eq('idempotency_token', token)
            .not('order_id', 'is', null)
            .maybeSingle();
        return !!data;
    }
}
exports.default = new SessionManager();
//# sourceMappingURL=sessionManager.js.map