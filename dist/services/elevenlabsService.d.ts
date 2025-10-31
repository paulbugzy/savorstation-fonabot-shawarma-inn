import { Readable } from 'stream';
export declare class ElevenLabsService {
    private client;
    constructor();
    generateSpeech(text: string): Promise<Buffer>;
    streamSpeech(text: string): Promise<Readable>;
    encodeToMulaw(pcmBuffer: Buffer): Buffer;
    private linearToMulaw;
}
declare const _default: ElevenLabsService;
export default _default;
//# sourceMappingURL=elevenlabsService.d.ts.map