import type { RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  getCurrentUser,
  login,
  logout,
  refreshAuthSession,
} from './auth.service.js';
import { validateLoginInput } from './auth.validation.js';
import {
  clearRefreshTokenCookie,
  getRefreshTokenCookie,
  setRefreshTokenCookie,
} from './auth-cookie.js';

export const loginController: RequestHandler = async (req, res, next) => {
  try {
    const input = validateLoginInput(req.body);
    const result = await login(input);
    setRefreshTokenCookie(res, result.refreshToken);

    res.json({
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
};

export const refreshController: RequestHandler = async (req, res, next) => {
  try {
    const result = await refreshAuthSession(getRefreshTokenCookie(req));
    setRefreshTokenCookie(res, result.refreshToken);
    res.json({
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (error) {
    clearRefreshTokenCookie(res);
    next(error);
  }
};

export const logoutController: RequestHandler = async (req, res, next) => {
  try {
    await logout(getRefreshTokenCookie(req));
    clearRefreshTokenCookie(res);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const meController: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new HttpError(401, 'Authentication required');
    }

    const user = await getCurrentUser(req.user.id);
    res.json({ user });
  } catch (error) {
    next(error);
  }
};

export const adminCheckController: RequestHandler = (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Admin permission granted',
  });
};
