import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { closeDatabasePool, postgresPool } from '../src/database/postgres.js';
import { hashPassword } from '../src/utils/password.js';

type LoginResponse = { accessToken: string };
type DataResponse<T> = { data: T };

async function createUser(email: string, role: 'admin' | 'teacher' | 'student', password: string) {
  const result = await postgresPool.query<{ id: number }>(
    `INSERT INTO users (email, full_name, password_hash, status) VALUES ($1, $2, $3, 'active') RETURNING id`,
    [email, `Communication smoke ${role}`, await hashPassword(password)],
  );
  const id = Number(result.rows[0].id);
  await postgresPool.query(
    `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = $2`,
    [id, role],
  );
  return id;
}

async function login(baseUrl: string, email: string, password: string) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password }),
  });
  assert.equal(response.status, 200);
  return (await response.json()) as LoginResponse;
}

async function run() {
  const suffix = Date.now();
  const password = 'communication-smoke-password';
  const userIds: number[] = [];
  let classroomId = 0;
  let notificationId = 0;
  const period = await postgresPool.query<{ academic_year_id: number; academic_year_name: string; semester_start: string }>(
    `SELECT year_record.id AS academic_year_id, year_record.name AS academic_year_name, semester.start_date::text AS semester_start
     FROM academic_years year_record JOIN semesters semester ON semester.academic_year_id = year_record.id
     WHERE year_record.status <> 'closed' AND semester.status <> 'closed'
     ORDER BY semester.end_date DESC LIMIT 1`,
  );
  assert.ok(period.rows[0], 'Smoke test needs an academic period');
  const currentPeriod = period.rows[0];
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try {
    const adminId = await createUser(`communication-admin-${suffix}@pct.local`, 'admin', password);
    const teacherId = await createUser(`communication-teacher-${suffix}@pct.local`, 'teacher', password);
    const studentId = await createUser(`communication-student-${suffix}@pct.local`, 'student', password);
    userIds.push(adminId, teacherId, studentId);
    const classroom = await postgresPool.query<{ id: number }>(
      `INSERT INTO classrooms (name, school_year, academic_year_id, grade_level, is_active)
       VALUES ($1, $2, $3, 12, TRUE) RETURNING id`,
      [`COM-${suffix}`, currentPeriod.academic_year_name, currentPeriod.academic_year_id],
    );
    classroomId = Number(classroom.rows[0].id);
    await postgresPool.query(`INSERT INTO classroom_members (classroom_id, user_id, role) VALUES ($1, $2, 'teacher')`, [classroomId, teacherId]);
    await postgresPool.query(
      `INSERT INTO student_enrollments (student_user_id, classroom_id, academic_year_id, status, enrolled_at, created_by_user_id)
       VALUES ($1, $2, $3, 'active', $4::date, $5)`,
      [studentId, classroomId, currentPeriod.academic_year_id, currentPeriod.semester_start, adminId],
    );

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const admin = await login(baseUrl, `communication-admin-${suffix}@pct.local`, password);
    const teacher = await login(baseUrl, `communication-teacher-${suffix}@pct.local`, password);
    const student = await login(baseUrl, `communication-student-${suffix}@pct.local`, password);
    const headers = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
    const payload = {
      title: 'Thông báo họp phụ huynh', message: 'Vui lòng xem lịch họp của lớp.', type: 'classroom',
      target_role: 'student', target_scope: 'classroom', priority: 'urgent', classroom_id: classroomId,
      requires_acknowledgement: true, related_url: `/student/classes/${classroomId}`, idempotency_key: `communication-${suffix}`,
    };
    const createdResponse = await fetch(`${baseUrl}/notifications`, { method: 'POST', headers: headers(teacher.accessToken), body: JSON.stringify(payload) });
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json() as DataResponse<{ id: number }>).data;
    notificationId = created.id;
    const retryResponse = await fetch(`${baseUrl}/notifications`, { method: 'POST', headers: headers(teacher.accessToken), body: JSON.stringify(payload) });
    assert.equal(retryResponse.status, 201);
    assert.equal((await retryResponse.json() as DataResponse<{ id: number }>).data.id, notificationId, 'Retry must be idempotent');
    const forbiddenTeacher = await fetch(`${baseUrl}/notifications`, { method: 'POST', headers: headers(teacher.accessToken), body: JSON.stringify({ ...payload, target_scope: 'school', target_role: 'all', idempotency_key: `forbidden-${suffix}` }) });
    assert.equal(forbiddenTeacher.status, 403);
    const forbiddenStudent = await fetch(`${baseUrl}/notifications`, { method: 'POST', headers: headers(student.accessToken), body: JSON.stringify(payload) });
    assert.equal(forbiddenStudent.status, 403);

    const studentList = await fetch(`${baseUrl}/notifications/me?unread=true`, { headers: headers(student.accessToken) });
    assert.equal(studentList.status, 200);
    const listed = (await studentList.json()) as { data: Array<{ id: number; acknowledged_at: string | null; priority: string }> };
    assert.ok(listed.data.some((item) => item.id === notificationId && item.priority === 'urgent'));
    const read = await fetch(`${baseUrl}/notifications/me/${notificationId}/read`, { method: 'PATCH', headers: headers(student.accessToken) });
    assert.equal(read.status, 204);
    const acknowledge = await fetch(`${baseUrl}/notifications/me/${notificationId}/acknowledge`, { method: 'PATCH', headers: headers(student.accessToken) });
    assert.equal(acknowledge.status, 204);
    const report = await fetch(`${baseUrl}/notifications/${notificationId}/report`, { headers: headers(teacher.accessToken) });
    assert.equal(report.status, 200);
    const reportBody = (await report.json() as DataResponse<{ recipients: number; read: number; acknowledged: number }>).data;
    assert.equal(reportBody.recipients, 1);
    assert.equal(reportBody.read, 1);
    assert.equal(reportBody.acknowledged, 1);
    const options = await fetch(`${baseUrl}/notifications/options`, { headers: headers(admin.accessToken) });
    assert.equal(options.status, 200);
    console.log('Family communication scope, teacher RBAC, acknowledgement, delivery report and idempotent retry passed.');
  } finally {
    if (notificationId) await postgresPool.query(`DELETE FROM notifications WHERE id = $1`, [notificationId]);
    if (classroomId) {
      await postgresPool.query(`DELETE FROM student_enrollments WHERE classroom_id = $1`, [classroomId]);
      await postgresPool.query(`DELETE FROM classroom_members WHERE classroom_id = $1`, [classroomId]);
      await postgresPool.query(`DELETE FROM classrooms WHERE id = $1`, [classroomId]);
    }
    if (userIds.length) await postgresPool.query(`DELETE FROM users WHERE id = ANY($1::bigint[])`, [userIds]);
    server.close();
    await closeDatabasePool();
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
