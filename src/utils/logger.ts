import pino from 'pino';
import env from '@/config/env';

const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  redact: {
    paths: [
      'phone',
      'email',
      'password',
      'token',
      'authorization',
      'card_number',
      'cvv',
      'pos_payment_note',
    ],
    censor: '[REDACTED]',
  },
});

export default logger;
