import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { closeDatabasePool, postgresPool } from '../src/database/postgres.js';
import { hashPassword } from '../src/utils/password.js';

type LoginResponse = {
  accessToken: string;
};

type DataResponse<T> = {
  data: T;
};

async function createUser(
  email: string,
  password: string,
  role: 'admin' | 'student',
) {
  const result = await postgresPool.query<{ id: number }>(
    `
      INSERT INTO users (email, full_name, password_hash, status)
      VALUES ($1, $2, $3, 'active')
      RETURNING id
    `,
    [email, `Enrollment smoke ${role}`, await hashPassword(password)],
  );
  const id = Number(result.rows[0].id);
  await postgresPool.query(
    `
      INSERT INTO user_roles (user_id, role_id)
      SELECT $1, id FROM roles WHERE name = $2
    `,
    [id, role],
  );
  if (role === 'student') {
    await postgresPool.query(
      `
        INSERT INTO student_profiles (user_id, full_name)
        VALUES ($1, $2)
      `,
      [id, 'Enrollment smoke student'],
    );
  }
  return id;
}

async function login(baseUrl: string, email: string, password: string) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password }),
  });
  assert.equal(response.status, 200);
  return (await response.json()) as LoginResponse;
}

async function run() {
  const suffix = Date.now();
  const password = 'enrollment-history-test';
  let adminId: number | undefined;
  let studentId: number | undefined;
  const classroomIds: number[] = [];
  const enrollmentIds: number[] = [];

  const yearResult = await postgresPool.query<{
    id: number;
    start_date: string;
  }>(
    `
      SELECT id, start_date::text AS start_date
      FROM academic_years
      WHERE status <> 'closed' AND is_locked = FALSE
      ORDER BY start_date DESC
      LIMIT 1
    `,
  );
  assert.ok(yearResult.rows[0], 'A writable academic year is required');
  const academicYearId = Number(yearResult.rows[0].id);
  const effectiveDate = yearResult.rows[0].start_date;

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    adminId = await createUser(
      `enrollment-admin-${suffix}@pct.local`,
      password,
      'admin',
    );
    studentId = await createUser(
      `enrollment-student-${suffix}@pct.local`,
      password,
      'student',
    );
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const admin = await login(
      baseUrl,
      `enrollment-admin-${suffix}@pct.local`,
      password,
    );
    const student = await login(
      baseUrl,
      `enrollment-student-${suffix}@pct.local`,
      password,
    );
    const adminHeaders = {
      Authorization: `Bearer ${admin.accessToken}`,
      'Content-Type': 'application/json',
    };
    const studentHeaders = {
      Authorization: `Bearer ${student.accessToken}`,
      'Content-Type': 'application/json',
    };

    for (const label of ['A', 'B']) {
      const response = await fetch(`${baseUrl}/classrooms`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          name: `Enrollment ${label} ${suffix}`,
          academic_year_id: academicYearId,
          grade_level: 10,
          is_active: true,
        }),
      });
      assert.equal(response.status, 201);
      classroomIds.push(
        ((await response.json()) as DataResponse<{ id: number }>).data.id,
      );
    }

    const createResponse = await fetch(`${baseUrl}/enrollments`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        student_user_id: studentId,
        classroom_id: classroomIds[0],
        enrolled_at: effectiveDate,
      }),
    });
    assert.equal(createResponse.status, 201);
    const firstEnrollment = (
      (await createResponse.json()) as DataResponse<{
        id: number;
        status: string;
      }>
    ).data;
    enrollmentIds.push(firstEnrollment.id);
    assert.equal(firstEnrollment.status, 'active');

    const duplicateResponse = await fetch(`${baseUrl}/enrollments`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        student_user_id: studentId,
        classroom_id: classroomIds[1],
        enrolled_at: effectiveDate,
      }),
    });
    assert.equal(duplicateResponse.status, 409);

    const studentListForbidden = await fetch(`${baseUrl}/enrollments`, {
      headers: studentHeaders,
    });
    assert.equal(studentListForbidden.status, 403);

    const ownHistoryBefore = await fetch(`${baseUrl}/enrollments/me`, {
      headers: studentHeaders,
    });
    assert.equal(ownHistoryBefore.status, 200);
    assert.equal(
      ((await ownHistoryBefore.json()) as DataResponse<unknown[]>).data.length,
      1,
    );

    const ownClass = await fetch(
      `${baseUrl}/classrooms/${classroomIds[0]}`,
      { headers: studentHeaders },
    );
    assert.equal(ownClass.status, 200);
    const otherClass = await fetch(
      `${baseUrl}/classrooms/${classroomIds[1]}`,
      { headers: studentHeaders },
    );
    assert.equal(otherClass.status, 403);

    const transferResponse = await fetch(
      `${baseUrl}/enrollments/${firstEnrollment.id}/transfer`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          target_classroom_id: classroomIds[1],
          effective_date: effectiveDate,
          note: 'Atomic transfer smoke test',
        }),
      },
    );
    assert.equal(transferResponse.status, 201);
    const transferredTo = (
      (await transferResponse.json()) as DataResponse<{
        id: number;
        previous_enrollment_id: number;
        status: string;
      }>
    ).data;
    enrollmentIds.push(transferredTo.id);
    assert.equal(transferredTo.previous_enrollment_id, firstEnrollment.id);
    assert.equal(transferredTo.status, 'active');

    assert.equal(
      (
        await fetch(`${baseUrl}/classrooms/${classroomIds[0]}`, {
          headers: studentHeaders,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(`${baseUrl}/classrooms/${classroomIds[1]}`, {
          headers: studentHeaders,
        })
      ).status,
      200,
    );

    const historyResponse = await fetch(
      `${baseUrl}/enrollments/students/${studentId}`,
      { headers: adminHeaders },
    );
    assert.equal(historyResponse.status, 200);
    const history = (
      (await historyResponse.json()) as DataResponse<
        Array<{ status: string }>
      >
    ).data;
    assert.equal(history.length, 2);
    assert.deepEqual(
      new Set(history.map((item) => item.status)),
      new Set(['active', 'transferred']),
    );

    const classDeleteBlocked = await fetch(
      `${baseUrl}/classrooms/${classroomIds[0]}`,
      { method: 'DELETE', headers: adminHeaders },
    );
    assert.equal(classDeleteBlocked.status, 409);

    const endResponse = await fetch(
      `${baseUrl}/enrollments/${transferredTo.id}/status`,
      {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({
          status: 'reserved',
          effective_date: effectiveDate,
          note: 'Reservation smoke test',
        }),
      },
    );
    assert.equal(endResponse.status, 200);
    assert.equal(
      (
        await fetch(`${baseUrl}/classrooms/${classroomIds[1]}`, {
          headers: studentHeaders,
        })
      ).status,
      403,
    );

    const compatibilityAdd = await fetch(
      `${baseUrl}/classrooms/${classroomIds[0]}/members`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ user_id: studentId, role: 'student' }),
      },
    );
    assert.equal(compatibilityAdd.status, 201);
    const compatibilityMembers = (
      (await compatibilityAdd.json()) as DataResponse<
        Array<{ id: number; user_id: number; role: string }>
      >
    ).data;
    const compatibilityStudent = compatibilityMembers.find(
      (member) => member.user_id === studentId && member.role === 'student',
    );
    assert.ok(compatibilityStudent);
    assert.equal(
      (
        await fetch(`${baseUrl}/classrooms/${classroomIds[0]}`, {
          headers: studentHeaders,
        })
      ).status,
      200,
    );

    const compatibilityRemove = await fetch(
      `${baseUrl}/classrooms/${classroomIds[0]}/members/${compatibilityStudent.id}?role=student`,
      { method: 'DELETE', headers: adminHeaders },
    );
    assert.equal(compatibilityRemove.status, 204);
    assert.equal(
      (
        await fetch(`${baseUrl}/classrooms/${classroomIds[0]}`, {
          headers: studentHeaders,
        })
      ).status,
      403,
    );

    const activeConflicts = await postgresPool.query<{ total: number }>(
      `
        SELECT COUNT(*)::int AS total
        FROM (
          SELECT student_user_id, academic_year_id
          FROM student_enrollments
          WHERE status = 'active'
          GROUP BY student_user_id, academic_year_id
          HAVING COUNT(*) > 1
        ) conflict
      `,
    );
    assert.equal(activeConflicts.rows[0].total, 0);

    console.log(
      'Student enrollment history, transfer, and classroom scope smoke test passed.',
    );
  } finally {
    if (studentId) {
      await postgresPool.query(
        'DELETE FROM student_enrollments WHERE student_user_id = $1',
        [studentId],
      );
    }
    if (classroomIds.length) {
      await postgresPool.query(
        'DELETE FROM classrooms WHERE id = ANY($1::bigint[])',
        [classroomIds],
      );
    }
    if (adminId || studentId) {
      await postgresPool.query(
        'DELETE FROM users WHERE id = ANY($1::bigint[])',
        [[adminId, studentId].filter(Boolean)],
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
