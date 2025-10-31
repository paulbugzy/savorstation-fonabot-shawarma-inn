import { EventEmitter } from 'events';
export declare class DeepgramService extends EventEmitter {
    private deepgram;
    private connection;
    constructor();
    startTranscription(): Promise<void>;
    sendAudio(audioData: Buffer): void;
    close(): void;
}
export default DeepgramService;
//# sourceMappingURL=deepgramService.d.ts.map