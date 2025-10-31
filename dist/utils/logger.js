"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pino_1 = __importDefault(require("pino"));
const env_1 = __importDefault(require("../config/env"));
const logger = (0, pino_1.default)({
    level: env_1.default.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: env_1.default.NODE_ENV !== 'production'
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
exports.default = logger;
//# sourceMappingURL=logger.js.map