import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
});

const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;
const APP_ENVIRONMENTS = [
  'development',
  'test',
  'staging',
  'production',
] as const;
const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;
const PG_SSL_MODES = ['disable', 'require', 'verify-full'] as const;
const COOKIE_SAME_SITE_VALUES = ['strict', 'lax'] as const;

const DEVELOPMENT_JWT_SECRET = 'change_me_in_development';
const EXAMPLE_JWT_SECRET = 'replace_with_random_secret_at_least_32_characters';
const UNSAFE_SECRETS = new Set([DEVELOPMENT_JWT_SECRET, EXAMPLE_JWT_SECRET]);

function readEnum<const T extends readonly string[]>(
  name: string,
  values: T,
  fallback: T[number],
): T[number] {
  const value = process.env[name]?.trim() || fallback;

  if (!values.includes(value)) {
    throw new Error(`${name} must be one of: ${values.join(', ')}`);
  }

  return value as T[number];
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

function readCsv(name: string) {
  return [
    ...new Set(
      (process.env[name] ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

function parseAbsoluteUrl(name: string, value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${name} must use http or https`);
  }

  if (parsed.username || parsed.password) {
    throw new Error(`${name} must not contain credentials`);
  }

  return parsed;
}

function readCorsOrigins(nodeEnv: string) {
  const configuredOrigins = readCsv('CORS_ORIGINS');

  if (configuredOrigins.length) {
    return configuredOrigins.map((origin) => {
      if (origin === '*') {
        throw new Error('CORS_ORIGINS must not contain a wildcard');
      }

      const parsed = parseAbsoluteUrl('CORS_ORIGINS', origin);
      if (
        parsed.pathname !== '/' ||
        parsed.search ||
        parsed.hash ||
        parsed.origin !== origin
      ) {
        throw new Error('Each CORS_ORIGINS entry must be an origin without a path');
      }

      return parsed.origin;
    });
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

function readPublicAppUrl(nodeEnv: string) {
  const value = process.env.APP_PUBLIC_URL?.trim();
  if (!value) {
    return nodeEnv === 'production' ? undefined : 'http://localhost:5173';
  }

  const parsed = parseAbsoluteUrl('APP_PUBLIC_URL', value);
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('APP_PUBLIC_URL must be an origin without a path');
  }
  return parsed.origin;
}

function validatePostgresUrl(value: string | undefined, requirePassword: boolean) {
  if (!value) return;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL must use postgres or postgresql');
  }

  if (!parsed.hostname || !parsed.pathname.slice(1) || !parsed.username) {
    throw new Error('DATABASE_URL must include host, database, and user');
  }

  if (requirePassword && !parsed.password) {
    throw new Error('DATABASE_URL must include a password in staging/production');
  }
}

function validateJwtExpiry(value: string) {
  if (!/^[1-9]\d*(s|m|h|d)$/.test(value)) {
    throw new Error('JWT_EXPIRES_IN must use a value such as 15m, 1h, or 1d');
  }
  return value;
}

function isLoopbackHostname(hostname: string) {
  return ['localhost', '127.0.0.1', '::1'].includes(hostname.toLowerCase());
}

function isLocalServiceHostname(hostname: string) {
  return isLoopbackHostname(hostname) || hostname.toLowerCase() === 'postgres';
}

const nodeEnv = readEnum(
  'NODE_ENV',
  NODE_ENVIRONMENTS,
  'development',
);
const appEnv = readEnum(
  'APP_ENV',
  APP_ENVIRONMENTS,
  nodeEnv,
);
const isProtectedEnvironment = appEnv === 'staging' || appEnv === 'production';
const jwtSecret = process.env.JWT_SECRET?.trim() || DEVELOPMENT_JWT_SECRET;
const jwtPreviousSecrets = readCsv('JWT_PREVIOUS_SECRETS');
const databaseUrl = process.env.DATABASE_URL?.trim() || undefined;
const postgresSslMode = readEnum('PGSSLMODE', PG_SSL_MODES, 'disable');
const cookieSecure = readBoolean('COOKIE_SECURE', nodeEnv === 'production');

export const env = {
  nodeEnv,
  appEnv,
  isProduction: nodeEnv === 'production',
  isProtectedEnvironment,
  port: readInteger('PORT', 4000, { min: 1, max: 65_535 }),
  publicAppUrl: readPublicAppUrl(nodeEnv),
  logLevel: readEnum(
    'LOG_LEVEL',
    LOG_LEVELS,
    nodeEnv === 'production' ? 'info' : 'debug',
  ),
  database: {
    url: databaseUrl,
    host: process.env.PGHOST?.trim() || 'localhost',
    port: readInteger('PGPORT', 5432, { min: 1, max: 65_535 }),
    user: process.env.PGUSER?.trim() || 'postgres',
    password: process.env.PGPASSWORD ?? '',
    name: process.env.PGDATABASE?.trim() || 'thpt_pct_pt',
    sslMode: postgresSslMode,
    ssl: postgresSslMode !== 'disable',
    sslRejectUnauthorized: readBoolean(
      'PGSSL_REJECT_UNAUTHORIZED',
      postgresSslMode === 'verify-full',
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
    verificationSecrets: [jwtSecret, ...jwtPreviousSecrets],
    expiresIn: validateJwtExpiry(process.env.JWT_EXPIRES_IN?.trim() || '15m'),
    refreshExpiresDays: readInteger('JWT_REFRESH_EXPIRES_DAYS', 7, {
      min: 1,
      max: 90,
    }),
  },
  security: {
    corsOrigins: readCorsOrigins(nodeEnv),
    cookieSecure,
    cookieSameSite: readEnum(
      'COOKIE_SAME_SITE',
      COOKIE_SAME_SITE_VALUES,
      'strict',
    ),
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
} as const;

export function validateApplicationEnvironment() {
  validatePostgresUrl(env.database.url, isProtectedEnvironment);

  if (nodeEnv === 'production' && !isProtectedEnvironment) {
    throw new Error(
      'APP_ENV must be staging or production when NODE_ENV is production',
    );
  }

  if (isProtectedEnvironment && nodeEnv !== 'production') {
    throw new Error(
      'NODE_ENV must be production when APP_ENV is staging or production',
    );
  }

  if (!isProtectedEnvironment) {
    if (appEnv === 'development' && UNSAFE_SECRETS.has(jwtSecret)) {
      process.emitWarning(
        '[security] JWT_SECRET uses a development placeholder. Configure backend/.env.',
      );
    }
    return;
  }

  if (UNSAFE_SECRETS.has(jwtSecret) || jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET must be configured with at least 32 characters in staging/production',
    );
  }

  for (const previousSecret of jwtPreviousSecrets) {
    if (UNSAFE_SECRETS.has(previousSecret) || previousSecret.length < 32) {
      throw new Error(
        'Each JWT_PREVIOUS_SECRETS value must contain at least 32 characters',
      );
    }
    if (previousSecret === jwtSecret) {
      throw new Error('JWT_PREVIOUS_SECRETS must not contain JWT_SECRET');
    }
  }

  if (env.security.corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS is required in staging/production');
  }

  if (!env.publicAppUrl) {
    throw new Error('APP_PUBLIC_URL is required in staging/production');
  }

  const publicUrl = new URL(env.publicAppUrl);
  if (
    publicUrl.protocol !== 'https:' &&
    !isLocalServiceHostname(publicUrl.hostname)
  ) {
    throw new Error('APP_PUBLIC_URL must use https in staging/production');
  }

  for (const origin of env.security.corsOrigins) {
    const parsedOrigin = new URL(origin);
    if (
      parsedOrigin.protocol !== 'https:' &&
      !isLocalServiceHostname(parsedOrigin.hostname)
    ) {
      throw new Error('CORS_ORIGINS must use https in staging/production');
    }
  }

  const usesOnlyLoopbackOrigins =
    isLoopbackHostname(publicUrl.hostname) &&
    env.security.corsOrigins.every((origin) =>
      isLoopbackHostname(new URL(origin).hostname),
    );

  if (!env.security.cookieSecure && !usesOnlyLoopbackOrigins) {
    throw new Error(
      'COOKIE_SECURE must be true in staging/production unless all browser origins are loopback addresses',
    );
  }

  if (!env.database.url) {
    if (!env.database.user || !env.database.name || !env.database.password) {
      throw new Error(
        'PostgreSQL user, password, and database are required in staging/production',
      );
    }
  }

  const databaseHostname = env.database.url
    ? new URL(env.database.url).hostname
    : env.database.host;
  const urlSslMode = env.database.url
    ? new URL(env.database.url).searchParams.get('sslmode')
    : null;
  const databaseUsesSsl =
    env.database.ssl || urlSslMode === 'require' || urlSslMode === 'verify-full';
  if (!isLocalServiceHostname(databaseHostname) && !databaseUsesSsl) {
    throw new Error(
      'Remote PostgreSQL must enable SSL in staging/production',
    );
  }
}
