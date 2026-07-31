import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from './http-error.js';

export type AccessTokenPayload = {
  userId: number;
};

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  for (const secret of env.jwt.verificationSecrets) {
    try {
      const payload = jwt.verify(token, secret);

      if (
        typeof payload !== 'object' ||
        payload === null ||
        typeof payload.userId !== 'number'
      ) {
        throw new HttpError(401, 'Invalid token payload');
      }

      return {
        userId: payload.userId,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
    }
  }

  throw new HttpError(401, 'Invalid or expired token');
}
