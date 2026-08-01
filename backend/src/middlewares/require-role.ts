import type { RequestHandler } from 'express';
import { HttpError } from '../utils/http-error.js';

export function requireRole(role: string): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new HttpError(401, 'Authentication required'));
      return;
    }

    if (!req.user.roles.includes(role)) {
      next(new HttpError(403, 'Role permission denied'));
      return;
    }

    next();
  };
}
