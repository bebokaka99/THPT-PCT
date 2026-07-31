import type { Request, Response } from 'express';
import { env } from '../../config/env.js';

export const refreshCookieName = 'thpt_pct_pt_refresh_token';

const refreshCookieOptions = {
  httpOnly: true,
  secure: env.security.cookieSecure,
  sameSite: env.security.cookieSameSite,
  path: '/api/auth',
};

export function getRefreshTokenCookie(req: Request) {
  const cookieHeader = req.header('Cookie');
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(';')) {
    const separatorIndex = cookie.indexOf('=');
    if (separatorIndex < 0) continue;

    const name = cookie.slice(0, separatorIndex).trim();
    if (name !== refreshCookieName) continue;

    const value = cookie.slice(separatorIndex + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }

  return null;
}

export function setRefreshTokenCookie(res: Response, token: string) {
  res.cookie(refreshCookieName, token, {
    ...refreshCookieOptions,
    maxAge: env.jwt.refreshExpiresDays * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshTokenCookie(res: Response) {
  res.clearCookie(refreshCookieName, refreshCookieOptions);
}
