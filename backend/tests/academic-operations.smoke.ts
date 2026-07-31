import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { closeDatabasePool, postgresPool } from '../src/database/postgres.js';
import { hashPassword } from '../src/utils/password.js';

type LoginResponse = { accessToken: string };
type JobResponse = {
  data: {
    id: number;
    status: string;
    total_rows: number;
    valid_rows: number;
    invalid_rows: number;
    validation_errors?: Array<{ row: number; message: string }>;
  };
};

async function createUser(
  email: string,
  role: 'admin' | 'teacher' | 'student',
  password: string,
) {
  const result = await postgresPool.query<{ id: number }>(
    `INSERT INTO users (email, full_name, password_hash, status)
     VALUES ($1, $2, $3, 'active') RETURNING id`,
    [email, `Academic import ${role}`, await hashPassword(password)],
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

function csvForm(
  type: string,
  idempotencyKey: string,
  content: string,
) {
  const form = new FormData();
  form.append('type', type);
  form.append('idempotency_key', idempotencyKey);
  form.append('file', new Blob([content], { type: 'text/csv' }), 'import.csv');
  return form;
}

async function run() {
  const suffix = Date.now();
  const password = 'academic-operation-smoke-password';
  const userIds: number[] = [];
  const jobIds: number[] = [];
  let classroomId = 0;
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const year = await postgresPool.query<{
      id: number;
      name: string;
      start_date: string;
    }>(
      `SELECT id, name, start_date::text
       FROM academic_years
       WHERE status IN ('planned', 'active') AND is_locked = FALSE
       ORDER BY end_date DESC LIMIT 1`,
    );
    assert.ok(year.rows[0], 'An unlocked academic year is required');
    const adminEmail = `academic-import-admin-${suffix}@pct.local`;
    const teacherEmail = `academic-import-teacher-${suffix}@pct.local`;
    const studentEmail = `academic-import-student-${suffix}@pct.local`;
    const largeStudentEmail = `academic-import-large-${suffix}@pct.local`;
    const adminId = await createUser(adminEmail, 'admin', password);
    const teacherId = await createUser(teacherEmail, 'teacher', password);
    const studentId = await createUser(studentEmail, 'student', password);
    const largeStudentId = await createUser(
      largeStudentEmail,
      'student',
      password,
    );
    userIds.push(adminId, teacherId, studentId, largeStudentId);
    const studentCode = `IMP${suffix}`;
    const largeStudentCode = `BIG${suffix}`;
    await postgresPool.query(
      `INSERT INTO student_profiles (user_id, student_code, full_name)
       VALUES ($1, $2, 'Import Student'), ($3, $4, 'Large Import Student')`,
      [studentId, studentCode, largeStudentId, largeStudentCode],
    );
    const classroom = await postgresPool.query<{ id: number }>(
      `INSERT INTO classrooms (
        name, school_year, academic_year_id, grade_level, is_active
      ) VALUES ($1, $2, $3, 12, TRUE) RETURNING id`,
      [
        `Academic Import ${suffix}`,
        year.rows[0].name,
        year.rows[0].id,
      ],
    );
    classroomId = Number(classroom.rows[0].id);

    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    const admin = await login(baseUrl, adminEmail, password);
    const teacher = await login(baseUrl, teacherEmail, password);
    const adminHeaders = { Authorization: `Bearer ${admin.accessToken}` };
    const validCsv = [
      'student_code,classroom_id,enrolled_at,note',
      `${studentCode},${classroomId},${year.rows[0].start_date},CSV smoke`,
    ].join('\n');
    const key = `academic-import-${suffix}`;

    const denied = await fetch(`${baseUrl}/academic-operations/imports/preview`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacher.accessToken}` },
      body: csvForm('enrollments', `${key}-denied`, validCsv),
    });
    assert.equal(denied.status, 403);

    const previewResponse = await fetch(
      `${baseUrl}/academic-operations/imports/preview`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: csvForm('enrollments', key, validCsv),
      },
    );
    assert.equal(previewResponse.status, 201);
    const preview = (await previewResponse.json()) as JobResponse;
    jobIds.push(preview.data.id);
    assert.equal(
      preview.data.valid_rows,
      1,
      JSON.stringify(preview.data.validation_errors),
    );
    assert.equal(preview.data.invalid_rows, 0);
    const detailResponse = await fetch(
      `${baseUrl}/academic-operations/imports/${preview.data.id}`,
      { headers: adminHeaders },
    );
    assert.equal(detailResponse.status, 200);
    const listResponse = await fetch(
      `${baseUrl}/academic-operations/imports?page=1&limit=10`,
      { headers: adminHeaders },
    );
    assert.equal(listResponse.status, 200);

    const retryResponse = await fetch(
      `${baseUrl}/academic-operations/imports/preview`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: csvForm('enrollments', key, validCsv),
      },
    );
    assert.equal(retryResponse.status, 201);
    const retry = (await retryResponse.json()) as JobResponse;
    assert.equal(retry.data.id, preview.data.id);

    const mismatch = await fetch(
      `${baseUrl}/academic-operations/imports/preview`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: csvForm(
          'enrollments',
          key,
          validCsv.replace('CSV smoke', 'different'),
        ),
      },
    );
    assert.equal(mismatch.status, 409);

    const commitResponse = await fetch(
      `${baseUrl}/academic-operations/imports/${preview.data.id}/commit`,
      { method: 'POST', headers: adminHeaders },
    );
    assert.equal(commitResponse.status, 200);
    const committed = (await commitResponse.json()) as JobResponse;
    assert.equal(committed.data.status, 'completed');
    const enrollment = await postgresPool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM student_enrollments
       WHERE student_user_id = $1 AND classroom_id = $2 AND status = 'active'`,
      [studentId, classroomId],
    );
    assert.equal(enrollment.rows[0].total, 1);

    const retryCommit = await fetch(
      `${baseUrl}/academic-operations/imports/${preview.data.id}/commit`,
      { method: 'POST', headers: adminHeaders },
    );
    assert.equal(retryCommit.status, 200);
    const enrollmentAfterRetry = await postgresPool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM student_enrollments
       WHERE student_user_id = $1 AND classroom_id = $2`,
      [studentId, classroomId],
    );
    assert.equal(enrollmentAfterRetry.rows[0].total, 1);

    const largeRows = Array.from(
      { length: 1001 },
      () =>
        `${largeStudentCode},${classroomId},${year.rows[0].start_date},bulk`,
    );
    const largePreviewResponse = await fetch(
      `${baseUrl}/academic-operations/imports/preview`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: csvForm(
          'enrollments',
          `${key}-large`,
          [
            'student_code,classroom_id,enrolled_at,note',
            ...largeRows,
          ].join('\n'),
        ),
      },
    );
    assert.equal(largePreviewResponse.status, 201);
    const largePreview = (await largePreviewResponse.json()) as JobResponse;
    jobIds.push(largePreview.data.id);
    assert.equal(largePreview.data.total_rows, 1001);
    assert.equal(largePreview.data.valid_rows, 1);
    assert.equal(largePreview.data.invalid_rows, 1000);
    const blockedCommit = await fetch(
      `${baseUrl}/academic-operations/imports/${largePreview.data.id}/commit`,
      { method: 'POST', headers: adminHeaders },
    );
    assert.equal(blockedCommit.status, 409);
    const errorsExport = await fetch(
      `${baseUrl}/academic-operations/imports/${largePreview.data.id}/errors`,
      { headers: adminHeaders },
    );
    assert.equal(errorsExport.status, 200);
    assert.match(await errorsExport.text(), /active enrollment/);

    const formulaResponse = await fetch(
      `${baseUrl}/academic-operations/imports/preview`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: csvForm(
          'enrollments',
          `${key}-formula`,
          [
            'student_code,classroom_id,enrolled_at,note',
            `${largeStudentCode},${classroomId},${year.rows[0].start_date},=1+1`,
          ].join('\n'),
        ),
      },
    );
    assert.equal(formulaResponse.status, 400);
    assert.match(await formulaResponse.text(), /formula/i);

    const template = await fetch(
      `${baseUrl}/academic-operations/templates/enrollments`,
      { headers: adminHeaders },
    );
    assert.equal(template.status, 200);
    const templateBytes = new Uint8Array(await template.arrayBuffer());
    assert.deepEqual([...templateBytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
    const roster = await fetch(
      `${baseUrl}/academic-operations/exports/roster?classroom_id=${classroomId}`,
      { headers: adminHeaders },
    );
    assert.equal(roster.status, 200);
    assert.match(await roster.text(), /student_code/);
    const report = await fetch(
      `${baseUrl}/academic-operations/reports/summary?classroom_id=${classroomId}`,
      { headers: adminHeaders },
    );
    assert.equal(report.status, 200);

    console.log(
      'Academic CSV preview, validation, atomic commit, idempotency, large batch, permission and export smoke test passed.',
    );
  } finally {
    const client = await postgresPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "SET LOCAL app.allow_academic_import_cleanup = 'on'",
      );
      if (jobIds.length) {
        await client.query(
          'DELETE FROM academic_import_jobs WHERE id = ANY($1::bigint[])',
          [jobIds],
        );
      }
      await client.query(
        'DELETE FROM student_enrollments WHERE student_user_id = ANY($1::bigint[])',
        [userIds],
      );
      if (classroomId) {
        await client.query('DELETE FROM classrooms WHERE id = $1', [classroomId]);
      }
      if (userIds.length) {
        await client.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [
          userIds,
        ]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
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
