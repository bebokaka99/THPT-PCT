import process from 'node:process';
import { parseArgs, requiredString } from './backup-lib.mjs';

const ROLE_CONFIG = [
  { role: 'admin', email: 'SMOKE_ADMIN_EMAIL', password: 'SMOKE_ADMIN_PASSWORD', portal: '/admin', allowed: '/api/users?page=1&limit=1' },
  { role: 'teacher', email: 'SMOKE_TEACHER_EMAIL', password: 'SMOKE_TEACHER_PASSWORD', portal: '/teacher', allowed: '/api/classrooms?page=1&limit=1' },
  { role: 'student', email: 'SMOKE_STUDENT_EMAIL', password: 'SMOKE_STUDENT_PASSWORD', portal: '/student', allowed: '/api/classrooms?page=1&limit=1' },
];

async function apiRequest(baseUrl, endpoint, options = {}) {
  return fetch(new URL(endpoint, baseUrl), {
    method: options.method ?? 'GET',
    signal: AbortSignal.timeout(10_000),
    headers: {
      accept: 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

async function testRole(baseUrl, config) {
  const email = requiredString(process.env[config.email], config.email);
  const password = requiredString(process.env[config.password], config.password);
  const login = await apiRequest(baseUrl, '/api/auth/login', { method: 'POST', body: { email, password } });
  const loginBody = await login.json().catch(() => null);
  if (!login.ok || typeof loginBody?.accessToken !== 'string') throw new Error(`${config.role} login failed with HTTP ${login.status}.`);
  const token = loginBody.accessToken;
  const refreshCookie = (login.headers.get('set-cookie') || '').split(';', 1)[0];
  if (!refreshCookie.includes('=')) throw new Error(`${config.role} login did not return a refresh cookie.`);
  if (!loginBody.user?.roles?.includes(config.role)) throw new Error(`${config.role} smoke account does not have the expected role.`);
  try {
    const me = await apiRequest(baseUrl, '/api/auth/me', { token });
    if (!me.ok) throw new Error(`${config.role} /api/auth/me returned HTTP ${me.status}.`);
    const allowed = await apiRequest(baseUrl, config.allowed, { token });
    if (!allowed.ok) throw new Error(`${config.role} allowed API returned HTTP ${allowed.status}.`);
    const portal = await fetch(new URL(config.portal, baseUrl), { signal: AbortSignal.timeout(10_000) });
    if (!portal.ok) throw new Error(`${config.role} portal shell returned HTTP ${portal.status}.`);

    if (config.role !== 'admin') {
      const forbidden = await apiRequest(baseUrl, '/api/users?page=1&limit=1', { token });
      if (forbidden.status !== 403) throw new Error(`${config.role} must receive 403 from the admin users API, received ${forbidden.status}.`);
    }
  } finally {
    const logout = await apiRequest(baseUrl, '/api/auth/logout', { method: 'POST', cookie: refreshCookie });
    if (logout.status !== 204) throw new Error(`${config.role} smoke session cleanup returned HTTP ${logout.status}.`);
  }
  console.log(`${config.role} authentication, portal shell, allowed API, role isolation and session cleanup passed.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = new URL(requiredString(args['base-url'] ?? process.env.APP_URL, 'base-url'));
  for (const config of ROLE_CONFIG) await testRole(baseUrl, config);
  console.log('Role smoke passed without mutating school business data; temporary auth sessions were revoked.');
}

main().catch((error) => {
  console.error(`Role smoke failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
