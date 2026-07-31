import { Router } from 'express';
import {
  adminCheckController,
  loginController,
  logoutController,
  meController,
  refreshController,
} from './auth.controller.js';
import { requireAuth } from '../../middlewares/require-auth.js';
import { requirePermission } from '../../middlewares/require-permission.js';
import { loginRateLimiter } from '../../config/security.js';

export const authRoutes = Router();

authRoutes.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

authRoutes.post('/login', loginRateLimiter, loginController);
authRoutes.post('/refresh', refreshController);
authRoutes.post('/logout', logoutController);
authRoutes.get('/me', requireAuth, meController);
authRoutes.get(
  '/admin-check',
  requireAuth,
  requirePermission('users.manage'),
  adminCheckController,
);
