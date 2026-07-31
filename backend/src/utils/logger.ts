import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL?.trim() || (isProduction ? 'info' : 'debug'),
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
  transport: isProduction
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
