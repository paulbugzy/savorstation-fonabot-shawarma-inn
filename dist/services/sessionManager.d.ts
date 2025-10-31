import { CallSession } from '../types';
declare class SessionManager {
    private supabase;
    constructor();
    private hashPhone;
    createSession(callSid: string, phone: string): Promise<CallSession>;
    getSession(callSid: string): Promise<CallSession | null>;
    updateSession(callSid: string, updates: Partial<CallSession>): Promise<void>;
    addConversationMessage(callSid: string, role: 'system' | 'user' | 'assistant', content: string): Promise<void>;
    completeSession(callSid: string, orderId?: number, orderSerialNo?: string): Promise<void>;
    failSession(callSid: string, errorMessage: string): Promise<void>;
    abandonSession(callSid: string): Promise<void>;
    checkIdempotency(token: string): Promise<boolean>;
}
declare const _default: SessionManager;
export default _default;
//# sourceMappingURL=sessionManager.d.ts.map