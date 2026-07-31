import type { AuthUser } from '../modules/auth/auth.types.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: AuthUser;
    }
  }
}

export {};
