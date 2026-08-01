import type { RequestHandler } from 'express';
import { checkReadiness } from './health.service.js';

export const legacyHealthController: RequestHandler = (_req, res) => {
  res.json({
    status: 'ok',
    message: 'THPT-PCT-PT API is running',
  });
};

export const livenessController: RequestHandler = (req, res) => {
  res.json({
    status: 'ok',
    liveness: 'alive',
    uptime_seconds: Math.floor(process.uptime()),
    requestId: req.requestId,
  });
};

export const readinessController: RequestHandler = async (req, res) => {
  const result = await checkReadiness();
  res.status(result.ready ? 200 : 503).json({
    status: result.ready ? 'ok' : 'error',
    readiness: result.ready ? 'ready' : 'not_ready',
    database: result.database,
    requestId: req.requestId,
  });
};

export const legacyDatabaseHealthController: RequestHandler = async (req, res) => {
  const result = await checkReadiness();
  res.status(result.ready ? 200 : 503).json({
    status: result.ready ? 'ok' : 'error',
    database: result.database.status,
    ...(result.ready ? {} : { requestId: req.requestId }),
  });
};
