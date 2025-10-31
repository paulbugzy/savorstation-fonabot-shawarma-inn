import { CallSession } from '../types';
export declare class AIAgent {
    processUserInput(session: CallSession, userMessage: string): Promise<{
        response: string;
        updates: any[];
    }>;
    private buildMessages;
    private buildContextString;
    private getTools;
    private executeToolCall;
}
declare const _default: AIAgent;
export default _default;
//# sourceMappingURL=aiAgent.d.ts.map