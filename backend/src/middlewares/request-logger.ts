import type { RequestHandler } from 'express';
import { logger } from '../utils/logger.js';

export function getRequestLogPath(path: string) {
  return path.split('?', 1)[0] || '/';
}

export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const path = getRequestLogPath(req.originalUrl);
    const log = {
      requestId: req.requestId,
      method: req.method,
      path,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    };

    if (res.statusCode >= 500) {
      logger.error(log, `${req.method} ${path} ${res.statusCode}`);
    } else if (res.statusCode >= 400) {
      logger.warn(log, `${req.method} ${path} ${res.statusCode}`);
    } else {
      logger.info(log, `${req.method} ${path} ${res.statusCode}`);
    }
  });

  next();
};
