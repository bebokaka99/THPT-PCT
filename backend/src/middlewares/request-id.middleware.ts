import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._-]{1,100}$/;

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incomingRequestId = req.header('X-Request-Id')?.trim();
  req.requestId =
    incomingRequestId && REQUEST_ID_PATTERN.test(incomingRequestId)
      ? incomingRequestId
      : randomUUID();

  res.setHeader('X-Request-Id', req.requestId);
  next();
};
