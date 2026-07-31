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
     VALUES ($1, $2, $3, 'active')
     RETURNING id`,
    [email, `Attendance ${role}`, await hashPassword(password)],
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
  const password = 'attendance-smoke-password';
  const userIds: number[] = [];
  let classroomId = 0;
  let subjectId = 0;
  let curriculumId = 0;
  let assignmentId = 0;
  let sessionId = 0;

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
     ORDER BY year_record.start_date DESC, semester.start_date ASC
     LIMIT 1`,
  );
  assert.ok(period.rows[0], 'An academic semester is required');
  const academicYearId = Number(period.rows[0].academic_year_id);
  const semesterId = Number(period.rows[0].semester_id);
  const sessionDate = period.rows[0].start_date;

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const adminEmail = `attendance-admin-${suffix}@pct.local`;
    const teacherEmail = `attendance-teacher-${suffix}@pct.local`;
    const outsiderEmail = `attendance-outsider-${suffix}@pct.local`;
    const studentEmails = [1, 2, 3].map(
      (index) => `attendance-student-${index}-${suffix}@pct.local`,
    );
    const adminId = await createUser(adminEmail, password, 'admin');
    const teacherId = await createUser(teacherEmail, password, 'teacher');
    const outsiderId = await createUser(outsiderEmail, password, 'teacher');
    const studentIds: number[] = [];
    for (const email of studentEmails) {
      studentIds.push(await createUser(email, password, 'student'));
    }
    userIds.push(adminId, teacherId, outsiderId, ...studentIds);

    const classroom = await postgresPool.query<{ id: number }>(
      `INSERT INTO classrooms (
         name, school_year, academic_year_id, grade_level,
         homeroom_teacher_user_id, is_active
       )
       VALUES ($1, $2, $3, 11, $4, TRUE)
       RETURNING id`,
      [
        `Attendance Smoke ${suffix}`,
        period.rows[0].academic_year_name,
        academicYearId,
        teacherId,
      ],
    );
    classroomId = Number(classroom.rows[0].id);

    const subject = await postgresPool.query<{ id: number }>(
      `INSERT INTO subjects (code, name, subject_group)
       VALUES ($1, $2, 'other')
       RETURNING id`,
      [`ATT_${String(suffix).slice(-10)}`, `Attendance subject ${suffix}`],
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
    const assignment = await postgresPool.query<{ id: number }>(
      `INSERT INTO teaching_assignments (
         teacher_user_id, classroom_id, subject_id, semester_id,
         status, assigned_at, created_by_user_id
       )
       VALUES ($1, $2, $3, $4, 'active', $5::date, $6)
       RETURNING id`,
      [teacherId, classroomId, subjectId, semesterId, sessionDate, adminId],
    );
    assignmentId = Number(assignment.rows[0].id);
    for (const studentId of studentIds) {
      await postgresPool.query(
        `INSERT INTO student_enrollments (
           student_user_id, classroom_id, academic_year_id, status,
           enrolled_at, created_by_user_id
         )
         VALUES ($1, $2, $3, 'active', $4::date, $5)`,
        [studentId, classroomId, academicYearId, sessionDate, adminId],
      );
    }

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const admin = await login(baseUrl, adminEmail, password);
    const teacher = await login(baseUrl, teacherEmail, password);
    const outsider = await login(baseUrl, outsiderEmail, password);
    const students: LoginResponse[] = [];
    for (const email of studentEmails) {
      students.push(await login(baseUrl, email, password));
    }
    const headers = (token: string) => ({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const createResponse = await fetch(`${baseUrl}/attendance/sessions`, {
      method: 'POST',
      headers: headers(teacher.accessToken),
      body: JSON.stringify({
        classroom_id: classroomId,
        semester_id: semesterId,
        subject_id: subjectId,
        teaching_assignment_id: assignmentId,
        session_date: sessionDate,
        lesson_index: 1,
      }),
    });
    assert.equal(createResponse.status, 201);
    const created = (
      (await createResponse.json()) as DataResponse<{
        id: number;
        records: Array<{ student_user_id: number }>;
      }>
    ).data;
    sessionId = created.id;
    assert.equal(created.records.length, 3);

    const outsiderCreate = await fetch(`${baseUrl}/attendance/sessions`, {
      method: 'POST',
      headers: headers(outsider.accessToken),
      body: JSON.stringify({
        classroom_id: classroomId,
        semester_id: semesterId,
        subject_id: subjectId,
        session_date: sessionDate,
        lesson_index: 2,
      }),
    });
    assert.equal(outsiderCreate.status, 403);

    const firstSave = await fetch(
      `${baseUrl}/attendance/sessions/${sessionId}/records`,
      {
        method: 'PUT',
        headers: headers(teacher.accessToken),
        body: JSON.stringify({
          correction_reason: 'Initial historical attendance smoke entry',
          records: [
            { student_user_id: studentIds[0], status: 'present' },
            { student_user_id: studentIds[1], status: 'late', note: '5 phút' },
            { student_user_id: studentIds[2], status: 'unexcused' },
          ],
        }),
      },
    );
    assert.equal(firstSave.status, 200);

    const partialSave = await fetch(
      `${baseUrl}/attendance/sessions/${sessionId}/records`,
      {
        method: 'PUT',
        headers: headers(teacher.accessToken),
        body: JSON.stringify({
          correction_reason: 'Phụ huynh bổ sung lý do',
          records: [
            {
              student_user_id: studentIds[2],
              status: 'excused',
              note: 'Có xác nhận',
            },
          ],
        }),
      },
    );
    assert.equal(partialSave.status, 200);

    const foreignStudent = await createUser(
      `attendance-foreign-${suffix}@pct.local`,
      password,
      'student',
    );
    userIds.push(foreignStudent);
    const invalidBulk = await fetch(
      `${baseUrl}/attendance/sessions/${sessionId}/records`,
      {
        method: 'PUT',
        headers: headers(teacher.accessToken),
        body: JSON.stringify({
          correction_reason: 'Atomic rollback check',
          records: [
            { student_user_id: studentIds[0], status: 'unexcused' },
            { student_user_id: foreignStudent, status: 'present' },
          ],
        }),
      },
    );
    assert.equal(invalidBulk.status, 400);
    const unchanged = await postgresPool.query<{ status: string }>(
      `SELECT status FROM attendance_records
       WHERE session_id = $1 AND student_user_id = $2`,
      [sessionId, studentIds[0]],
    );
    assert.equal(unchanged.rows[0].status, 'present');

    const studentMe = await fetch(`${baseUrl}/attendance/me`, {
      headers: headers(students[1].accessToken),
    });
    assert.equal(studentMe.status, 200);
    const studentBody = (await studentMe.json()) as {
      data: Array<{ student_user_id: number; status: string }>;
      summary: { total: number; late: number; attendance_rate: number };
    };
    assert.equal(studentBody.data.length, 1);
    assert.equal(studentBody.data[0].student_user_id, studentIds[1]);
    assert.equal(studentBody.summary.late, 1);
    assert.equal(studentBody.summary.attendance_rate, 100);

    const studentSessions = await fetch(`${baseUrl}/attendance/sessions`, {
      headers: headers(students[0].accessToken),
    });
    assert.equal(studentSessions.status, 403);

    const summaryResponse = await fetch(
      `${baseUrl}/attendance/summary/classrooms/${classroomId}?semester_id=${semesterId}`,
      { headers: headers(admin.accessToken) },
    );
    assert.equal(summaryResponse.status, 200);
    const summary = (
      (await summaryResponse.json()) as DataResponse<
        Array<{
          student_user_id: number;
          present: number;
          excused: number;
          late: number;
        }>
      >
    ).data;
    assert.equal(summary.length, 3);
    assert.equal(
      summary.find((row) => row.student_user_id === studentIds[2])?.excused,
      1,
    );

    const monthlyResponse = await fetch(
      `${baseUrl}/attendance/summary/classrooms/${classroomId}` +
        `?from=${sessionDate}&to=${sessionDate}`,
      { headers: headers(admin.accessToken) },
    );
    assert.equal(monthlyResponse.status, 200);
    assert.equal(
      (
        (await monthlyResponse.json()) as DataResponse<
          Array<{ student_user_id: number }>
        >
      ).data.length,
      3,
    );

    const auditResponse = await fetch(
      `${baseUrl}/attendance/sessions/${sessionId}/audit`,
      { headers: headers(teacher.accessToken) },
    );
    assert.equal(auditResponse.status, 200);
    const audits = (
      (await auditResponse.json()) as DataResponse<
        Array<{ reason: string | null }>
      >
    ).data;
    assert.ok(
      audits.some((audit) => audit.reason === 'Phụ huynh bổ sung lý do'),
    );

    console.log(
      'Attendance scope, atomic bulk save, audit, student privacy, and totals smoke test passed.',
    );
  } finally {
    if (sessionId) {
      await postgresPool.query(
        'DELETE FROM attendance_sessions WHERE id = $1',
        [sessionId],
      );
    }
    if (assignmentId) {
      await postgresPool.query(
        'DELETE FROM teaching_assignments WHERE id = $1',
        [assignmentId],
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

