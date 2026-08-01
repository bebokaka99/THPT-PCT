import type { RequestHandler } from 'express';
import { getOperationalHealth, triggerSyntheticFailure } from './operation.service.js';

export const getOperationalHealthController: RequestHandler = async (_req, res, next) => {
  try {
    res.json({ data: await getOperationalHealth() });
  } catch (error) {
    next(error);
  }
};

export const syntheticFailureController: RequestHandler = (_req, _res, next) => {
  try {
    triggerSyntheticFailure();
  } catch (error) {
    next(error);
  }
};
