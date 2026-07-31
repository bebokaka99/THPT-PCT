import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import jwt from 'jsonwebtoken';

const tsxCli = path.resolve('node_modules', 'tsx', 'dist', 'cli.mjs');
const importApp = "import('./src/app.ts')";
const secureSecret = 'ci_security_test_secret_with_more_than_32_characters';
const previousSecret = 'ci_previous_secret_with_more_than_32_characters';

const secureEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  APP_ENV: 'production',
  APP_PUBLIC_URL: 'https://school.example.vn',
  CORS_ORIGINS: 'https://school.example.vn',
  DATABASE_URL:
    'postgresql://school_user:strong_database_password@db.example.vn/school?sslmode=require',
  COOKIE_SECURE: 'true',
  JWT_SECRET: secureSecret,
};

function loadAppWithEnv(overrides: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [tsxCli, '-e', importApp], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      ...secureEnvironment,
      ...overrides,
    },
  });
}

function expectRejected(overrides: NodeJS.ProcessEnv, message: RegExp) {
  const result = loadAppWithEnv(overrides);
  assert.notEqual(result.status, 0, `Environment should be rejected: ${message}`);
  assert.match(`${result.stdout}\n${result.stderr}`, message);
}

expectRejected(
  { JWT_SECRET: 'change_me_in_development' },
  /JWT_SECRET must be configured/,
);
expectRejected(
  { JWT_SECRET: 'replace_with_random_secret_at_least_32_characters' },
  /JWT_SECRET must be configured/,
);
expectRejected({ CORS_ORIGINS: '' }, /CORS_ORIGINS is required/);
expectRejected({ CORS_ORIGINS: '*' }, /must not contain a wildcard/);
expectRejected({ APP_PUBLIC_URL: '' }, /APP_PUBLIC_URL is required/);
expectRejected({ COOKIE_SECURE: 'false' }, /COOKIE_SECURE must be true/);
expectRejected(
  {
    DATABASE_URL: '',
    PGUSER: '',
    PGPASSWORD: '',
    PGDATABASE: '',
  },
  /PostgreSQL user, password, and database are required/,
);
expectRejected({ NODE_ENV: 'prod' }, /NODE_ENV must be one of/);
expectRejected({ LOG_LEVEL: 'verbose' }, /LOG_LEVEL must be one of/);
expectRejected(
  { NODE_ENV: 'production', APP_ENV: 'development' },
  /APP_ENV must be staging or production/,
);
expectRejected(
  { NODE_ENV: 'development', APP_ENV: 'production' },
  /NODE_ENV must be production/,
);
expectRejected(
  { APP_PUBLIC_URL: 'https://school.example.vn/private' },
  /APP_PUBLIC_URL must be an origin/,
);
expectRejected(
  { APP_PUBLIC_URL: 'http://school.example.vn' },
  /APP_PUBLIC_URL must use https/,
);
expectRejected(
  {
    DATABASE_URL:
      'postgresql://school_user:strong_database_password@db.example.vn/school',
  },
  /Remote PostgreSQL must enable SSL/,
);

const secureResult = loadAppWithEnv({});
assert.equal(
  secureResult.status,
  0,
  `Production should accept a safe environment: ${secureResult.stderr}`,
);

const loopbackHttpResult = loadAppWithEnv({
  APP_PUBLIC_URL: 'http://127.0.0.1:18080',
  CORS_ORIGINS: 'http://127.0.0.1:18080',
  COOKIE_SECURE: 'false',
});
assert.equal(
  loopbackHttpResult.status,
  0,
  `Production build should support local loopback HTTP: ${loopbackHttpResult.stderr}`,
);

const previousToken = jwt.sign({ userId: 42 }, previousSecret, {
  expiresIn: '5m',
});
const verifyPreviousToken = [
  "import { verifyAccessToken } from './src/utils/jwt.ts';",
  `const payload = verifyAccessToken(${JSON.stringify(previousToken)});`,
  "if (payload.userId !== 42) process.exit(1);",
].join(' ');
const rotationResult = spawnSync(
  process.execPath,
  [tsxCli, '-e', verifyPreviousToken],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      ...secureEnvironment,
      JWT_PREVIOUS_SECRETS: previousSecret,
    },
  },
);
assert.equal(
  rotationResult.status,
  0,
  `Previous JWT signing key should remain valid during rotation: ${rotationResult.stderr}`,
);

console.log('Environment security smoke test passed.');
