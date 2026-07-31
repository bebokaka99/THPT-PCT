import assert from 'node:assert/strict';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { closeDatabasePool, postgresPool } from '../src/database/postgres.js';
import { hashPassword } from '../src/utils/password.js';

type LoginResponse = { accessToken: string };
type RequestResponse = {
  data: {
    id: number;
    status: string;
    attachment_count: number;
    attachments?: Array<{ id: number }>;
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
    [email, `Request ${role}`, await hashPassword(password)],
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

function jsonHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function run() {
  const suffix = Date.now();
  const password = 'student-request-smoke-password';
  const userIds: number[] = [];
  const requestIds: number[] = [];
  const attachmentPaths: string[] = [];
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
       FROM academic_years ORDER BY end_date DESC LIMIT 1`,
    );
    assert.ok(year.rows[0], 'An academic year is required');
    const adminEmail = `request-admin-${suffix}@pct.local`;
    const teacherEmail = `request-teacher-${suffix}@pct.local`;
    const outsiderEmail = `request-outsider-${suffix}@pct.local`;
    const studentEmail = `request-student-${suffix}@pct.local`;
    const foreignEmail = `request-foreign-${suffix}@pct.local`;
    const adminId = await createUser(adminEmail, 'admin', password);
    const teacherId = await createUser(teacherEmail, 'teacher', password);
    const outsiderId = await createUser(outsiderEmail, 'teacher', password);
    const studentId = await createUser(studentEmail, 'student', password);
    const foreignId = await createUser(foreignEmail, 'student', password);
    userIds.push(adminId, teacherId, outsiderId, studentId, foreignId);

    const classroom = await postgresPool.query<{ id: number }>(
      `INSERT INTO classrooms (
         name, school_year, academic_year_id, grade_level,
         homeroom_teacher_user_id, is_active
       ) VALUES ($1, $2, $3, 12, $4, TRUE) RETURNING id`,
      [
        `Request Smoke ${suffix}`,
        year.rows[0].name,
        year.rows[0].id,
        teacherId,
      ],
    );
    classroomId = Number(classroom.rows[0].id);
    await postgresPool.query(
      `INSERT INTO student_enrollments (
         student_user_id, classroom_id, academic_year_id, status,
         enrolled_at, created_by_user_id
       ) VALUES ($1, $2, $3, 'active', $4::date, $5)`,
      [
        studentId,
        classroomId,
        year.rows[0].id,
        year.rows[0].start_date,
        adminId,
      ],
    );

    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    const admin = await login(baseUrl, adminEmail, password);
    const teacher = await login(baseUrl, teacherEmail, password);
    const outsider = await login(baseUrl, outsiderEmail, password);
    const student = await login(baseUrl, studentEmail, password);
    const foreign = await login(baseUrl, foreignEmail, password);

    const typesResponse = await fetch(`${baseUrl}/student-requests/types`, {
      headers: jsonHeaders(student.accessToken),
    });
    assert.equal(typesResponse.status, 200);
    const types = (await typesResponse.json()) as {
      data: Array<{ id: number; code: string }>;
    };
    const correctionType = types.data.find(
      (item) => item.code === 'PROFILE_CORRECTION',
    );
    const leaveType = types.data.find((item) => item.code === 'LEAVE_REQUEST');
    assert.ok(correctionType);
    assert.ok(leaveType);

    const createCorrection = await fetch(`${baseUrl}/student-requests`, {
      method: 'POST',
      headers: jsonHeaders(student.accessToken),
      body: JSON.stringify({
        request_type_id: correctionType.id,
        title: 'Correct student profile',
        content: 'Evidence attached',
      }),
    });
    assert.equal(createCorrection.status, 201);
    const correction = (await createCorrection.json()) as RequestResponse;
    requestIds.push(correction.data.id);

    const hiddenDraft = await fetch(
      `${baseUrl}/student-requests/${correction.data.id}`,
      { headers: jsonHeaders(admin.accessToken) },
    );
    assert.equal(hiddenDraft.status, 403);

    const submitWithoutFile = await fetch(
      `${baseUrl}/student-requests/${correction.data.id}/submit`,
      { method: 'POST', headers: jsonHeaders(student.accessToken) },
    );
    assert.equal(submitWithoutFile.status, 400);

    const form = new FormData();
    form.append(
      'file',
      new Blob(['%PDF-1.4 request smoke'], { type: 'application/pdf' }),
      'evidence.pdf',
    );
    const upload = await fetch(
      `${baseUrl}/student-requests/${correction.data.id}/attachments`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${student.accessToken}` },
        body: form,
      },
    );
    assert.equal(upload.status, 201);
    const uploadBody = (await upload.json()) as {
      data: Record<string, unknown>;
    };
    assert.equal('storage_path' in uploadBody.data, false);

    const correctionDetail = await fetch(
      `${baseUrl}/student-requests/${correction.data.id}`,
      { headers: jsonHeaders(student.accessToken) },
    );
    assert.equal(correctionDetail.status, 200);
    const detailed = (await correctionDetail.json()) as RequestResponse;
    assert.equal(detailed.data.attachment_count, 1);
    assert.equal(detailed.data.attachments?.length, 1);
    const attachmentId = detailed.data.attachments![0].id;

    const ownerDownload = await fetch(
      `${baseUrl}/student-requests/${correction.data.id}/attachments/${attachmentId}/download`,
      { headers: jsonHeaders(student.accessToken) },
    );
    assert.equal(ownerDownload.status, 200);
    const outsiderDownload = await fetch(
      `${baseUrl}/student-requests/${correction.data.id}/attachments/${attachmentId}/download`,
      { headers: jsonHeaders(outsider.accessToken) },
    );
    assert.equal(outsiderDownload.status, 403);

    const submitted = await fetch(
      `${baseUrl}/student-requests/${correction.data.id}/submit`,
      { method: 'POST', headers: jsonHeaders(student.accessToken) },
    );
    assert.equal(submitted.status, 200);
    assert.equal(((await submitted.json()) as RequestResponse).data.status, 'pending');

    const wrongReviewer = await fetch(
      `${baseUrl}/student-requests/${correction.data.id}`,
      { headers: jsonHeaders(teacher.accessToken) },
    );
    assert.equal(wrongReviewer.status, 403);

    const startAdminReview = await fetch(
      `${baseUrl}/student-requests/${correction.data.id}/start-review`,
      { method: 'POST', headers: jsonHeaders(admin.accessToken) },
    );
    assert.equal(startAdminReview.status, 200);
    const approveWithoutReason = await fetch(
      `${baseUrl}/student-requests/${correction.data.id}/approve`,
      {
        method: 'POST',
        headers: jsonHeaders(admin.accessToken),
        body: '{}',
      },
    );
    assert.equal(approveWithoutReason.status, 400);
    const approved = await fetch(
      `${baseUrl}/student-requests/${correction.data.id}/approve`,
      {
        method: 'POST',
        headers: jsonHeaders(admin.accessToken),
        body: JSON.stringify({ reason: 'Evidence verified' }),
      },
    );
    assert.equal(approved.status, 200);
    assert.equal(((await approved.json()) as RequestResponse).data.status, 'approved');

    const createLeave = await fetch(`${baseUrl}/student-requests`, {
      method: 'POST',
      headers: jsonHeaders(student.accessToken),
      body: JSON.stringify({
        request_type_id: leaveType.id,
        title: 'Leave request',
        content: 'Medical appointment',
      }),
    });
    assert.equal(createLeave.status, 201);
    const leave = (await createLeave.json()) as RequestResponse;
    requestIds.push(leave.data.id);
    assert.equal(
      (
        await fetch(`${baseUrl}/student-requests/${leave.data.id}`, {
          headers: jsonHeaders(foreign.accessToken),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(`${baseUrl}/student-requests/${leave.data.id}/submit`, {
          method: 'POST',
          headers: jsonHeaders(student.accessToken),
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(`${baseUrl}/student-requests/${leave.data.id}/start-review`, {
          method: 'POST',
          headers: jsonHeaders(outsider.accessToken),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(`${baseUrl}/student-requests/${leave.data.id}/start-review`, {
          method: 'POST',
          headers: jsonHeaders(teacher.accessToken),
        })
      ).status,
      200,
    );
    const rejected = await fetch(
      `${baseUrl}/student-requests/${leave.data.id}/reject`,
      {
        method: 'POST',
        headers: jsonHeaders(teacher.accessToken),
        body: JSON.stringify({ reason: 'Please provide more details' }),
      },
    );
    assert.equal(rejected.status, 200);

    const historyResponse = await fetch(
      `${baseUrl}/student-requests/${leave.data.id}/history`,
      { headers: jsonHeaders(student.accessToken) },
    );
    assert.equal(historyResponse.status, 200);
    const history = (await historyResponse.json()) as {
      data: Array<{ action: string }>;
    };
    assert.deepEqual(
      history.data.map((item) => item.action),
      ['create', 'submit', 'start_review', 'reject'],
    );

    await assert.rejects(
      postgresPool.query(
        'DELETE FROM student_request_status_history WHERE request_id = $1',
        [leave.data.id],
      ),
      /immutable/i,
    );
    await assert.rejects(
      postgresPool.query(
        "UPDATE student_requests SET status = 'draft' WHERE id = $1",
        [leave.data.id],
      ),
      /invalid student request transition/i,
    );

    const notificationCount = await postgresPool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM user_notifications
       WHERE user_id IN ($1, $2, $3)`,
      [adminId, teacherId, studentId],
    );
    assert.ok(notificationCount.rows[0].total >= 4);
    const stored = await postgresPool.query<{ storage_path: string }>(
      `SELECT storage_path FROM student_request_attachments
       WHERE request_id = $1`,
      [correction.data.id],
    );
    attachmentPaths.push(
      ...stored.rows.map((row) =>
        path.resolve(
          process.cwd(),
          'private-uploads',
          'student-requests',
          row.storage_path,
        ),
      ),
    );

    console.log(
      'Student request ownership, reviewer scope, attachment privacy, transitions, audit and notifications smoke test passed.',
    );
  } finally {
    const client = await postgresPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "SET LOCAL app.allow_student_request_cleanup = 'on'",
      );
      await client.query(
        'DELETE FROM student_request_status_history WHERE request_id = ANY($1::bigint[])',
        [requestIds],
      );
      await client.query(
        'DELETE FROM student_requests WHERE id = ANY($1::bigint[])',
        [requestIds],
      );
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
    await Promise.all(
      attachmentPaths.map((filePath) => unlink(filePath).catch(() => undefined)),
    );
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
