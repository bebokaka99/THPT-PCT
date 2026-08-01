import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';
import { logger } from '../utils/logger.js';
import { recordOperationalError } from '../utils/operational-metrics.js';

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'Internal server error';
}

function normalizeValidationMessage(message: string) {
  if (/^[A-Z0-9_]+$/.test(message)) {
    return `Validation failed: ${message}`;
  }

  return message;
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const providedStatus =
    typeof error.statusCode === 'number'
      ? error.statusCode
      : typeof error.status === 'number'
        ? error.status
        : undefined;
  const statusCode =
    error instanceof multer.MulterError ? 400 : providedStatus ?? 500;
  const rawMessage = normalizeValidationMessage(getErrorMessage(error));
  const canExposeMessage =
    statusCode < 500 || error instanceof HttpError || !env.isProduction;
  const message = canExposeMessage ? rawMessage : 'Internal server error';
  const safePath = req.originalUrl.split('?', 1)[0] || '/';

  if (statusCode >= 500) {
    recordOperationalError({
      occurred_at: new Date().toISOString(),
      request_id: req.requestId,
      path: safePath,
      status_code: statusCode,
      error_name: error instanceof Error ? error.name : 'UnknownError',
    });
  }

  if (!env.isProduction || statusCode >= 500) {
    const logDetails = {
      requestId: req.requestId,
      method: req.method,
      path: safePath,
      statusCode,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      message: env.isProduction && statusCode >= 500
        ? 'Internal server error'
        : rawMessage,
      ...(!env.isProduction && error instanceof Error ? { stack: error.stack } : {}),
    };

    if (statusCode >= 500) {
      logger.error(logDetails, '[request:error]');
    } else {
      logger.warn(logDetails, '[request:rejected]');
    }
  }

  res.status(statusCode).json({
    status: 'error',
    message,
    ...(error instanceof HttpError && error.code ? { code: error.code } : {}),
    ...(error instanceof HttpError && error.details !== undefined
      ? { details: error.details }
      : {}),
    requestId: req.requestId,
  });
};
