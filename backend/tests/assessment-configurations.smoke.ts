import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { closeDatabasePool, postgresPool } from '../src/database/postgres.js';
import { hashPassword } from '../src/utils/password.js';

type LoginResponse = {
  accessToken: string;
  user: { id: number; roles: string[]; permissions: string[] };
};
type DataResponse<T> = { data: T };

async function createUser(
  email: string,
  password: string,
  role: 'admin' | 'teacher',
) {
  const result = await postgresPool.query<{ id: number }>(
    `INSERT INTO users (email, full_name, password_hash, status)
     VALUES ($1, $2, $3, 'active')
     RETURNING id`,
    [email, `Assessment smoke ${role}`, await hashPassword(password)],
  );
  const id = Number(result.rows[0].id);
  await postgresPool.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles WHERE name = $2`,
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
  const password = 'assessment-config-test';
  const userIds: number[] = [];
  const configurationIds: number[] = [];
  let subjectId: number | undefined;
  let curriculumId: number | undefined;
  let classroomId: number | undefined;
  let assignmentId: number | undefined;
  let semesterId: number | undefined;
  let originalSemesterLocked = false;

  const period = await postgresPool.query<{
    academic_year_id: number;
    semester_id: number;
    start_date: string;
    is_locked: boolean;
  }>(
    `SELECT year_record.id AS academic_year_id,
       semester.id AS semester_id,
       semester.start_date::text AS start_date,
       semester.is_locked
     FROM academic_years year_record
     JOIN semesters semester ON semester.academic_year_id = year_record.id
     WHERE year_record.status <> 'closed'
       AND year_record.is_locked = FALSE
       AND semester.status <> 'closed'
       AND semester.is_locked = FALSE
     ORDER BY year_record.start_date DESC, semester.start_date
     LIMIT 1`,
  );
  assert.ok(period.rows[0], 'A writable semester is required');
  const academicYearId = Number(period.rows[0].academic_year_id);
  semesterId = Number(period.rows[0].semester_id);
  originalSemesterLocked = Boolean(period.rows[0].is_locked);
  const assignedAt = period.rows[0].start_date;

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const adminEmail = `assessment-admin-${suffix}@pct.local`;
    const teacherEmail = `assessment-teacher-${suffix}@pct.local`;
    const outsiderEmail = `assessment-outsider-${suffix}@pct.local`;
    const adminId = await createUser(adminEmail, password, 'admin');
    const teacherId = await createUser(teacherEmail, password, 'teacher');
    const outsiderId = await createUser(outsiderEmail, password, 'teacher');
    userIds.push(adminId, teacherId, outsiderId);

    const subject = await postgresPool.query<{ id: number }>(
      `INSERT INTO subjects (code, name, subject_group)
       VALUES ($1, $2, 'other')
       RETURNING id`,
      [`ASSESS_${suffix}`, `Assessment subject ${suffix}`],
    );
    subjectId = Number(subject.rows[0].id);
    const curriculum = await postgresPool.query<{ id: number }>(
      `INSERT INTO curriculum_subjects (
         academic_year_id, subject_id, grade_level, periods_per_week
       )
       VALUES ($1, $2, 11, 2)
       RETURNING id`,
      [academicYearId, subjectId],
    );
    curriculumId = Number(curriculum.rows[0].id);
    const classroom = await postgresPool.query<{ id: number }>(
      `INSERT INTO classrooms (
         name, school_year, academic_year_id, grade_level, is_active
       )
       VALUES ($1, (SELECT name FROM academic_years WHERE id = $2), $2, 11, TRUE)
       RETURNING id`,
      [`Assessment ${suffix}`, academicYearId],
    );
    classroomId = Number(classroom.rows[0].id);
    const assignment = await postgresPool.query<{ id: number }>(
      `INSERT INTO teaching_assignments (
         teacher_user_id, classroom_id, subject_id, semester_id, assigned_at
       )
       VALUES ($1, $2, $3, $4, $5::date)
       RETURNING id`,
      [teacherId, classroomId, subjectId, semesterId, assignedAt],
    );
    assignmentId = Number(assignment.rows[0].id);

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const admin = await login(baseUrl, adminEmail, password);
    const teacher = await login(baseUrl, teacherEmail, password);
    const outsider = await login(baseUrl, outsiderEmail, password);
    const adminHeaders = {
      Authorization: `Bearer ${admin.accessToken}`,
      'Content-Type': 'application/json',
    };
    const teacherHeaders = {
      Authorization: `Bearer ${teacher.accessToken}`,
      'Content-Type': 'application/json',
    };
    const outsiderHeaders = {
      Authorization: `Bearer ${outsider.accessToken}`,
      'Content-Type': 'application/json',
    };
    const validBody = {
      subject_id: subjectId,
      semester_id: semesterId,
      grade_level: 11,
      title: 'Assessment configuration smoke',
      score_scale: 10,
      decimal_places: 1,
      rounding_mode: 'half_up',
      categories: [
        {
          code: 'TX',
          name: 'Thường xuyên',
          weight_percent: 40,
          coefficient: 1,
          max_entries: 4,
          score_scale: 10,
          sort_order: 0,
        },
        {
          code: 'CK',
          name: 'Cuối kỳ',
          weight_percent: 60,
          coefficient: 3,
          max_entries: 1,
          score_scale: 10,
          sort_order: 1,
        },
      ],
    };

    const invalidWeight = await fetch(`${baseUrl}/assessment-configurations`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        ...validBody,
        categories: validBody.categories.map((category) => ({
          ...category,
          weight_percent: 40,
        })),
      }),
    });
    assert.equal(invalidWeight.status, 400);

    const createResponse = await fetch(
      `${baseUrl}/assessment-configurations`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify(validBody),
      },
    );
    assert.equal(createResponse.status, 201);
    const first = (
      (await createResponse.json()) as DataResponse<{
        id: number;
        status: string;
        version: number;
      }>
    ).data;
    configurationIds.push(first.id);
    assert.equal(first.status, 'draft');
    assert.equal(first.version, 1);

    const teacherDraft = await fetch(
      `${baseUrl}/assessment-configurations/${first.id}`,
      { headers: teacherHeaders },
    );
    assert.equal(teacherDraft.status, 403);
    const teacherCreate = await fetch(
      `${baseUrl}/assessment-configurations`,
      {
        method: 'POST',
        headers: teacherHeaders,
        body: JSON.stringify(validBody),
      },
    );
    assert.equal(teacherCreate.status, 403);

    const activateFirst = await fetch(
      `${baseUrl}/assessment-configurations/${first.id}/activate`,
      { method: 'POST', headers: adminHeaders },
    );
    assert.equal(activateFirst.status, 200);

    const teacherList = await fetch(
      `${baseUrl}/assessment-configurations/me?limit=100`,
      { headers: teacherHeaders },
    );
    assert.equal(teacherList.status, 200);
    const teacherRows = (
      (await teacherList.json()) as { data: Array<{ id: number }> }
    ).data;
    assert.ok(teacherRows.some((row) => row.id === first.id));

    const outsiderDetail = await fetch(
      `${baseUrl}/assessment-configurations/${first.id}`,
      { headers: outsiderHeaders },
    );
    assert.equal(outsiderDetail.status, 403);

    const calculation = await fetch(
      `${baseUrl}/assessment-configurations/${first.id}/calculate`,
      {
        method: 'POST',
        headers: teacherHeaders,
        body: JSON.stringify({
          scores: [
            { category_code: 'TX', values: [8, 9] },
            { category_code: 'CK', values: [7.5] },
          ],
        }),
      },
    );
    assert.equal(calculation.status, 200);
    assert.equal(
      (
        (await calculation.json()) as DataResponse<{ final_score: number }>
      ).data.final_score,
      7.9,
    );

    const activeUpdate = await fetch(
      `${baseUrl}/assessment-configurations/${first.id}`,
      {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ title: 'Must not mutate history' }),
      },
    );
    assert.equal(activeUpdate.status, 409);

    const versionResponse = await fetch(
      `${baseUrl}/assessment-configurations/${first.id}/versions`,
      { method: 'POST', headers: adminHeaders },
    );
    assert.equal(versionResponse.status, 201);
    const second = (
      (await versionResponse.json()) as DataResponse<{
        id: number;
        version: number;
        status: string;
      }>
    ).data;
    configurationIds.push(second.id);
    assert.equal(second.version, 2);
    assert.equal(second.status, 'draft');

    await postgresPool.query(
      'UPDATE semesters SET is_locked = TRUE WHERE id = $1',
      [semesterId],
    );
    const lockedUpdate = await fetch(
      `${baseUrl}/assessment-configurations/${second.id}`,
      {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ title: 'Locked update' }),
      },
    );
    assert.equal(lockedUpdate.status, 409);
    await postgresPool.query(
      'UPDATE semesters SET is_locked = $1 WHERE id = $2',
      [originalSemesterLocked, semesterId],
    );

    const draftUpdate = await fetch(
      `${baseUrl}/assessment-configurations/${second.id}`,
      {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ title: 'Assessment configuration version 2' }),
      },
    );
    assert.equal(draftUpdate.status, 200);
    const activateSecond = await fetch(
      `${baseUrl}/assessment-configurations/${second.id}/activate`,
      { method: 'POST', headers: adminHeaders },
    );
    assert.equal(activateSecond.status, 200);

    const firstDetail = await fetch(
      `${baseUrl}/assessment-configurations/${first.id}`,
      { headers: adminHeaders },
    );
    assert.equal(firstDetail.status, 200);
    assert.equal(
      (
        (await firstDetail.json()) as DataResponse<{ status: string }>
      ).data.status,
      'archived',
    );

    await assert.rejects(
      postgresPool.query(
        `UPDATE assessment_configurations
         SET title = 'Raw mutation must fail'
         WHERE id = $1`,
        [first.id],
      ),
      /immutable/,
    );

    console.log(
      'Assessment configuration versioning, RBAC, lock, and formula smoke test passed.',
    );
  } finally {
    if (semesterId) {
      await postgresPool.query(
        'UPDATE semesters SET is_locked = $1 WHERE id = $2',
        [originalSemesterLocked, semesterId],
      );
    }
    if (configurationIds.length) {
      await postgresPool.query(
        'DELETE FROM assessment_configurations WHERE id = ANY($1::bigint[])',
        [configurationIds],
      );
    }
    if (assignmentId) {
      await postgresPool.query(
        'DELETE FROM teaching_assignments WHERE id = $1',
        [assignmentId],
      );
    }
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
    if (userIds.length) {
      await postgresPool.query(
        'DELETE FROM users WHERE id = ANY($1::bigint[])',
        [userIds],
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
