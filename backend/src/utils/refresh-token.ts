import crypto from 'node:crypto';
import { env } from '../config/env.js';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export function generateRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token: string) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function getRefreshTokenExpiration() {
  return new Date(Date.now() + env.jwt.refreshExpiresDays * DAY_IN_MILLISECONDS);
}
