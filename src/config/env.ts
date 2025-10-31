import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('8080'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PUBLIC_URL: z.string().url(),

  BACKEND_BASE_URL: z.string().url(),
  BACKEND_EMAIL: z.string().email(),
  BACKEND_PASSWORD: z.string().min(1),
  AI_ORDER_SOURCE: z.string().default('30'),
  POS_SOURCE: z.string().default('20'),

  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_VOICE_WEBHOOK_PATH: z.string().default('/twilio/voice'),
  TWILIO_STATUS_WEBHOOK_PATH: z.string().default('/twilio/status'),

  STT_PROVIDER: z.enum(['deepgram', 'openai']).default('deepgram'),
  DEEPGRAM_API_KEY: z.string().min(1),

  ELEVEN_API_KEY: z.string().min(1),
  ELEVEN_VOICE_ID: z.string().min(1),

  OPENAI_API_KEY: z.string().min(1),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  MIX_API_KEY: z.string().min(1),

  WEBHOOK_SHARED_SECRET: z.string().min(1),

  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  GOOGLE_MAPS_API_KEY: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Environment validation failed:');
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

export default env;
