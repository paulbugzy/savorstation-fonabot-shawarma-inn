import { WebSocket } from 'ws';
export declare class VoiceOrchestrator {
    private twilioWs;
    private callSid;
    private sttService;
    private session;
    private streamSid;
    private transcriptBuffer;
    private isSpeaking;
    private utteranceTimeout;
    private hasGreeted;
    private sttReady;
    private pendingAudio;
    private updateStreamSid;
    constructor(twilioWs: WebSocket, callSid: string);
    start(phone: string): Promise<void>;
    handleTwilioEvent(msg: any): Promise<void>;
    private handleTranscript;
    private handleUtteranceEnd;
    private processTranscript;
    private applyUpdate;
    private shouldCreateOrder;
    private createOrder;
    private speak;
    private chunkAudio;
    private generateGreeting;
    private handleCallEnd;
}
export default VoiceOrchestrator;
//# sourceMappingURL=voiceOrchestrator.d.ts.map