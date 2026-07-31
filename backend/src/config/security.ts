import type { CorsOptions } from 'cors';
import { rateLimit } from 'express-rate-limit';
import { env } from './env.js';
import { HttpError } from '../utils/http-error.js';

export const corsOptions: CorsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin || env.security.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new HttpError(403, 'Origin is not allowed by CORS'));
  },
  methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
  exposedHeaders: ['RateLimit', 'RateLimit-Policy', 'X-Request-Id'],
  maxAge: 600,
};

const commonRateLimitOptions = {
  windowMs: env.security.rateLimitWindowMs,
  standardHeaders: 'draft-8' as const,
  legacyHeaders: false,
};

export const apiRateLimiter = rateLimit({
  ...commonRateLimitOptions,
  limit: env.security.rateLimitMaxRequests,
  skip: (req) => req.path === '/health',
  message: {
    status: 'error',
    message: 'Too many requests. Please try again later.',
  },
});

export const loginRateLimiter = rateLimit({
  ...commonRateLimitOptions,
  limit: env.security.loginRateLimitMaxRequests,
  skipSuccessfulRequests: true,
  message: {
    status: 'error',
    message: 'Too many login attempts. Please try again later.',
  },
});

export const uploadRateLimiter = rateLimit({
  ...commonRateLimitOptions,
  limit: env.security.uploadRateLimitMaxRequests,
  message: {
    status: 'error',
    message: 'Upload rate limit exceeded. Please try again later.',
  },
});
