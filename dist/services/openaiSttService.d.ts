import { EventEmitter } from 'events';
export declare class OpenAISttService extends EventEmitter {
    private openai;
    private audioBuffer;
    private isProcessing;
    private processTimer;
    private silenceTimer;
    private readonly PROCESS_INTERVAL_MS;
    private readonly SILENCE_THRESHOLD_MS;
    private readonly MIN_AUDIO_LENGTH;
    constructor();
    startTranscription(): Promise<void>;
    sendAudio(audioData: Buffer): void;
    private processAudioBuffer;
    private transcribeAudio;
    private convertMulawToWav;
    close(): void;
}
export default OpenAISttService;
//# sourceMappingURL=openaiSttService.d.ts.map