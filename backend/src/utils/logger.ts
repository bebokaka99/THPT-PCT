import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.logLevel,
  redact: {
    paths: [
      'password',
      'password_hash',
      'accessToken',
      'refreshToken',
      'token',
      'authorization',
      'cookie',
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.password_hash',
      '*.accessToken',
      '*.refreshToken',
      '*.token',
      '*.authorization',
      '*.cookie',
    ],
    censor: '[REDACTED]',
  },
  transport: env.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          singleLine: true,
        },
      },
});
