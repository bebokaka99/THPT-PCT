import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { closeDatabasePool, postgresPool } from '../src/database/postgres.js';

async function request<T>(baseUrl: string, path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const body = await response.json() as T;
  assert.ok(response.ok, `${init?.method ?? 'GET'} ${path} failed with ${response.status}`);
  return body;
}

async function run() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  let createdUserId: number | undefined;
  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const adminLogin = await request<{
      accessToken: string;
    }>(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'admin@pct.local', password: 'admin123' }),
    });

    const bulk = await request<{
      data: {
        createdCount: number;
        credentials: Array<{
          user_id: number;
          username: string;
          password: string;
        }>;
      };
    }>(baseUrl, '/users/students/bulk', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminLogin.accessToken}` },
      body: JSON.stringify({
        cohort: '99',
        students: [{
          full_name: 'Smoke Test Student',
          date_of_birth: '03/09/2009',
          class_name: 'TEST',
        }],
      }),
    });

    assert.equal(bulk.data.createdCount, 1);
    const credential = bulk.data.credentials[0];
    createdUserId = credential.user_id;
    assert.match(credential.username, /^99pct0309\d{4}$/);
    assert.match(credential.password, /^0309\d{4}$/);

    const studentLogin = await request<{
      user: { username: string | null; roles: string[] };
    }>(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: credential.username,
        password: credential.password,
      }),
    });
    assert.equal(studentLogin.user.username, credential.username);
    assert.deepEqual(studentLogin.user.roles, ['student']);
    console.log('Student bulk account smoke test passed.');
  } finally {
    if (createdUserId) {
      await postgresPool.query('DELETE FROM users WHERE id = $1', [createdUserId]);
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
