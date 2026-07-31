import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { closeDatabasePool, postgresPool } from '../src/database/postgres.js';
import { hashPassword } from '../src/utils/password.js';

type LoginResponse = { accessToken: string };
type DataResponse<T> = { data: T };

async function createUser(email: string, password: string, role: 'admin' | 'teacher' | 'student' | 'guardian') {
  const result = await postgresPool.query<{ id: number }>(
    `INSERT INTO users (email, full_name, password_hash, status)
     VALUES ($1, $2, $3, 'active') RETURNING id`,
    [email, `Academic calendar ${role}`, await hashPassword(password)],
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

function mondayInRange(start: string, end: string) {
  const date = new Date(`${start}T00:00:00Z`);
  while (date.getUTCDay() !== 1) date.setUTCDate(date.getUTCDate() + 1);
  assert.ok(date.toISOString().slice(0, 10) <= end, 'Semester must contain a Monday');
  return date.toISOString().slice(0, 10);
}

async function run() {
  const suffix = Date.now(); const password = 'calendar-smoke-password';
  const userIds: number[] = []; const classroomIds: number[] = []; const entryIds: number[] = [];
  let subjectId = 0; let curriculumId = 0; let timetableId = 0;
  const period = await postgresPool.query<{ academic_year_id: number; academic_year_name: string; semester_id: number; semester_name: string; start_date: string; end_date: string }>(
    `SELECT year_record.id AS academic_year_id, year_record.name AS academic_year_name,
       semester.id AS semester_id, semester.name AS semester_name,
       semester.start_date::text, semester.end_date::text
     FROM academic_years year_record JOIN semesters semester ON semester.academic_year_id = year_record.id
     ORDER BY semester.end_date DESC LIMIT 1`,
  );
  assert.ok(period.rows[0]); const p = period.rows[0]; const monday = mondayInRange(p.start_date, p.end_date);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try {
    const roles = ['admin','teacher','teacher','student','student','guardian'] as const;
    const emails = roles.map((role, index) => `calendar-${role}-${index}-${suffix}@pct.local`);
    for (let index = 0; index < roles.length; index += 1) userIds.push(await createUser(emails[index], password, roles[index]));
    const [adminId, teacherId, outsiderId, studentId, foreignId, guardianId] = userIds;
    for (const name of [`CAL-A-${suffix}`, `CAL-B-${suffix}`]) {
      const result = await postgresPool.query<{ id: number }>(
        `INSERT INTO classrooms (name, school_year, academic_year_id, grade_level, is_active)
         VALUES ($1, $2, $3, 12, TRUE) RETURNING id`, [name, p.academic_year_name, p.academic_year_id],
      ); classroomIds.push(Number(result.rows[0].id));
    }
    const subject = await postgresPool.query<{ id: number }>(
      `INSERT INTO subjects (code, name, subject_group) VALUES ($1, $2, 'other') RETURNING id`,
      [`CAL_${String(suffix).slice(-9)}`, `Calendar subject ${suffix}`],
    ); subjectId = Number(subject.rows[0].id);
    const curriculum = await postgresPool.query<{ id: number }>(
      `INSERT INTO curriculum_subjects (academic_year_id, subject_id, grade_level, periods_per_week)
       VALUES ($1, $2, 12, 2) RETURNING id`, [p.academic_year_id, subjectId],
    ); curriculumId = Number(curriculum.rows[0].id);
    const assignmentIds: number[] = [];
    for (const classroomId of classroomIds) {
      const assignment = await postgresPool.query<{ id: number }>(
        `INSERT INTO teaching_assignments (teacher_user_id, classroom_id, subject_id, semester_id, status, assigned_at, created_by_user_id)
         VALUES ($1, $2, $3, $4, 'active', $5::date, $6) RETURNING id`,
        [teacherId, classroomId, subjectId, p.semester_id, p.start_date, adminId],
      ); assignmentIds.push(Number(assignment.rows[0].id));
    }
    await postgresPool.query(
      `INSERT INTO student_enrollments (student_user_id, classroom_id, academic_year_id, status, enrolled_at, created_by_user_id)
       VALUES ($1, $2, $3, 'active', $4::date, $5), ($6, $7, $3, 'active', $4::date, $5)`,
      [studentId, classroomIds[0], p.academic_year_id, p.start_date, adminId, foreignId, classroomIds[1]],
    );
    await postgresPool.query(
      `INSERT INTO student_guardian_links (guardian_user_id, student_user_id, relationship, status, invited_by_user_id, verified_by_user_id, verified_at)
       VALUES ($1, $2, 'parent', 'verified', $3, $3, NOW())`, [guardianId, studentId, adminId],
    );
    const shift = await postgresPool.query<{ shift_id: number }>("SELECT id AS shift_id FROM school_shifts WHERE code = 'morning'");
    const timetable = await postgresPool.query<{ id: number }>(
      `INSERT INTO timetables (classroom_id, school_year, semester, academic_year_id, semester_id, title, status, version_number, is_active, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, 'Calendar conflict timetable', 'draft', 1, FALSE, $6) RETURNING id`,
      [classroomIds[1], p.academic_year_name, p.semester_name, p.academic_year_id, p.semester_id, adminId],
    ); timetableId = Number(timetable.rows[0].id);
    await postgresPool.query(
      `INSERT INTO timetable_items (timetable_id, day_of_week, shift_id, lesson_index, subject_id, teaching_assignment_id, teacher_user_id, subject_name, teacher_name, room)
       VALUES ($1, 1, $2, 1, $3, $4, $5, $6, 'Calendar teacher', 'ROOM-X')`,
      [timetableId, shift.rows[0].shift_id, subjectId, assignmentIds[1], teacherId, `Calendar subject ${suffix}`],
    );
    await postgresPool.query("UPDATE timetables SET status = 'published' WHERE id = $1", [timetableId]);

    const address = server.address() as AddressInfo; const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const tokens: LoginResponse[] = [];
    for (const email of emails) tokens.push(await login(baseUrl, email, password));
    const headers = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
    const body = { teaching_assignment_id: assignmentIds[0], entry_type: 'test', title: 'Bài kiểm tra học vụ', starts_at: `${monday}T11:30:00+07:00`, ends_at: `${monday}T12:15:00+07:00`, all_day: false, room: 'ROOM-A' };
    const invalidTimezone = await fetch(`${baseUrl}/academic-calendar`, { method: 'POST', headers: headers(tokens[1].accessToken), body: JSON.stringify({ ...body, starts_at: `${monday}T11:30:00` }) });
    assert.equal(invalidTimezone.status, 400);
    const outsider = await fetch(`${baseUrl}/academic-calendar`, { method: 'POST', headers: headers(tokens[2].accessToken), body: JSON.stringify(body) });
    assert.equal(outsider.status, 403);
    const before = await postgresPool.query<{ total: number }>('SELECT COUNT(*)::integer AS total FROM user_notifications WHERE user_id = $1', [studentId]);
    const createdResponse = await fetch(`${baseUrl}/academic-calendar`, { method: 'POST', headers: headers(tokens[1].accessToken), body: JSON.stringify(body) });
    assert.equal(createdResponse.status, 201); const created = (await createdResponse.json() as DataResponse<{ id: number; status: string }>).data; entryIds.push(created.id); assert.equal(created.status, 'proposed');
    const afterDraft = await postgresPool.query<{ total: number }>('SELECT COUNT(*)::integer AS total FROM user_notifications WHERE user_id = $1', [studentId]);
    assert.equal(afterDraft.rows[0].total, before.rows[0].total, 'Proposal must not notify students');
    const publish = await fetch(`${baseUrl}/academic-calendar/${created.id}/publish`, { method: 'POST', headers: headers(tokens[0].accessToken) }); assert.equal(publish.status, 200);
    const studentList = await fetch(`${baseUrl}/academic-calendar`, { headers: headers(tokens[3].accessToken) }); assert.equal(studentList.status, 200); assert.ok((await studentList.json() as { data: Array<{ id: number }> }).data.some((item) => item.id === created.id));
    const foreignList = await fetch(`${baseUrl}/academic-calendar`, { headers: headers(tokens[4].accessToken) }); assert.equal(foreignList.status, 200); assert.ok(!(await foreignList.json() as { data: Array<{ id: number }> }).data.some((item) => item.id === created.id));
    const guardianList = await fetch(`${baseUrl}/academic-calendar?student_id=${studentId}`, { headers: headers(tokens[5].accessToken) }); assert.equal(guardianList.status, 200); assert.ok((await guardianList.json() as { data: Array<{ id: number }> }).data.some((item) => item.id === created.id));
    const afterPublish = await postgresPool.query<{ total: number }>('SELECT COUNT(*)::integer AS total FROM user_notifications WHERE user_id = $1', [studentId]); assert.equal(Number(afterPublish.rows[0].total), Number(before.rows[0].total) + 1);
    const update = await fetch(`${baseUrl}/academic-calendar/${created.id}`, { method: 'PATCH', headers: headers(tokens[0].accessToken), body: JSON.stringify({ title: 'Bài kiểm tra đã đổi lịch' }) }); assert.equal(update.status, 200);
    const afterUpdate = await postgresPool.query<{ total: number }>('SELECT COUNT(*)::integer AS total FROM user_notifications WHERE user_id = $1', [studentId]); assert.equal(Number(afterUpdate.rows[0].total), Number(afterPublish.rows[0].total) + 1);
    const collisionResponse = await fetch(`${baseUrl}/academic-calendar`, { method: 'POST', headers: headers(tokens[1].accessToken), body: JSON.stringify({ ...body, title: 'Lịch trùng lớp' }) }); assert.equal(collisionResponse.status, 201); const collision = (await collisionResponse.json() as DataResponse<{ id: number }>).data; entryIds.push(collision.id);
    const collisionPublish = await fetch(`${baseUrl}/academic-calendar/${collision.id}/publish`, { method: 'POST', headers: headers(tokens[0].accessToken) }); assert.equal(collisionPublish.status, 409);
    const timetablePreview = await fetch(`${baseUrl}/academic-calendar/conflicts`, { method: 'POST', headers: headers(tokens[1].accessToken), body: JSON.stringify({ ...body, entry_type: 'make_up', starts_at: `${monday}T07:00:00+07:00`, ends_at: `${monday}T07:45:00+07:00`, room: 'ROOM-Y' }) }); assert.equal(timetablePreview.status, 200); assert.ok((await timetablePreview.json() as { data: Array<{ source: string; resource: string }> }).data.some((item) => item.source === 'timetable' && item.resource === 'teacher'));
    const audit = await fetch(`${baseUrl}/academic-calendar/${created.id}/audit`, { headers: headers(tokens[0].accessToken) }); assert.equal(audit.status, 200); assert.ok((await audit.json() as { data: unknown[] }).data.length >= 3);
    console.log('Academic calendar scope, conflict, notification, timezone, and audit smoke test passed.');
  } finally {
    await postgresPool.query("SET app.allow_academic_calendar_audit_cleanup = 'on'");
    await postgresPool.query('DELETE FROM notifications WHERE created_by_user_id = ANY($1::bigint[])', [userIds]);
    if (entryIds.length) await postgresPool.query('DELETE FROM academic_calendar_entries WHERE id = ANY($1::bigint[])', [entryIds]);
    if (timetableId) await postgresPool.query('DELETE FROM timetables WHERE id = $1', [timetableId]);
    if (classroomIds.length) {
      await postgresPool.query('DELETE FROM student_enrollments WHERE classroom_id = ANY($1::bigint[])', [classroomIds]);
      await postgresPool.query('DELETE FROM teaching_assignments WHERE classroom_id = ANY($1::bigint[])', [classroomIds]);
      await postgresPool.query('DELETE FROM classrooms WHERE id = ANY($1::bigint[])', [classroomIds]);
    }
    if (curriculumId) await postgresPool.query('DELETE FROM curriculum_subjects WHERE id = $1', [curriculumId]);
    if (subjectId) await postgresPool.query('DELETE FROM subjects WHERE id = $1', [subjectId]);
    if (userIds.length) await postgresPool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [userIds]);
    server.close(); await closeDatabasePool();
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
