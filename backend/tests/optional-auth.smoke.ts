import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { closeDatabasePool } from '../src/database/postgres.js';

async function run() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api`;

    const adminLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@pct.local', password: 'admin123' }),
    });
    assert.equal(adminLogin.status, 200);
    const { accessToken } = await adminLogin.json() as { accessToken: string };

    for (const resource of ['posts', 'documents']) {
      const publicResponse = await fetch(`${baseUrl}/${resource}`);
      assert.equal(publicResponse.status, 200, `Public ${resource} list must remain accessible`);

      const anonymousPrivateResponse = await fetch(`${baseUrl}/${resource}?status=all`);
      assert.equal(
        anonymousPrivateResponse.status,
        401,
        `Anonymous users must not list private ${resource}`,
      );

      const invalidTokenResponse = await fetch(`${baseUrl}/${resource}?status=all`, {
        headers: { Authorization: 'Bearer invalid-token' },
      });
      assert.equal(
        invalidTokenResponse.status,
        401,
        `Invalid token must not list private ${resource}`,
      );

      const adminResponse = await fetch(`${baseUrl}/${resource}?status=all`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      assert.equal(adminResponse.status, 200, `Admin must list all ${resource}`);
    }

    console.log('Optional auth smoke test passed.');
  } finally {
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
