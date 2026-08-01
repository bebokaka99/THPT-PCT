import path from 'node:path';
import process from 'node:process';
import { loadEnvFile, parseArgs, requiredString } from './backup-lib.mjs';

function productionOrigin(value) {
  const parsed = new URL(requiredString(value, 'APP_ORIGIN'));
  if (parsed.protocol !== 'https:') throw new Error('APP_ORIGIN must use https:// in production.');
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw new Error('APP_ORIGIN must be an HTTPS origin without credentials, path, query, or fragment.');
  }
  if (parsed.port && parsed.port !== '443') throw new Error('APP_ORIGIN must use the default HTTPS port.');
  if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
    throw new Error('APP_ORIGIN must not use a local hostname in production.');
  }
  return parsed;
}

function strongSecret(value, name, minimumLength) {
  const secret = requiredString(value, name);
  if (secret.length < minimumLength) throw new Error(`${name} must contain at least ${minimumLength} characters.`);
  if (/^(change|replace|example|password|secret)/i.test(secret)) throw new Error(`${name} still contains a placeholder value.`);
}

export function validateProductionConfig(env) {
  const origin = productionOrigin(env.APP_ORIGIN);
  const domain = requiredString(env.APP_DOMAIN, 'APP_DOMAIN').toLowerCase();
  if (domain.includes('://') || domain.includes('/') || domain !== origin.hostname.toLowerCase()) {
    throw new Error('APP_DOMAIN must be the hostname from APP_ORIGIN without a scheme or path.');
  }
  if (env.APP_ENV !== 'production') throw new Error('APP_ENV must equal production.');
  if (env.COOKIE_SECURE !== 'true') throw new Error('COOKIE_SECURE must equal true in production.');
  if (!['strict', 'lax'].includes(String(env.COOKIE_SAME_SITE).toLowerCase())) {
    throw new Error('COOKIE_SAME_SITE must be strict or lax in production.');
  }
  if ((env.FRONTEND_BIND_ADDRESS || '127.0.0.1') !== '127.0.0.1') {
    throw new Error('FRONTEND_BIND_ADDRESS must remain 127.0.0.1 behind the edge proxy.');
  }
  strongSecret(env.JWT_SECRET, 'JWT_SECRET', 32);
  strongSecret(env.POSTGRES_PASSWORD, 'POSTGRES_PASSWORD', 16);
  const caddyImage = requiredString(env.CADDY_IMAGE || 'caddy:2.11.4-alpine', 'CADDY_IMAGE');
  if (/:latest$/.test(caddyImage) || !/^caddy:\d+\.\d+\.\d+-alpine$/.test(caddyImage)) {
    throw new Error('CADDY_IMAGE must use an exact caddy:<major>.<minor>.<patch>-alpine tag.');
  }
  const postgresImage = requiredString(env.POSTGRES_IMAGE, 'POSTGRES_IMAGE');
  if (!/^ghcr\.io\/[a-z0-9._-]+\/[a-z0-9._-]+:[0-9a-f]{40}$/.test(postgresImage)) {
    throw new Error('POSTGRES_IMAGE must use ghcr.io/<owner>/<repository>:<full-40-character-SHA>.');
  }
  return domain;
}

function selfTest() {
  const valid = {
    APP_ENV: 'production',
    APP_ORIGIN: 'https://portal.example.edu.vn',
    APP_DOMAIN: 'portal.example.edu.vn',
    CADDY_IMAGE: 'caddy:2.11.4-alpine',
    POSTGRES_IMAGE: `ghcr.io/example/thpt-pct-postgres:${'0'.repeat(40)}`,
    POSTGRES_PASSWORD: 'a'.repeat(32),
    JWT_SECRET: 'b'.repeat(48),
    COOKIE_SECURE: 'true',
    COOKIE_SAME_SITE: 'strict',
    FRONTEND_BIND_ADDRESS: '127.0.0.1',
  };
  validateProductionConfig(valid);
  for (const invalid of [
    { ...valid, APP_ORIGIN: 'http://portal.example.edu.vn' },
    { ...valid, COOKIE_SECURE: 'false' },
    { ...valid, JWT_SECRET: 'short' },
    { ...valid, APP_DOMAIN: 'other.example.edu.vn' },
    { ...valid, POSTGRES_IMAGE: 'postgres:latest' },
  ]) {
    let rejected = false;
    try { validateProductionConfig(invalid); } catch { rejected = true; }
    if (!rejected) throw new Error('Production config self-test expected an invalid fixture to be rejected.');
  }
  console.log('Production config self-test passed one valid and five invalid fixtures.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args['self-test'] === true) {
    selfTest();
    return;
  }
  const envFile = path.resolve(String(args['env-file'] ?? '.env.production'));
  const env = await loadEnvFile(envFile);
  const domain = validateProductionConfig(env);
  console.log(`Production config passed for https://${domain}; secrets were validated but not printed.`);
}

main().catch((error) => {
  console.error(`Production config failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
