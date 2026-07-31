import type { RequestHandler } from 'express';
import { getCurrentUser } from '../modules/auth/auth.service.js';
import { HttpError } from '../utils/http-error.js';
import { verifyAccessToken } from '../utils/jwt.js';

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const authorization = req.header('Authorization');

    if (!authorization?.startsWith('Bearer ')) {
      throw new HttpError(401, 'Bearer token is required');
    }

    const token = authorization.slice('Bearer '.length).trim();

    if (!token) {
      throw new HttpError(401, 'Bearer token is required');
    }

    const payload = verifyAccessToken(token);
    req.user = await getCurrentUser(payload.userId);

    next();
  } catch (error) {
    next(error);
  }
};

