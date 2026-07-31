import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const tsxCli = path.resolve('node_modules', 'tsx', 'dist', 'cli.mjs');
const importApp = "import('./src/app.ts')";

function loadAppWithEnv(overrides: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [tsxCli, '-e', importApp], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://school.example.vn',
      ...overrides,
    },
  });
}

const unsafeResult = loadAppWithEnv({
  JWT_SECRET: 'change_me_in_development',
});
assert.notEqual(unsafeResult.status, 0, 'Production must reject the default JWT secret');
assert.match(
  `${unsafeResult.stdout}\n${unsafeResult.stderr}`,
  /JWT_SECRET must be configured/,
);

const exampleResult = loadAppWithEnv({
  JWT_SECRET: 'replace_with_random_secret_at_least_32_characters',
});
assert.notEqual(exampleResult.status, 0, 'Production must reject the example JWT secret');

const secureResult = loadAppWithEnv({
  JWT_SECRET: 'ci_security_test_secret_with_more_than_32_characters',
});
assert.equal(
  secureResult.status,
  0,
  `Production should accept a strong JWT secret: ${secureResult.stderr}`,
);

console.log('Environment security smoke test passed.');
