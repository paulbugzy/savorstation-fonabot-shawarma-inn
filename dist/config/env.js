"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    PORT: zod_1.z.string().default('8080'),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PUBLIC_URL: zod_1.z.string().url(),
    BACKEND_BASE_URL: zod_1.z.string().url(),
    BACKEND_EMAIL: zod_1.z.string().email(),
    BACKEND_PASSWORD: zod_1.z.string().min(1),
    AI_ORDER_SOURCE: zod_1.z.string().default('30'),
    POS_SOURCE: zod_1.z.string().default('20'),
    TWILIO_ACCOUNT_SID: zod_1.z.string().min(1),
    TWILIO_AUTH_TOKEN: zod_1.z.string().min(1),
    TWILIO_VOICE_WEBHOOK_PATH: zod_1.z.string().default('/twilio/voice'),
    TWILIO_STATUS_WEBHOOK_PATH: zod_1.z.string().default('/twilio/status'),
    DEEPGRAM_API_KEY: zod_1.z.string().min(1),
    ELEVEN_API_KEY: zod_1.z.string().min(1),
    ELEVEN_VOICE_ID: zod_1.z.string().min(1),
    OPENAI_API_KEY: zod_1.z.string().min(1),
    REDIS_URL: zod_1.z.string().default('redis://localhost:6379'),
    MIX_API_KEY: zod_1.z.string().min(1),
    WEBHOOK_SHARED_SECRET: zod_1.z.string().min(1),
    VITE_SUPABASE_URL: zod_1.z.string().url(),
    VITE_SUPABASE_ANON_KEY: zod_1.z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: zod_1.z.string().min(1),
    GOOGLE_MAPS_API_KEY: zod_1.z.string().min(1),
});
let env;
try {
    env = envSchema.parse(process.env);
}
catch (error) {
    if (error instanceof zod_1.z.ZodError) {
        console.error('❌ Environment validation failed:');
        error.errors.forEach((err) => {
            console.error(`  - ${err.path.join('.')}: ${err.message}`);
        });
        process.exit(1);
    }
    throw error;
}
exports.default = env;
//# sourceMappingURL=env.js.map