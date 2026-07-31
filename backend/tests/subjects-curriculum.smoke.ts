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
  role: 'admin' | 'teacher',
) {
  const result = await postgresPool.query<{ id: number }>(
    `
      INSERT INTO users (email, full_name, password_hash, status)
      VALUES ($1, $2, $3, 'active')
      RETURNING id
    `,
    [email, `Subject smoke ${role}`, await hashPassword(password)],
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
  const password = 'subject-curriculum-test';
  const adminEmail = `subject-admin-${suffix}@pct.local`;
  const teacherEmail = `subject-teacher-${suffix}@pct.local`;
  let adminId: number | undefined;
  let teacherId: number | undefined;
  let subjectId: number | undefined;
  let curriculumId: number | undefined;
  let classroomId: number | undefined;
  let academicYearId: number | undefined;

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    adminId = await createUser(adminEmail, password, 'admin');
    teacherId = await createUser(teacherEmail, password, 'teacher');
    const maxYear = await postgresPool.query<{ year: number }>(
      `
        SELECT COALESCE(MAX(EXTRACT(YEAR FROM end_date)), 2099)::int + 2 AS year
        FROM academic_years
      `,
    );
    const startYear = Number(maxYear.rows[0].year);
    const academicYear = await postgresPool.query<{ id: number }>(
      `
        INSERT INTO academic_years (
          name,
          start_date,
          end_date,
          status,
          is_locked
        )
        VALUES ($1, $2, $3, 'planned', FALSE)
        RETURNING id
      `,
      [
        `SC-${startYear}-${String(suffix).slice(-6)}`,
        `${startYear}-09-01`,
        `${startYear + 1}-08-31`,
      ],
    );
    academicYearId = Number(academicYear.rows[0].id);

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
    const subjectInput = {
      code: `SMOKE_${suffix}`,
      name: `Mon smoke ${suffix}`,
      subject_group: 'other',
      is_active: true,
    };

    const teacherList = await fetch(`${baseUrl}/subjects?limit=5`, {
      headers: teacherHeaders,
    });
    assert.equal(teacherList.status, 200);

    const forbiddenCreate = await fetch(`${baseUrl}/subjects`, {
      method: 'POST',
      headers: teacherHeaders,
      body: JSON.stringify(subjectInput),
    });
    assert.equal(forbiddenCreate.status, 403);

    const createSubjectResponse = await fetch(`${baseUrl}/subjects`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(subjectInput),
    });
    assert.equal(createSubjectResponse.status, 201);
    subjectId = (
      (await createSubjectResponse.json()) as DataResponse<{ id: number }>
    ).data.id;

    const duplicateSubject = await fetch(`${baseUrl}/subjects`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(subjectInput),
    });
    assert.equal(duplicateSubject.status, 409);

    const curriculumInput = {
      academic_year_id: academicYearId,
      subject_id: subjectId,
      grade_level: 12,
      periods_per_week: 2.5,
      is_required: true,
      is_active: true,
    };
    const createCurriculumResponse = await fetch(
      `${baseUrl}/subjects/curriculum`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify(curriculumInput),
      },
    );
    assert.equal(createCurriculumResponse.status, 201);
    curriculumId = (
      (await createCurriculumResponse.json()) as DataResponse<{ id: number }>
    ).data.id;

    const duplicateCurriculum = await fetch(
      `${baseUrl}/subjects/curriculum`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify(curriculumInput),
      },
    );
    assert.equal(duplicateCurriculum.status, 409);

    const teacherCurriculum = await fetch(
      `${baseUrl}/subjects/curriculum?academic_year_id=${academicYearId}&grade_level=12`,
      { headers: teacherHeaders },
    );
    assert.equal(teacherCurriculum.status, 200);

    const createClassroomResponse = await fetch(`${baseUrl}/classrooms`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: `Subject Smoke ${suffix}`,
        academic_year_id: academicYearId,
        grade_level: 12,
        is_active: true,
      }),
    });
    assert.equal(createClassroomResponse.status, 201);
    classroomId = (
      (await createClassroomResponse.json()) as DataResponse<{ id: number }>
    ).data.id;

    const timetableInput = {
      title: `Timetable smoke ${suffix}`,
      academic_year_id: academicYearId,
      is_active: true,
      items: [
        {
          day_of_week: 2,
          lesson_index: 1,
          subject_id: subjectId,
          subject_name: 'Client value must be normalized',
        },
      ],
    };
    const timetableResponse = await fetch(
      `${baseUrl}/classrooms/${classroomId}/timetable`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify(timetableInput),
      },
    );
    assert.equal(timetableResponse.status, 201);
    const timetable = (
      (await timetableResponse.json()) as DataResponse<{
        items: Array<{ subject_id: number; subject_name: string }>;
      }>
    ).data;
    assert.equal(timetable.items.length, 1);
    assert.equal(timetable.items[0].subject_id, subjectId);
    assert.equal(timetable.items[0].subject_name, subjectInput.name);

    const deactivateResponse = await fetch(`${baseUrl}/subjects/${subjectId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ is_active: false }),
    });
    assert.equal(deactivateResponse.status, 200);

    const inactiveCurriculum = await fetch(
      `${baseUrl}/subjects/curriculum`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          ...curriculumInput,
          grade_level: 11,
        }),
      },
    );
    assert.equal(inactiveCurriculum.status, 409);

    const inactiveTimetable = await fetch(
      `${baseUrl}/classrooms/${classroomId}/timetable`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify(timetableInput),
      },
    );
    assert.equal(inactiveTimetable.status, 409);

    const referencedDelete = await fetch(`${baseUrl}/subjects/${subjectId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    assert.equal(referencedDelete.status, 409);

    console.log('Subjects, curriculum, RBAC, and timetable smoke test passed.');
  } finally {
    if (classroomId) {
      await postgresPool.query('DELETE FROM classrooms WHERE id = $1', [
        classroomId,
      ]);
    }
    if (curriculumId) {
      await postgresPool.query(
        'DELETE FROM curriculum_subjects WHERE id = $1',
        [curriculumId],
      );
    }
    if (subjectId) {
      await postgresPool.query('DELETE FROM subjects WHERE id = $1', [
        subjectId,
      ]);
    }
    if (academicYearId) {
      await postgresPool.query('DELETE FROM academic_years WHERE id = $1', [
        academicYearId,
      ]);
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
