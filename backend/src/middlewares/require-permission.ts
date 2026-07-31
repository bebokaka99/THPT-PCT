import type { RequestHandler } from 'express';
import { HttpError } from '../utils/http-error.js';

export function requirePermission(permission: string): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new HttpError(401, 'Authentication required'));
      return;
    }

    if (req.user.roles.includes('admin') || req.user.permissions.includes(permission)) {
      next();
      return;
    }

    next(new HttpError(403, 'Permission denied'));
  };
}

export function requireAnyPermission(permissions: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new HttpError(401, 'Authentication required'));
      return;
    }

    if (
      req.user.roles.includes('admin') ||
      permissions.some((permission) => req.user?.permissions.includes(permission))
    ) {
      next();
      return;
    }

    next(new HttpError(403, 'Permission denied'));
  };
}

