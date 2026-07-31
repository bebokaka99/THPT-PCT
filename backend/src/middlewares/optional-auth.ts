import type { RequestHandler } from 'express';
import { getCurrentUser } from '../modules/auth/auth.service.js';
import { verifyAccessToken } from '../utils/jwt.js';

export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const authorization = req.header('Authorization');

  if (!authorization?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    next();
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = await getCurrentUser(payload.userId);
  } catch {
    req.user = undefined;
  }

  next();
};
