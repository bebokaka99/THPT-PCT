import dotenv from 'dotenv';
import path from 'node:path';
import { logger } from '../utils/logger.js';

dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
});

const DEVELOPMENT_JWT_SECRET = 'change_me_in_development';
const EXAMPLE_JWT_SECRET = 'replace_with_random_secret_at_least_32_characters';

function isUnsafeJwtSecret(secret: string) {
  return secret === DEVELOPMENT_JWT_SECRET || secret === EXAMPLE_JWT_SECRET;
}

function readInteger(
  name: string,
  fallback: number,
  options: { min: number; max: number },
) {
  const rawValue = process.env[name]?.trim();
  const value = rawValue ? Number(rawValue) : fallback;

  if (!Number.isInteger(value) || value < options.min || value > options.max) {
    throw new Error(
      `${name} must be an integer between ${options.min} and ${options.max}`,
    );
  }

  return value;
}

function readBodyLimit() {
  const value = process.env.JSON_BODY_LIMIT?.trim().toLowerCase() || '1mb';

  if (!/^[1-9]\d*(b|kb|mb)$/.test(value)) {
    throw new Error('JSON_BODY_LIMIT must use a value such as 512kb or 1mb');
  }

  return value;
}

function readBoolean(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false`);
}

function readCorsOrigins(nodeEnv: string) {
  const configuredOrigins = process.env.CORS_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins?.length) {
    return configuredOrigins;
  }

  if (nodeEnv === 'production') {
    return [];
  }

  return [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ];
}

const nodeEnv = process.env.NODE_ENV?.trim() || 'development';
const jwtSecret = process.env.JWT_SECRET?.trim() || DEVELOPMENT_JWT_SECRET;

export function validateApplicationEnvironment() {
  if (nodeEnv !== 'production') {
    if (isUnsafeJwtSecret(jwtSecret)) {
      logger.warn(
        {
          setting: 'JWT_SECRET',
        },
        '[security] JWT_SECRET is using a development placeholder. Configure backend/.env.',
      );
    }
    return;
  }

  if (isUnsafeJwtSecret(jwtSecret) || jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET must be configured with at least 32 characters in production',
    );
  }

  if (env.security.corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS is required in production');
  }
}

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: readInteger('PORT', 4000, { min: 1, max: 65_535 }),
  database: {
    url: process.env.DATABASE_URL?.trim() || undefined,
    host: process.env.PGHOST ?? 'localhost',
    port: readInteger('PGPORT', 5432, { min: 1, max: 65_535 }),
    user: process.env.PGUSER ?? 'postgres',
    password: process.env.PGPASSWORD ?? '',
    name: process.env.PGDATABASE ?? 'thpt_pct_pt',
    ssl: process.env.PGSSLMODE === 'require',
    sslRejectUnauthorized: readBoolean(
      'PGSSL_REJECT_UNAUTHORIZED',
      nodeEnv === 'production',
    ),
    poolMax: readInteger('PG_POOL_MAX', 20, { min: 1, max: 100 }),
    connectionTimeoutMs: readInteger('PG_CONNECTION_TIMEOUT_MS', 5_000, {
      min: 1_000,
      max: 120_000,
    }),
    idleTimeoutMs: readInteger('PG_IDLE_TIMEOUT_MS', 30_000, {
      min: 1_000,
      max: 10 * 60 * 1_000,
    }),
    maxUses: readInteger('PG_MAX_USES', 7_500, {
      min: 0,
      max: 1_000_000,
    }),
  },
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshExpiresDays: readInteger('JWT_REFRESH_EXPIRES_DAYS', 7, {
      min: 1,
      max: 90,
    }),
  },
  security: {
    corsOrigins: readCorsOrigins(nodeEnv),
    jsonBodyLimit: readBodyLimit(),
    trustProxyHops: readInteger('TRUST_PROXY_HOPS', 0, { min: 0, max: 10 }),
    rateLimitWindowMs: readInteger('RATE_LIMIT_WINDOW_MS', 60 * 1000, {
      min: 1_000,
      max: 24 * 60 * 60 * 1000,
    }),
    rateLimitMaxRequests: readInteger('RATE_LIMIT_MAX_REQUESTS', 100, {
      min: 1,
      max: 100_000,
    }),
    loginRateLimitMaxRequests: readInteger(
      'LOGIN_RATE_LIMIT_MAX_REQUESTS',
      5,
      {
        min: 1,
        max: 1_000,
      },
    ),
    uploadRateLimitMaxRequests: readInteger(
      'UPLOAD_RATE_LIMIT_MAX_REQUESTS',
      10,
      {
        min: 1,
        max: 1_000,
      },
    ),
  },
};
