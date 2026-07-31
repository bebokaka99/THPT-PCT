import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { closeDatabasePool, postgresPool } from '../src/database/postgres.js';
import { hashPassword } from '../src/utils/password.js';
import { createStudentTranscriptSnapshot } from '../src/modules/transcripts/transcript.service.js';

type LoginResponse = { accessToken: string };

async function createUser(
  email: string,
  password: string,
  role: 'admin' | 'teacher' | 'student',
  fullName: string,
) {
  const result = await postgresPool.query<{ id: number }>(
    `INSERT INTO users (email, full_name, password_hash, status)
     VALUES ($1, $2, $3, 'active') RETURNING id`,
    [email, fullName, await hashPassword(password)],
  );
  const id = Number(result.rows[0].id);
  await postgresPool.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles WHERE name = $2`,
    [id, role],
  );
  return id;
}

async function login(baseUrl: string, identifier: string, password: string) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
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
  const password = 'conduct-smoke-password';
  const userIds: number[] = [];
  let classroomId = 0;
  let recordId = 0;
  let semesterLockedForSnapshot = false;
  const period = await postgresPool.query<{
    academic_year_id: number;
    academic_year_name: string;
    semester_id: number;
    start_date: string;
  }>(
    `SELECT academic_year.id AS academic_year_id,
       academic_year.name AS academic_year_name,
       semester.id AS semester_id,
       semester.start_date::text
     FROM academic_years academic_year
     JOIN semesters semester ON semester.academic_year_id = academic_year.id
     WHERE academic_year.status <> 'closed'
       AND academic_year.is_locked = FALSE
       AND semester.status <> 'closed'
       AND semester.is_locked = FALSE
     ORDER BY semester.end_date DESC
     LIMIT 1`,
  );
  assert.ok(period.rows[0], 'A writable semester is required');
  const academicYearId = Number(period.rows[0].academic_year_id);
  const semesterId = Number(period.rows[0].semester_id);

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const teacherEmail = `conduct-homeroom-${suffix}@pct.local`;
    const outsiderEmail = `conduct-outsider-${suffix}@pct.local`;
    const studentEmail = `conduct-student-${suffix}@pct.local`;
    const adminEmail = `conduct-admin-${suffix}@pct.local`;
    const teacherId = await createUser(
      teacherEmail,
      password,
      'teacher',
      'Conduct Homeroom Teacher',
    );
    const outsiderId = await createUser(
      outsiderEmail,
      password,
      'teacher',
      'Conduct Outside Teacher',
    );
    const studentId = await createUser(
      studentEmail,
      password,
      'student',
      'Conduct Student',
    );
    const adminId = await createUser(
      adminEmail,
      password,
      'admin',
      'Conduct Reviewer',
    );
    userIds.push(teacherId, outsiderId, studentId, adminId);

    const classroom = await postgresPool.query<{ id: number }>(
      `INSERT INTO classrooms (
         name, school_year, academic_year_id, grade_level,
         homeroom_teacher_user_id, is_active
       ) VALUES ($1, $2, $3, 12, $4, TRUE) RETURNING id`,
      [
        `Conduct Smoke ${suffix}`,
        period.rows[0].academic_year_name,
        academicYearId,
        teacherId,
      ],
    );
    classroomId = Number(classroom.rows[0].id);
    await postgresPool.query(
      `INSERT INTO student_enrollments (
         student_user_id, classroom_id, academic_year_id, status,
         enrolled_at, created_by_user_id
       ) VALUES ($1, $2, $3, 'active', $4, $5)`,
      [
        studentId,
        classroomId,
        academicYearId,
        period.rows[0].start_date,
        adminId,
      ],
    );

    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    const teacher = await login(baseUrl, teacherEmail, password);
    const outsider = await login(baseUrl, outsiderEmail, password);
    const student = await login(baseUrl, studentEmail, password);
    const admin = await login(baseUrl, adminEmail, password);

    const outsiderRoster = await fetch(
      `${baseUrl}/conduct?classroom_id=${classroomId}&semester_id=${semesterId}`,
      { headers: headers(outsider.accessToken) },
    );
    assert.equal(outsiderRoster.status, 403);

    const homeroomRoster = await fetch(
      `${baseUrl}/conduct?classroom_id=${classroomId}&semester_id=${semesterId}`,
      { headers: headers(teacher.accessToken) },
    );
    assert.equal(homeroomRoster.status, 200);
    const homeroomRosterBody = (await homeroomRoster.json()) as {
      data: Array<{ student_user_id: number; record: unknown }>;
    };
    assert.equal(homeroomRosterBody.data.length, 1);
    assert.equal(homeroomRosterBody.data[0].student_user_id, studentId);
    assert.equal(homeroomRosterBody.data[0].record, null);

    const saved = await fetch(`${baseUrl}/conduct/students/${studentId}`, {
      method: 'PUT',
      headers: headers(teacher.accessToken),
      body: JSON.stringify({
        semester_id: semesterId,
        rating: 'good',
        homeroom_comment: 'Có ý thức học tập và rèn luyện tốt.',
      }),
    });
    assert.equal(saved.status, 200);
    const savedBody = (await saved.json()) as {
      data: { id: number; status: string };
    };
    recordId = savedBody.data.id;
    assert.equal(savedBody.data.status, 'draft');

    const draftForStudent = await fetch(
      `${baseUrl}/conduct/me?semester_id=${semesterId}`,
      { headers: headers(student.accessToken) },
    );
    assert.equal(draftForStudent.status, 200);
    assert.equal(((await draftForStudent.json()) as { data: unknown }).data, null);

    const submitted = await fetch(`${baseUrl}/conduct/${recordId}/submit`, {
      method: 'POST',
      headers: headers(teacher.accessToken),
      body: '{}',
    });
    assert.equal(submitted.status, 200);

    const teacherApprove = await fetch(`${baseUrl}/conduct/${recordId}/approve`, {
      method: 'POST',
      headers: headers(teacher.accessToken),
      body: '{}',
    });
    assert.equal(teacherApprove.status, 403);

    const approved = await fetch(`${baseUrl}/conduct/${recordId}/approve`, {
      method: 'POST',
      headers: headers(admin.accessToken),
      body: '{}',
    });
    assert.equal(approved.status, 200);

    const publishedForStudent = await fetch(
      `${baseUrl}/conduct/me?semester_id=${semesterId}`,
      { headers: headers(student.accessToken) },
    );
    assert.equal(publishedForStudent.status, 200);
    const publishedBody = (await publishedForStudent.json()) as {
      data: { rating: string; homeroom_comment: string };
    };
    assert.equal(publishedBody.data.rating, 'good');
    assert.match(publishedBody.data.homeroom_comment, /rèn luyện tốt/u);

    const transcript = await fetch(
      `${baseUrl}/transcripts/students/${studentId}?semester_id=${semesterId}`,
      { headers: headers(admin.accessToken) },
    );
    assert.equal(transcript.status, 200);
    const transcriptBody = (await transcript.json()) as {
      data: { conduct: { rating: string; homeroom_comment: string } | null };
    };
    assert.equal(transcriptBody.data.conduct?.rating, 'good');
    assert.match(
      transcriptBody.data.conduct?.homeroom_comment ?? '',
      /rèn luyện tốt/u,
    );

    const locked = await fetch(`${baseUrl}/conduct/${recordId}/lock`, {
      method: 'POST',
      headers: headers(admin.accessToken),
      body: '{}',
    });
    assert.equal(locked.status, 200);
    assert.equal(
      await createStudentTranscriptSnapshot(studentId, semesterId, adminId),
      true,
    );
    await postgresPool.query(
      'UPDATE semesters SET is_locked = TRUE WHERE id = $1',
      [semesterId],
    );
    semesterLockedForSnapshot = true;
    const historicalTranscript = await fetch(
      `${baseUrl}/transcripts/students/${studentId}?semester_id=${semesterId}`,
      { headers: headers(admin.accessToken) },
    );
    assert.equal(historicalTranscript.status, 200);
    const historicalBody = (await historicalTranscript.json()) as {
      data: {
        source: string;
        conduct: { rating: string; homeroom_comment: string } | null;
      };
    };
    assert.equal(historicalBody.data.source, 'snapshot');
    assert.equal(historicalBody.data.conduct?.rating, 'good');
    await postgresPool.query(
      'UPDATE semesters SET is_locked = FALSE WHERE id = $1',
      [semesterId],
    );
    semesterLockedForSnapshot = false;

    const editLocked = await fetch(`${baseUrl}/conduct/students/${studentId}`, {
      method: 'PUT',
      headers: headers(teacher.accessToken),
      body: JSON.stringify({
        semester_id: semesterId,
        rating: 'fair',
        homeroom_comment: 'Attempted locked edit.',
      }),
    });
    assert.equal(editLocked.status, 409);

    const audit = await fetch(`${baseUrl}/conduct/${recordId}/audit`, {
      headers: headers(teacher.accessToken),
    });
    assert.equal(audit.status, 200);
    const auditBody = (await audit.json()) as {
      data: Array<{ action: string }>;
    };
    for (const action of ['create', 'submit', 'approve', 'lock']) {
      assert.ok(auditBody.data.some((item) => item.action === action));
    }
    await assert.rejects(
      postgresPool.query(
        'DELETE FROM student_conduct_audits WHERE conduct_record_id = $1',
        [recordId],
      ),
      /immutable/i,
    );

    console.log(
      'Conduct homeroom scope, draft privacy, approval, locking, audit, and transcript integration smoke test passed.',
    );
  } finally {
    if (semesterLockedForSnapshot) {
      await postgresPool.query(
        'UPDATE semesters SET is_locked = FALSE WHERE id = $1',
        [semesterId],
      );
    }
    if (recordId) {
      const client = await postgresPool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SET LOCAL app.allow_audit_cleanup = 'on'");
        await client.query("SET LOCAL app.allow_snapshot_cleanup = 'on'");
        await client.query(
          `DELETE FROM student_report_snapshot_subjects
           WHERE snapshot_id IN (
             SELECT id FROM student_report_snapshots
             WHERE student_user_id = ANY($1::bigint[]) AND semester_id = $2
           )`,
          [userIds, semesterId],
        );
        await client.query(
          `DELETE FROM student_report_snapshots
           WHERE student_user_id = ANY($1::bigint[]) AND semester_id = $2`,
          [userIds, semesterId],
        );
        await client.query(
          'DELETE FROM student_conduct_audits WHERE conduct_record_id = $1',
          [recordId],
        );
        await client.query(
          'DELETE FROM student_conduct_records WHERE id = $1',
          [recordId],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    if (classroomId) {
      await postgresPool.query(
        'DELETE FROM student_enrollments WHERE classroom_id = $1',
        [classroomId],
      );
      await postgresPool.query('DELETE FROM classrooms WHERE id = $1', [
        classroomId,
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
