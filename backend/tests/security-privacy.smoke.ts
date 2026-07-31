import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { closeDatabasePool, postgresPool } from '../src/database/postgres.js';
import { getRequestLogPath } from '../src/middlewares/request-logger.js';

type LoginResponse = {
  accessToken: string;
};

function readCookie(response: Response) {
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie, 'Expected refresh cookie');
  return {
    header: setCookie,
    cookie: setCookie.split(';', 1)[0],
  };
}

async function login(baseUrl: string, identifier: string, password: string) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const refreshCookie = readCookie(response);
  assert.match(refreshCookie.header, /HttpOnly/i);
  assert.match(refreshCookie.header, /SameSite=Strict/i);
  const body = await response.json() as LoginResponse;
  return { accessToken: body.accessToken, refreshCookie: refreshCookie.cookie };
}

async function run() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const email = `security-audit-${Date.now()}@pct.local`;
  let userId: number | null = null;
  let mediaId: number | null = null;

  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api`;

    assert.equal(
      getRequestLogPath('/api/search?q=student%40pct.local&token=secret'),
      '/api/search',
      'Request logs must omit query values',
    );

    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(health.headers.get('content-security-policy'));

    const deniedOrigin = await fetch(`${baseUrl}/health`, {
      headers: { Origin: 'https://untrusted.example' },
    });
    assert.equal(deniedOrigin.status, 403);

    const admin = await login(baseUrl, 'admin@pct.local', 'admin123');
    const adminHeaders = {
      Authorization: `Bearer ${admin.accessToken}`,
      'Content-Type': 'application/json',
    };

    const weakPassword = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        email: `weak-${email}`,
        full_name: 'Weak Password',
        password: '123456',
        roles: ['student'],
      }),
    });
    assert.equal(weakPassword.status, 400);
    assert.match(
      ((await weakPassword.json()) as { message: string }).message,
      /at least 10 characters/,
    );

    const createUser = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        email,
        full_name: 'Security Audit User',
        password: 'Security1234',
        roles: ['student'],
      }),
    });
    assert.equal(createUser.status, 201);
    const created = await createUser.json() as { data: { id: number } };
    userId = created.data.id;

    const student = await login(baseUrl, email, 'Security1234');
    const forbiddenUsers = await fetch(`${baseUrl}/users`, {
      headers: { Authorization: `Bearer ${student.accessToken}` },
    });
    assert.equal(forbiddenUsers.status, 403);

    const fakePdf = new FormData();
    fakePdf.set(
      'file',
      new Blob(['not a real PDF'], { type: 'application/pdf' }),
      'spoofed.pdf',
    );
    const rejectedUpload = await fetch(`${baseUrl}/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${admin.accessToken}` },
      body: fakePdf,
    });
    assert.equal(rejectedUpload.status, 400);
    assert.match(
      ((await rejectedUpload.json()) as { message: string }).message,
      /does not match/,
    );

    const validPdf = new FormData();
    validPdf.set(
      'file',
      new Blob(['%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'], {
        type: 'application/pdf',
      }),
      'security-check.pdf',
    );
    const acceptedUpload = await fetch(`${baseUrl}/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${admin.accessToken}` },
      body: validPdf,
    });
    assert.equal(acceptedUpload.status, 201);
    const uploaded = await acceptedUpload.json() as { data: { id: number } };
    mediaId = uploaded.data.id;

    const deleteUpload = await fetch(`${baseUrl}/media/${mediaId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });
    assert.equal(deleteUpload.status, 204);
    mediaId = null;

    const lockUser = await fetch(`${baseUrl}/users/${userId}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'locked' }),
    });
    assert.equal(lockUser.status, 200);

    const refreshAfterLock = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: student.refreshCookie },
    });
    assert.equal(refreshAfterLock.status, 401);

    const oldAccessAfterLock = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${student.accessToken}` },
    });
    assert.equal(oldAccessAfterLock.status, 401);

    const unlockUser = await fetch(`${baseUrl}/users/${userId}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'active' }),
    });
    assert.equal(unlockUser.status, 200);
    const activeStudent = await login(baseUrl, email, 'Security1234');

    const changeRoles = await fetch(`${baseUrl}/users/${userId}/roles`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ roles: ['teacher'] }),
    });
    assert.equal(changeRoles.status, 200);

    const refreshAfterRoleChange = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: activeStudent.refreshCookie },
    });
    assert.equal(refreshAfterRoleChange.status, 401);

    console.log('Security and privacy smoke test passed.');
  } finally {
    if (mediaId) {
      await postgresPool.query('DELETE FROM media_files WHERE id = $1', [mediaId]);
    }
    if (userId) {
      await postgresPool.query('DELETE FROM users WHERE id = $1', [userId]);
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
