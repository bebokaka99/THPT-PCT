import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { closeDatabasePool, postgresPool } from '../src/database/postgres.js';
import { hashPassword } from '../src/utils/password.js';

type LoginResponse = { accessToken: string };
type DataResponse<T> = { data: T };

async function createUser(
  email: string,
  password: string,
  role: 'admin' | 'teacher' | 'student',
) {
  const result = await postgresPool.query<{ id: number }>(
    `INSERT INTO users (email, full_name, password_hash, status)
     VALUES ($1, $2, $3, 'active') RETURNING id`,
    [email, `Assignment ${role}`, await hashPassword(password)],
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
  const password = 'assignment-smoke-password';
  const userIds: number[] = [];
  let classroomId = 0;
  let subjectId = 0;
  let curriculumId = 0;
  let teachingAssignmentId = 0;
  const assignmentIds: number[] = [];

  const period = await postgresPool.query<{
    academic_year_id: number;
    academic_year_name: string;
    semester_id: number;
    start_date: string;
    end_date: string;
  }>(
    `SELECT year_record.id AS academic_year_id,
       year_record.name AS academic_year_name,
       semester.id AS semester_id,
       semester.start_date::text,
       semester.end_date::text
     FROM academic_years year_record
     JOIN semesters semester ON semester.academic_year_id = year_record.id
     ORDER BY semester.end_date DESC LIMIT 1`,
  );
  assert.ok(period.rows[0], 'An academic semester is required');
  const academicYearId = Number(period.rows[0].academic_year_id);
  const semesterId = Number(period.rows[0].semester_id);
  const dueAt = `${period.rows[0].end_date}T12:00:00+07:00`;

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const adminEmail = `assignment-admin-${suffix}@pct.local`;
    const teacherEmail = `assignment-teacher-${suffix}@pct.local`;
    const outsiderEmail = `assignment-outsider-${suffix}@pct.local`;
    const studentEmail = `assignment-student-${suffix}@pct.local`;
    const foreignEmail = `assignment-foreign-${suffix}@pct.local`;
    const adminId = await createUser(adminEmail, password, 'admin');
    const teacherId = await createUser(teacherEmail, password, 'teacher');
    const outsiderId = await createUser(outsiderEmail, password, 'teacher');
    const studentId = await createUser(studentEmail, password, 'student');
    const foreignId = await createUser(foreignEmail, password, 'student');
    userIds.push(adminId, teacherId, outsiderId, studentId, foreignId);

    const classroom = await postgresPool.query<{ id: number }>(
      `INSERT INTO classrooms (
        name, school_year, academic_year_id, grade_level, is_active
      ) VALUES ($1, $2, $3, 12, TRUE) RETURNING id`,
      [
        `Assignment Smoke ${suffix}`,
        period.rows[0].academic_year_name,
        academicYearId,
      ],
    );
    classroomId = Number(classroom.rows[0].id);
    const subject = await postgresPool.query<{ id: number }>(
      `INSERT INTO subjects (code, name, subject_group)
       VALUES ($1, $2, 'other') RETURNING id`,
      [`HW_${String(suffix).slice(-10)}`, `Homework ${suffix}`],
    );
    subjectId = Number(subject.rows[0].id);
    const curriculum = await postgresPool.query<{ id: number }>(
      `INSERT INTO curriculum_subjects (
        academic_year_id, subject_id, grade_level, periods_per_week
      ) VALUES ($1, $2, 12, 2) RETURNING id`,
      [academicYearId, subjectId],
    );
    curriculumId = Number(curriculum.rows[0].id);
    const teaching = await postgresPool.query<{ id: number }>(
      `INSERT INTO teaching_assignments (
        teacher_user_id, classroom_id, subject_id, semester_id, status,
        assigned_at, created_by_user_id
      ) VALUES ($1, $2, $3, $4, 'active', $5::date, $6) RETURNING id`,
      [
        teacherId,
        classroomId,
        subjectId,
        semesterId,
        period.rows[0].start_date,
        adminId,
      ],
    );
    teachingAssignmentId = Number(teaching.rows[0].id);
    await postgresPool.query(
      `INSERT INTO student_enrollments (
        student_user_id, classroom_id, academic_year_id, status,
        enrolled_at, created_by_user_id
      ) VALUES ($1, $2, $3, 'active', $4::date, $5)`,
      [
        studentId,
        classroomId,
        academicYearId,
        period.rows[0].start_date,
        adminId,
      ],
    );

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const admin = await login(baseUrl, adminEmail, password);
    const teacher = await login(baseUrl, teacherEmail, password);
    const outsider = await login(baseUrl, outsiderEmail, password);
    const student = await login(baseUrl, studentEmail, password);
    const foreign = await login(baseUrl, foreignEmail, password);
    const jsonHeaders = (token: string) => ({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const outsiderCreate = await fetch(`${baseUrl}/assignments`, {
      method: 'POST',
      headers: jsonHeaders(outsider.accessToken),
      body: JSON.stringify({
        teaching_assignment_id: teachingAssignmentId,
        title: 'Foreign attempt',
        due_at: dueAt,
        allow_late: true,
      }),
    });
    assert.equal(outsiderCreate.status, 403);

    const createResponse = await fetch(`${baseUrl}/assignments`, {
      method: 'POST',
      headers: jsonHeaders(teacher.accessToken),
      body: JSON.stringify({
        teaching_assignment_id: teachingAssignmentId,
        title: 'Assignment smoke',
        description: 'Submit text, link, or a PDF file',
        due_at: dueAt,
        allow_late: true,
        max_score: 10,
      }),
    });
    assert.equal(createResponse.status, 201);
    const assignment = (
      (await createResponse.json()) as DataResponse<{ id: number }>
    ).data;
    assignmentIds.push(assignment.id);

    const beforeNotification = await postgresPool.query<{ total: number }>(
      `SELECT COUNT(*)::integer AS total
       FROM user_notifications WHERE user_id = $1`,
      [studentId],
    );
    const publishResponse = await fetch(
      `${baseUrl}/assignments/${assignment.id}/publish`,
      { method: 'POST', headers: jsonHeaders(teacher.accessToken) },
    );
    assert.equal(publishResponse.status, 200);
    const afterNotification = await postgresPool.query<{ total: number }>(
      `SELECT COUNT(*)::integer AS total
       FROM user_notifications WHERE user_id = $1`,
      [studentId],
    );
    assert.equal(
      Number(afterNotification.rows[0].total),
      Number(beforeNotification.rows[0].total) + 1,
    );

    const studentList = await fetch(`${baseUrl}/assignments`, {
      headers: jsonHeaders(student.accessToken),
    });
    assert.equal(studentList.status, 200);
    assert.ok(
      (
        (await studentList.json()) as {
          data: Array<{ id: number }>;
        }
      ).data.some((item) => item.id === assignment.id),
    );

    const foreignDetail = await fetch(
      `${baseUrl}/assignments/${assignment.id}`,
      { headers: jsonHeaders(foreign.accessToken) },
    );
    assert.equal(foreignDetail.status, 403);

    const textSubmission = new FormData();
    textSubmission.append('content_text', 'Bài làm dạng text trong smoke test');
    textSubmission.append('note', 'Text only');
    const textResponse = await fetch(
      `${baseUrl}/assignments/${assignment.id}/submissions`,
      { method: 'POST', headers: { Authorization: `Bearer ${student.accessToken}` }, body: textSubmission },
    );
    assert.equal(textResponse.status, 201);
    assert.equal(((await textResponse.json()) as DataResponse<{ content_text: string }>).data.content_text, 'Bài làm dạng text trong smoke test');

    for (const version of [1, 2]) {
      const form = new FormData();
      form.append(
        'file',
        new Blob([`%PDF-1.4 assignment smoke ${version}`], {
          type: 'application/pdf',
        }),
        `assignment-${version}.pdf`,
      );
      form.append('note', `Version ${version}`);
      const response = await fetch(
        `${baseUrl}/assignments/${assignment.id}/submissions`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${student.accessToken}` },
          body: form,
        },
      );
      assert.equal(response.status, 201);
      const submission = (
        (await response.json()) as DataResponse<{
          current_file: { media_file_id: number; version: number };
          files: Array<{ is_active: boolean }>;
        }>
      ).data;
      assert.equal(submission.current_file.version, version);
      assert.equal(
        submission.files.filter((file) => file.is_active).length,
        1,
      );
    }

    const teacherSubmissions = await fetch(
      `${baseUrl}/assignments/${assignment.id}/submissions`,
      { headers: jsonHeaders(teacher.accessToken) },
    );
    assert.equal(teacherSubmissions.status, 200);
    const roster = (
      (await teacherSubmissions.json()) as DataResponse<Array<{
        id: number;
        student_user_id: number;
        current_file: { id: number } | null;
      }>>
    ).data;
    const submittedRow = roster.find((row) => row.student_user_id === studentId);
    assert.equal(submittedRow?.student_user_id, studentId);
    assert.ok(submittedRow?.current_file?.id, 'private file metadata is present');
    const privateDownload = await fetch(
      `${baseUrl}/assignments/${assignment.id}/submissions/${submittedRow!.id}/files/${submittedRow!.current_file!.id}/download`,
      { headers: { Authorization: `Bearer ${student.accessToken}` } },
    );
    assert.equal(privateDownload.status, 200);

    const reviewResponse = await fetch(
      `${baseUrl}/assignments/${assignment.id}/submissions/${(await postgresPool.query<{ id: number }>('SELECT id FROM assignment_submissions WHERE assignment_id = $1 AND student_user_id = $2', [assignment.id, studentId])).rows[0].id}/review`,
      {
        method: 'PATCH',
        headers: jsonHeaders(teacher.accessToken),
        body: JSON.stringify({ action: 'grade', feedback: 'Tốt', score: 9 }),
      },
    );
    assert.equal(reviewResponse.status, 200);

    const closed = await fetch(
      `${baseUrl}/assignments/${assignment.id}/close`,
      { method: 'POST', headers: jsonHeaders(teacher.accessToken) },
    );
    assert.equal(closed.status, 200);

    const mediaBeforeRejectedUpload = await postgresPool.query<{ total: number }>(
      'SELECT COUNT(*)::integer AS total FROM media_files',
    );
    const closedSubmit = new FormData();
    closedSubmit.append(
      'file',
      new Blob(['%PDF-1.4 closed'], { type: 'application/pdf' }),
      'closed.pdf',
    );
    const closedResponse = await fetch(
      `${baseUrl}/assignments/${assignment.id}/submissions`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${student.accessToken}` },
        body: closedSubmit,
      },
    );
    assert.equal(closedResponse.status, 409);
    const mediaAfterRejectedUpload = await postgresPool.query<{ total: number }>(
      'SELECT COUNT(*)::integer AS total FROM media_files',
    );
    assert.equal(
      Number(mediaAfterRejectedUpload.rows[0].total),
      Number(mediaBeforeRejectedUpload.rows[0].total),
    );

    const adminList = await fetch(`${baseUrl}/assignments`, {
      headers: jsonHeaders(admin.accessToken),
    });
    assert.equal(adminList.status, 200);

    const audit = await postgresPool.query<{
      action: string;
      total: number;
    }>(
      `SELECT action, COUNT(*)::integer AS total
       FROM assignment_submission_audits
       WHERE submission_id IN (
         SELECT id FROM assignment_submissions WHERE assignment_id = $1
       )
       GROUP BY action`,
      [assignment.id],
    );
    assert.equal(
      Number(audit.rows.find((row) => row.action === 'submit')?.total),
      1,
    );
    assert.equal(
      Number(audit.rows.find((row) => row.action === 'replace')?.total),
      2,
    );

    console.log(
      'Assignments scope, notification, versioned upload, and close-state smoke test passed.',
    );
  } finally {
    if (assignmentIds.length) {
      await postgresPool.query(
        `DELETE FROM assignment_submission_audits
         WHERE submission_id IN (
           SELECT id FROM assignment_submissions
           WHERE assignment_id = ANY($1::bigint[])
         )`,
        [assignmentIds],
      );
      await postgresPool.query(
        `DELETE FROM assignment_submission_files
         WHERE submission_id IN (
           SELECT id FROM assignment_submissions
           WHERE assignment_id = ANY($1::bigint[])
         )`,
        [assignmentIds],
      );
      await postgresPool.query(
        'DELETE FROM assignment_submissions WHERE assignment_id = ANY($1::bigint[])',
        [assignmentIds],
      );
      await postgresPool.query(
        'DELETE FROM assignments WHERE id = ANY($1::bigint[])',
        [assignmentIds],
      );
    }
    if (teachingAssignmentId) {
      await postgresPool.query(
        'DELETE FROM teaching_assignments WHERE id = $1',
        [teachingAssignmentId],
      );
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
