import pino from 'pino';
import { env } from '../config/env.js';

export const LOG_REDACTION = {
  paths: [
    'password',
    'password_hash',
    'accessToken',
    'refreshToken',
    'token',
    'authorization',
    'cookie',
    'email',
    'username',
    'fullName',
    'full_name',
    'phone',
    'parent_phone',
    'address',
    'date_of_birth',
    'body',
    'payload',
    'input',
    'req.body',
    'req.headers.authorization',
    'req.headers.cookie',
    '*.password',
    '*.password_hash',
    '*.accessToken',
    '*.refreshToken',
    '*.token',
    '*.authorization',
    '*.cookie',
    '*.email',
    '*.username',
    '*.fullName',
    '*.full_name',
    '*.phone',
    '*.parent_phone',
    '*.address',
    '*.date_of_birth',
  ],
  censor: '[REDACTED]',
};

export const logger = pino({
  level: env.logLevel,
  redact: LOG_REDACTION,
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
