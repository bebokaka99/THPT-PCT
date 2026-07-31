import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { closeDatabasePool, postgresPool } from '../src/database/postgres.js';
import { hashPassword } from '../src/utils/password.js';

type LoginResponse = {
  accessToken: string;
};

async function createUser(
  email: string,
  password: string,
  role: 'admin' | 'teacher',
) {
  const result = await postgresPool.query<{ id: number }>(
    `
      INSERT INTO users (email, full_name, password_hash, status)
      VALUES ($1, $2, $3, 'active')
      RETURNING id
    `,
    [email, `Academic Period ${role}`, await hashPassword(password)],
  );
  const id = Number(result.rows[0].id);
  await postgresPool.query(
    `
      INSERT INTO user_roles (user_id, role_id)
      SELECT $1, id FROM roles WHERE name = $2
    `,
    [id, role],
  );
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
  const password = 'academic-period-test';
  const adminEmail = `academic-admin-${suffix}@pct.local`;
  const teacherEmail = `academic-teacher-${suffix}@pct.local`;
  let adminId: number | undefined;
  let teacherId: number | undefined;
  let academicYearId: number | undefined;
  let semesterOneId: number | undefined;
  let semesterTwoId: number | undefined;
  let classroomId: number | undefined;

  const previousActiveYear = await postgresPool.query<{ id: number }>(
    `SELECT id FROM academic_years WHERE status = 'active' LIMIT 1`,
  );
  const previousActiveSemester = await postgresPool.query<{ id: number }>(
    `SELECT id FROM semesters WHERE status = 'active' LIMIT 1`,
  );

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    adminId = await createUser(adminEmail, password, 'admin');
    teacherId = await createUser(teacherEmail, password, 'teacher');
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const admin = await login(baseUrl, adminEmail, password);
    const teacher = await login(baseUrl, teacherEmail, password);
    const adminHeaders = {
      Authorization: `Bearer ${admin.accessToken}`,
      'Content-Type': 'application/json',
    };
    const teacherHeaders = {
      Authorization: `Bearer ${teacher.accessToken}`,
      'Content-Type': 'application/json',
    };

    const teacherList = await fetch(`${baseUrl}/academic-periods`, {
      headers: teacherHeaders,
    });
    assert.equal(teacherList.status, 200);

    const maxYear = await postgresPool.query<{ year: number }>(
      `
        SELECT COALESCE(MAX(EXTRACT(YEAR FROM end_date)), 2099)::int + 2 AS year
        FROM academic_years
      `,
    );
    const startYear = Number(maxYear.rows[0].year);
    const yearInput = {
      name: `Smoke-${startYear}`,
      start_date: `${startYear}-09-01`,
      end_date: `${startYear + 1}-08-31`,
    };

    const forbiddenCreate = await fetch(
      `${baseUrl}/academic-periods/years`,
      {
        method: 'POST',
        headers: teacherHeaders,
        body: JSON.stringify(yearInput),
      },
    );
    assert.equal(forbiddenCreate.status, 403);

    const createYearResponse = await fetch(
      `${baseUrl}/academic-periods/years`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify(yearInput),
      },
    );
    assert.equal(createYearResponse.status, 201);
    const createdYear = (await createYearResponse.json()) as {
      data: { id: number };
    };
    academicYearId = createdYear.data.id;

    const overlapResponse = await fetch(
      `${baseUrl}/academic-periods/years`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ ...yearInput, name: `Overlap-${startYear}` }),
      },
    );
    assert.equal(overlapResponse.status, 409);

    const createSemester = async (
      name: string,
      code: string,
      startDate: string,
      endDate: string,
    ) => {
      const response = await fetch(
        `${baseUrl}/academic-periods/years/${academicYearId}/semesters`,
        {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify({
            name,
            code,
            start_date: startDate,
            end_date: endDate,
          }),
        },
      );
      assert.equal(response.status, 201);
      return ((await response.json()) as { data: { id: number } }).data.id;
    };

    semesterOneId = await createSemester(
      'Học kỳ 1',
      'HK1',
      `${startYear}-09-01`,
      `${startYear + 1}-01-15`,
    );
    semesterTwoId = await createSemester(
      'Học kỳ 2',
      'HK2',
      `${startYear + 1}-01-16`,
      `${startYear + 1}-05-31`,
    );

    for (const semesterId of [semesterOneId, semesterTwoId]) {
      const response = await fetch(
        `${baseUrl}/academic-periods/semesters/${semesterId}/activate`,
        { method: 'PATCH', headers: adminHeaders },
      );
      assert.equal(response.status, 200);
    }
    const activeCount = await postgresPool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM semesters WHERE status = 'active'`,
    );
    assert.equal(activeCount.rows[0].total, 1);
    const activeSemester = await postgresPool.query<{ id: number }>(
      `SELECT id FROM semesters WHERE status = 'active'`,
    );
    assert.equal(Number(activeSemester.rows[0].id), semesterTwoId);

    const createClassroomResponse = await fetch(`${baseUrl}/classrooms`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: `Academic Smoke ${suffix}`,
        academic_year_id: academicYearId,
        is_active: true,
      }),
    });
    assert.equal(createClassroomResponse.status, 201);
    classroomId = (
      (await createClassroomResponse.json()) as { data: { id: number } }
    ).data.id;

    const closeSemesterResponse = await fetch(
      `${baseUrl}/academic-periods/semesters/${semesterTwoId}/close`,
      { method: 'PATCH', headers: adminHeaders },
    );
    assert.equal(closeSemesterResponse.status, 200);

    const closedWriteResponse = await fetch(
      `${baseUrl}/classrooms/${classroomId}/timetable`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          title: 'Must be rejected',
          academic_year_id: academicYearId,
          semester_id: semesterTwoId,
          items: [],
        }),
      },
    );
    assert.equal(closedWriteResponse.status, 409);

    console.log('Academic periods API and locking smoke test passed.');
  } finally {
    if (classroomId) {
      await postgresPool.query('DELETE FROM classrooms WHERE id = $1', [
        classroomId,
      ]);
    }
    if (academicYearId) {
      await postgresPool.query(
        'DELETE FROM semesters WHERE academic_year_id = $1',
        [academicYearId],
      );
      await postgresPool.query('DELETE FROM academic_years WHERE id = $1', [
        academicYearId,
      ]);
    }
    await postgresPool.query(
      `UPDATE semesters SET status = 'planned' WHERE status = 'active'`,
    );
    await postgresPool.query(
      `UPDATE academic_years SET status = 'planned' WHERE status = 'active'`,
    );
    if (previousActiveYear.rows[0]) {
      await postgresPool.query(
        `UPDATE academic_years SET status = 'active' WHERE id = $1`,
        [previousActiveYear.rows[0].id],
      );
    }
    if (previousActiveSemester.rows[0]) {
      await postgresPool.query(
        `UPDATE semesters SET status = 'active' WHERE id = $1`,
        [previousActiveSemester.rows[0].id],
      );
    }
    if (adminId || teacherId) {
      await postgresPool.query(
        'DELETE FROM users WHERE id = ANY($1::bigint[])',
        [[adminId, teacherId].filter(Boolean)],
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

