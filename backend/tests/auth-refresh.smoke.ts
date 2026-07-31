import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { closeDatabasePool, postgresPool } from '../src/database/postgres.js';
import { hashRefreshToken } from '../src/utils/refresh-token.js';

function readCookie(response: Response) {
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie, 'Expected refresh cookie');
  const cookie = setCookie.split(';', 1)[0];
  const token = cookie.slice(cookie.indexOf('=') + 1);
  return { cookie, token };
}

async function run() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const tokenHashes: string[] = [];

  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const login = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@pct.local',
        password: 'admin123',
      }),
    });
    assert.equal(login.status, 200);
    assert.match(login.headers.get('set-cookie') ?? '', /HttpOnly/i);
    const first = readCookie(login);
    tokenHashes.push(hashRefreshToken(first.token));

    const refresh = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: first.cookie },
    });
    assert.equal(refresh.status, 200);
    const second = readCookie(refresh);
    tokenHashes.push(hashRefreshToken(second.token));
    assert.notEqual(second.token, first.token);
    const refreshedBody = (await refresh.json()) as { accessToken: string };
    assert.ok(refreshedBody.accessToken);

    const reusedToken = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: first.cookie },
    });
    assert.equal(reusedToken.status, 401);

    const me = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${refreshedBody.accessToken}` },
    });
    assert.equal(me.status, 200);

    const logout = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: second.cookie },
    });
    assert.equal(logout.status, 204);

    const refreshAfterLogout = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: second.cookie },
    });
    assert.equal(refreshAfterLogout.status, 401);

    console.log('Auth refresh rotation smoke test passed.');
  } finally {
    if (tokenHashes.length > 0) {
      await postgresPool.query(
        'DELETE FROM auth_refresh_sessions WHERE token_hash = ANY($1::text[])',
        [tokenHashes],
      );
    }
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await closeDatabasePool();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
