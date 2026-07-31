import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { closeDatabasePool, postgresPool } from '../src/database/postgres.js';
import { hashPassword } from '../src/utils/password.js';

type LoginResponse = { accessToken: string };

async function createUser(
  email: string,
  role: 'admin' | 'guardian' | 'student',
  fullName: string,
) {
  const result = await postgresPool.query<{ id: number }>(
    `INSERT INTO users (email, full_name, password_hash, status)
     VALUES ($1, $2, $3, 'active') RETURNING id`,
    [email, fullName, await hashPassword('guardian-smoke-password')],
  );
  const id = Number(result.rows[0].id);
  await postgresPool.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles WHERE name = $2`,
    [id, role],
  );
  return id;
}

async function login(baseUrl: string, email: string) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: email,
      password: 'guardian-smoke-password',
    }),
  });
  assert.equal(response.status, 200);
  return (await response.json()) as LoginResponse;
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function run() {
  const suffix = Date.now();
  const userIds: number[] = [];
  const linkIds: number[] = [];
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const adminEmail = `guardian-admin-${suffix}@pct.local`;
    const guardianEmail = `guardian-parent-${suffix}@pct.local`;
    const outsiderEmail = `guardian-outsider-${suffix}@pct.local`;
    const adminId = await createUser(adminEmail, 'admin', 'Guardian Admin');
    const guardianId = await createUser(
      guardianEmail,
      'guardian',
      'Verified Parent',
    );
    const outsiderId = await createUser(
      outsiderEmail,
      'guardian',
      'Outside Parent',
    );
    const studentOneId = await createUser(
      `guardian-student-one-${suffix}@pct.local`,
      'student',
      'Guardian Student One',
    );
    const studentTwoId = await createUser(
      `guardian-student-two-${suffix}@pct.local`,
      'student',
      'Guardian Student Two',
    );
    userIds.push(
      adminId,
      guardianId,
      outsiderId,
      studentOneId,
      studentTwoId,
    );

    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    const admin = await login(baseUrl, adminEmail);
    const guardian = await login(baseUrl, guardianEmail);
    const outsider = await login(baseUrl, outsiderEmail);

    for (const studentId of [studentOneId, studentTwoId]) {
      const invited = await fetch(`${baseUrl}/guardians/links`, {
        method: 'POST',
        headers: headers(admin.accessToken),
        body: JSON.stringify({
          guardian_user_id: guardianId,
          student_user_id: studentId,
          relationship: 'Cha/Mẹ',
        }),
      });
      assert.equal(invited.status, 201);
      const invitedBody = (await invited.json()) as {
        data: { id: number; status: string };
      };
      assert.equal(invitedBody.data.status, 'pending');
      linkIds.push(invitedBody.data.id);
    }

    const pendingChildren = await fetch(`${baseUrl}/guardians/me/students`, {
      headers: headers(guardian.accessToken),
    });
    assert.equal(pendingChildren.status, 200);
    assert.equal(
      ((await pendingChildren.json()) as { data: unknown[] }).data.length,
      0,
    );

    const pendingAccess = await fetch(
      `${baseUrl}/guardians/me/students/${studentOneId}/summary`,
      { headers: headers(guardian.accessToken) },
    );
    assert.equal(pendingAccess.status, 403);

    for (const linkId of linkIds) {
      const verified = await fetch(
        `${baseUrl}/guardians/links/${linkId}/verify`,
        {
          method: 'POST',
          headers: headers(admin.accessToken),
          body: '{}',
        },
      );
      assert.equal(verified.status, 200);
    }

    const children = await fetch(`${baseUrl}/guardians/me/students`, {
      headers: headers(guardian.accessToken),
    });
    assert.equal(children.status, 200);
    assert.equal(((await children.json()) as { data: unknown[] }).data.length, 2);

    const familySummary = await fetch(
      `${baseUrl}/guardians/me/students/${studentOneId}/summary`,
      { headers: headers(guardian.accessToken) },
    );
    assert.equal(familySummary.status, 200);

    const crossFamily = await fetch(
      `${baseUrl}/guardians/me/students/${studentOneId}/summary`,
      { headers: headers(outsider.accessToken) },
    );
    assert.equal(crossFamily.status, 403);

    const revoked = await fetch(
      `${baseUrl}/guardians/links/${linkIds[0]}/revoke`,
      {
        method: 'POST',
        headers: headers(admin.accessToken),
        body: JSON.stringify({ reason: 'Smoke test revocation' }),
      },
    );
    assert.equal(revoked.status, 200);

    const revokedAccess = await fetch(
      `${baseUrl}/guardians/me/students/${studentOneId}/summary`,
      { headers: headers(guardian.accessToken) },
    );
    assert.equal(revokedAccess.status, 403);

    const remainingChildren = await fetch(`${baseUrl}/guardians/me/students`, {
      headers: headers(guardian.accessToken),
    });
    assert.equal(remainingChildren.status, 200);
    assert.equal(
      ((await remainingChildren.json()) as { data: unknown[] }).data.length,
      1,
    );

    const audit = await fetch(
      `${baseUrl}/guardians/links/${linkIds[0]}/audit`,
      { headers: headers(admin.accessToken) },
    );
    assert.equal(audit.status, 200);
    const actions = (
      (await audit.json()) as { data: Array<{ action: string }> }
    ).data.map((item) => item.action);
    assert.deepEqual(new Set(actions), new Set(['invite', 'verify', 'revoke']));

    const accessCount = await postgresPool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM guardian_access_audits
       WHERE guardian_user_id = $1 AND student_user_id = $2`,
      [guardianId, studentOneId],
    );
    assert.equal(accessCount.rows[0].total, 1);

    await assert.rejects(
      postgresPool.query(
        'DELETE FROM guardian_link_audits WHERE link_id = $1',
        [linkIds[0]],
      ),
      /immutable/i,
    );

    console.log(
      'Guardian verified-link isolation, multi-child switch, revocation, and audit smoke test passed.',
    );
  } finally {
    if (linkIds.length || userIds.length) {
      const client = await postgresPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          "SET LOCAL app.allow_guardian_audit_cleanup = 'on'",
        );
        await client.query(
          'DELETE FROM guardian_access_audits WHERE guardian_user_id = ANY($1::bigint[])',
          [userIds],
        );
        await client.query(
          'DELETE FROM guardian_link_audits WHERE link_id = ANY($1::bigint[])',
          [linkIds],
        );
        await client.query(
          'DELETE FROM student_guardian_links WHERE id = ANY($1::bigint[])',
          [linkIds],
        );
        await client.query(
          'DELETE FROM users WHERE id = ANY($1::bigint[])',
          [userIds],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
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
