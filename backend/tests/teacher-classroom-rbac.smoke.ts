import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { closeDatabasePool, postgresPool } from '../src/database/postgres.js';
import { hashPassword } from '../src/utils/password.js';

async function run() {
  const suffix = Date.now();
  const email = `teacher-rbac-${suffix}@pct.local`;
  const password = 'teacher123';
  const passwordHash = await hashPassword(password);
  let teacherId: number | undefined;
  let assignedClassroomId: number | undefined;
  let foreignClassroomId: number | undefined;

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const teacherResult = await postgresPool.query<{ id: number }>(
      `
        INSERT INTO users (email, full_name, password_hash, status)
        VALUES ($1, $2, $3, 'active')
        RETURNING id
      `,
      [email, 'Teacher RBAC Smoke', passwordHash],
    );
    teacherId = Number(teacherResult.rows[0].id);
    await postgresPool.query(
      `
        INSERT INTO user_roles (user_id, role_id)
        SELECT $1, id FROM roles WHERE name = 'teacher'
      `,
      [teacherId],
    );

    const assignedResult = await postgresPool.query<{ id: number }>(
      `
        INSERT INTO classrooms (name, school_year, is_active)
        VALUES ($1, '2099-2100', TRUE)
        RETURNING id
      `,
      [`RBAC Assigned ${suffix}`],
    );
    assignedClassroomId = Number(assignedResult.rows[0].id);
    const foreignResult = await postgresPool.query<{ id: number }>(
      `
        INSERT INTO classrooms (name, school_year, is_active)
        VALUES ($1, '2099-2100', TRUE)
        RETURNING id
      `,
      [`RBAC Foreign ${suffix}`],
    );
    foreignClassroomId = Number(foreignResult.rows[0].id);
    await postgresPool.query(
      `
        INSERT INTO classroom_members (classroom_id, user_id, role)
        VALUES ($1, $2, 'teacher')
      `,
      [assignedClassroomId, teacherId],
    );

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: email, password }),
    });
    assert.equal(loginResponse.status, 200);
    const login = await loginResponse.json() as {
      accessToken: string;
      user: { permissions: string[]; roles: string[] };
    };
    assert.deepEqual(login.user.roles, ['teacher']);
    assert.ok(!login.user.permissions.includes('classrooms.manage'));

    const headers = {
      Authorization: `Bearer ${login.accessToken}`,
      'Content-Type': 'application/json',
    };
    const listResponse = await fetch(
      `${baseUrl}/classrooms?page=1&limit=50&school_year=2099-2100`,
      { headers },
    );
    assert.equal(listResponse.status, 200);
    const list = await listResponse.json() as {
      data: Array<{ id: number }>;
    };
    assert.deepEqual(list.data.map((item) => item.id), [assignedClassroomId]);

    const assignedResponse = await fetch(
      `${baseUrl}/classrooms/${assignedClassroomId}`,
      { headers },
    );
    assert.equal(assignedResponse.status, 200);
    const foreignResponse = await fetch(
      `${baseUrl}/classrooms/${foreignClassroomId}`,
      { headers },
    );
    assert.equal(foreignResponse.status, 403);

    const createAssignedResponse = await fetch(
      `${baseUrl}/classrooms/${assignedClassroomId}/posts`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: 'Teacher RBAC smoke post',
          content: 'Allowed in assigned classroom',
          status: 'draft',
        }),
      },
    );
    assert.equal(createAssignedResponse.status, 201);
    const createForeignResponse = await fetch(
      `${baseUrl}/classrooms/${foreignClassroomId}/posts`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: 'Forbidden teacher post',
          content: 'Must be rejected',
          status: 'draft',
        }),
      },
    );
    assert.equal(createForeignResponse.status, 403);

    console.log('Teacher classroom RBAC smoke test passed.');
  } finally {
    if (assignedClassroomId || foreignClassroomId) {
      await postgresPool.query(
        'DELETE FROM classrooms WHERE id = ANY($1::bigint[])',
        [[assignedClassroomId, foreignClassroomId].filter(Boolean)],
      );
    }
    if (teacherId) {
      await postgresPool.query('DELETE FROM users WHERE id = $1', [teacherId]);
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

