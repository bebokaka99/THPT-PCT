import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { closeDatabasePool, postgresPool } from '../src/database/postgres.js';
import { hashPassword } from '../src/utils/password.js';

type LoginResponse = { accessToken: string };
type ResponseData<T> = { data: T };

async function createUser(
  email: string,
  role: 'admin' | 'teacher' | 'student' | 'guardian',
  password: string,
) {
  const result = await postgresPool.query<{ id: number }>(
    `INSERT INTO users (email, full_name, password_hash, status) VALUES ($1, $2, $3, 'active') RETURNING id`,
    [email, `Override smoke ${role}`, await hashPassword(password)],
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

function nextMonday(startDate: string) {
  const date = new Date(`${startDate}T00:00:00Z`);
  while (date.getUTCDay() !== 1) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

async function run() {
  const suffix = Date.now();
  const password = 'override-smoke-password';
  const userIds: number[] = [];
  const classroomIds: number[] = [];
  const timetableIds: number[] = [];
  const overrideIds: number[] = [];
  let subjectId = 0;
  let curriculumId = 0;
  const period = await postgresPool.query<{
    academic_year_id: number; academic_year_name: string; semester_id: number;
    semester_name: string; semester_start: string; semester_end: string;
  }>(
    `SELECT year_record.id AS academic_year_id, year_record.name AS academic_year_name,
      semester.id AS semester_id, semester.name AS semester_name,
      semester.start_date::text AS semester_start, semester.end_date::text AS semester_end
     FROM academic_years year_record JOIN semesters semester ON semester.academic_year_id = year_record.id
     WHERE year_record.status <> 'closed' AND year_record.is_locked = FALSE
       AND semester.status <> 'closed' AND semester.is_locked = FALSE
     ORDER BY semester.end_date DESC LIMIT 1`,
  );
  assert.ok(period.rows[0]);
  const p = period.rows[0];
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try {
    const adminId = await createUser(`override-admin-${suffix}@pct.local`, 'admin', password);
    const teacherId = await createUser(`override-teacher-${suffix}@pct.local`, 'teacher', password);
    const substituteTeacherId = await createUser(`override-substitute-${suffix}@pct.local`, 'teacher', password);
    const studentId = await createUser(`override-student-${suffix}@pct.local`, 'student', password);
    const unlinkedStudentId = await createUser(`override-unlinked-${suffix}@pct.local`, 'student', password);
    const guardianId = await createUser(`override-guardian-${suffix}@pct.local`, 'guardian', password);
    const outsiderTeacherId = await createUser(`override-outsider-${suffix}@pct.local`, 'teacher', password);
    userIds.push(
      adminId,
      teacherId,
      substituteTeacherId,
      studentId,
      unlinkedStudentId,
      guardianId,
      outsiderTeacherId,
    );
    const classroom = await postgresPool.query<{ id: number }>(
      `INSERT INTO classrooms (name, school_year, academic_year_id, grade_level, is_active)
       VALUES ($1, $2, $3, 12, TRUE) RETURNING id`,
      [`OVR-A-${suffix}`, p.academic_year_name, p.academic_year_id],
    );
    const classroomId = Number(classroom.rows[0].id); classroomIds.push(classroomId);
    await postgresPool.query(
      `INSERT INTO classroom_members (classroom_id, user_id, role) VALUES ($1, $2, 'teacher')`,
      [classroomId, teacherId],
    );
    await postgresPool.query(
      `INSERT INTO student_enrollments (student_user_id, classroom_id, academic_year_id, status, enrolled_at, created_by_user_id)
       VALUES ($1, $2, $3, 'active', $4::date, $5)`,
      [studentId, classroomId, p.academic_year_id, p.semester_start, adminId],
    );
    const subject = await postgresPool.query<{ id: number }>(
      `INSERT INTO subjects (code, name, subject_group) VALUES ($1, $2, 'other') RETURNING id`,
      [`OVR_${String(suffix).slice(-8)}`, `Override subject ${suffix}`],
    ); subjectId = Number(subject.rows[0].id);
    const curriculum = await postgresPool.query<{ id: number }>(
      `INSERT INTO curriculum_subjects (academic_year_id, subject_id, grade_level, periods_per_week)
       VALUES ($1, $2, 12, 2) RETURNING id`, [p.academic_year_id, subjectId],
    ); curriculumId = Number(curriculum.rows[0].id);
    const assignment = await postgresPool.query<{ id: number }>(
      `INSERT INTO teaching_assignments (teacher_user_id, classroom_id, subject_id, semester_id, status, assigned_at, created_by_user_id)
       VALUES ($1, $2, $3, $4, 'active', $5::date, $6) RETURNING id`,
      [teacherId, classroomId, subjectId, p.semester_id, p.semester_start, adminId],
    );
    await postgresPool.query(
      `INSERT INTO teaching_assignments (teacher_user_id, classroom_id, subject_id, semester_id, status, assigned_at, created_by_user_id)
       VALUES ($1, $2, $3, $4, 'active', $5::date, $6)`,
      [substituteTeacherId, classroomId, subjectId, p.semester_id, p.semester_start, adminId],
    );
    await postgresPool.query(
      `INSERT INTO student_guardian_links (
         guardian_user_id, student_user_id, relationship, status,
         invited_by_user_id, verified_by_user_id, verified_at
       ) VALUES ($1, $2, 'Phụ huynh', 'verified', $3, $3, CURRENT_TIMESTAMP)`,
      [guardianId, studentId, adminId],
    );
    const shift = await postgresPool.query<{ id: number }>(`SELECT id FROM school_shifts WHERE code = 'morning'`);
    const timetable = await postgresPool.query<{ id: number }>(
      `INSERT INTO timetables (classroom_id, school_year, semester, academic_year_id, semester_id, title, status, version_number, is_active, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, 'Override source', 'draft', 1, FALSE, $6) RETURNING id`,
      [classroomId, p.academic_year_name, p.semester_name, p.academic_year_id, p.semester_id, adminId],
    );
    const timetableId = Number(timetable.rows[0].id); timetableIds.push(timetableId);
    const item = await postgresPool.query<{ id: number }>(
      `INSERT INTO timetable_items (timetable_id, day_of_week, shift_id, lesson_index, subject_id, teaching_assignment_id, teacher_user_id, subject_name, teacher_name, room)
       VALUES ($1, 1, $2, 1, $3, $4, $5, $6, $7, 'A101') RETURNING id`,
      [timetableId, shift.rows[0].id, subjectId, assignment.rows[0].id, teacherId, `Override subject ${suffix}`, `Override smoke teacher ${suffix}`],
    );
    await postgresPool.query(`UPDATE timetables SET status = 'published' WHERE id = $1`, [timetableId]);

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const admin = await login(baseUrl, `override-admin-${suffix}@pct.local`, password);
    const teacher = await login(baseUrl, `override-teacher-${suffix}@pct.local`, password);
    const student = await login(baseUrl, `override-student-${suffix}@pct.local`, password);
    const guardian = await login(baseUrl, `override-guardian-${suffix}@pct.local`, password);
    const headers = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
    const overrideDate = nextMonday(p.semester_start);
    assert.ok(overrideDate <= p.semester_end, 'Semester must contain a Monday');
    const options = await fetch(
      `${baseUrl}/schedule-overrides/classrooms/${classroomId}/options?timetable_item_id=${item.rows[0].id}`,
      { headers: headers(teacher.accessToken) },
    );
    assert.equal(options.status, 200);
    const optionBody = await options.json() as ResponseData<{
      substitute_teachers: Array<{ user_id: number }>;
      shifts: Array<{ id: number; periods: Array<{ period_index: number }> }>;
    }>;
    assert.ok(optionBody.data.substitute_teachers.some(
      (candidate) => candidate.user_id === substituteTeacherId,
    ));
    assert.ok(!optionBody.data.substitute_teachers.some(
      (candidate) => candidate.user_id === outsiderTeacherId || candidate.user_id === teacherId,
    ));
    assert.ok(optionBody.data.shifts.some(
      (candidate) => candidate.periods.some((bell) => bell.period_index === 1),
    ));
    const before = await postgresPool.query<{ total: number }>(`SELECT COUNT(*)::integer AS total FROM user_notifications WHERE user_id = $1`, [studentId]);
    const create = await fetch(`${baseUrl}/schedule-overrides/classrooms/${classroomId}`, {
      method: 'POST', headers: headers(teacher.accessToken),
      body: JSON.stringify({ timetable_item_id: item.rows[0].id, override_date: overrideDate, override_type: 'room_change', room: 'B203', reason: 'Phòng học đang bảo trì' }),
    });
    assert.equal(create.status, 201);
    const created = (await create.json() as ResponseData<{ id: number; status: string }>).data; overrideIds.push(created.id);
    assert.equal(created.status, 'proposed');
    const invalidSubstitute = await fetch(`${baseUrl}/schedule-overrides/classrooms/${classroomId}`, {
      method: 'POST', headers: headers(teacher.accessToken),
      body: JSON.stringify({ timetable_item_id: item.rows[0].id, override_date: overrideDate, override_type: 'substitute', substitute_teacher_user_id: outsiderTeacherId, reason: 'Giáo viên thay chưa được phân công' }),
    });
    assert.equal(invalidSubstitute.status, 409);
    const dailyBefore = await fetch(`${baseUrl}/schedule-overrides/classrooms/${classroomId}/daily-schedule?date=${overrideDate}`, { headers: headers(student.accessToken) });
    assert.equal(dailyBefore.status, 200);
    assert.equal((await dailyBefore.json() as ResponseData<{ data: Array<{ room: string }> }>).data.data[0].room, 'A101');
    const teacherPublish = await fetch(`${baseUrl}/schedule-overrides/${created.id}/publish`, { method: 'POST', headers: headers(teacher.accessToken) });
    assert.equal(teacherPublish.status, 403);
    const publish = await fetch(`${baseUrl}/schedule-overrides/${created.id}/publish`, { method: 'POST', headers: headers(admin.accessToken) });
    assert.equal(publish.status, 200);
    const recipientDebug = await postgresPool.query<{ id: number }>(
      `SELECT DISTINCT u.id FROM student_enrollments enrollment JOIN users u ON u.id = enrollment.student_user_id
       WHERE enrollment.classroom_id = $1 AND enrollment.status = 'active'
         AND enrollment.enrolled_at <= $2::date AND (enrollment.ended_at IS NULL OR enrollment.ended_at >= $2::date)`,
      [classroomId, overrideDate],
    );
    assert.ok(recipientDebug.rows.some((row) => Number(row.id) === studentId), 'Student enrollment must be eligible for notification');
    const dailyAfter = await fetch(`${baseUrl}/schedule-overrides/classrooms/${classroomId}/daily-schedule?date=${overrideDate}`, { headers: headers(student.accessToken) });
    assert.equal((await dailyAfter.json() as ResponseData<{ data: Array<{ room: string; override_id: number | null }> }>).data.data[0].room, 'B203');
    const guardianDaily = await fetch(
      `${baseUrl}/schedule-overrides/guardians/students/${studentId}/daily-schedule?date=${overrideDate}`,
      { headers: headers(guardian.accessToken) },
    );
    assert.equal(guardianDaily.status, 200);
    assert.equal(
      (await guardianDaily.json() as ResponseData<{ data: Array<{ room: string }> }>).data.data[0].room,
      'B203',
    );
    const unlinkedDaily = await fetch(
      `${baseUrl}/schedule-overrides/guardians/students/${unlinkedStudentId}/daily-schedule?date=${overrideDate}`,
      { headers: headers(guardian.accessToken) },
    );
    assert.equal(unlinkedDaily.status, 403);
    const after = await postgresPool.query<{ total: number }>(`SELECT COUNT(*)::integer AS total FROM user_notifications WHERE user_id = $1`, [studentId]);
    assert.equal(Number(after.rows[0].total), Number(before.rows[0].total) + 1);
    const teacherDaily = await fetch(`${baseUrl}/schedule-overrides/me?date=${overrideDate}`, { headers: headers(teacher.accessToken) });
    assert.equal(teacherDaily.status, 200);
    assert.ok((await teacherDaily.json() as ResponseData<{ data: Array<{ room: string }> }>).data.data.some((row) => row.room === 'B203'));
    const list = await fetch(`${baseUrl}/schedule-overrides?date=${overrideDate}&status=published`, { headers: headers(admin.accessToken) });
    assert.equal(list.status, 200);
    assert.ok((await list.json() as { data: Array<{ id: number }> }).data.some((row) => row.id === created.id));
    console.log('Schedule override options, proposal, publish, guardian privacy, effective schedule, and notification smoke test passed.');
  } finally {
    await postgresPool.query(`SELECT set_config('app.allow_daily_schedule_override_audit_cleanup', 'on', FALSE)`);
    await postgresPool.query(`DELETE FROM notifications WHERE created_by_user_id = ANY($1::bigint[])`, [userIds]);
    if (overrideIds.length) await postgresPool.query(`DELETE FROM daily_schedule_overrides WHERE id = ANY($1::bigint[])`, [overrideIds]);
    if (timetableIds.length) await postgresPool.query(`DELETE FROM timetables WHERE id = ANY($1::bigint[])`, [timetableIds]);
    if (classroomIds.length) {
      await postgresPool.query(`DELETE FROM student_enrollments WHERE classroom_id = ANY($1::bigint[])`, [classroomIds]);
      await postgresPool.query(`DELETE FROM classroom_members WHERE classroom_id = ANY($1::bigint[])`, [classroomIds]);
      await postgresPool.query(`DELETE FROM teaching_assignments WHERE classroom_id = ANY($1::bigint[])`, [classroomIds]);
      await postgresPool.query(`DELETE FROM classrooms WHERE id = ANY($1::bigint[])`, [classroomIds]);
    }
    if (curriculumId) await postgresPool.query(`DELETE FROM curriculum_subjects WHERE id = $1`, [curriculumId]);
    if (subjectId) await postgresPool.query(`DELETE FROM subjects WHERE id = $1`, [subjectId]);
    if (userIds.length) await postgresPool.query(`DELETE FROM daily_schedule_override_audits WHERE actor_user_id = ANY($1::bigint[])`, [userIds]);
    if (userIds.length) await postgresPool.query(`DELETE FROM users WHERE id = ANY($1::bigint[])`, [userIds]);
    server.close(); await closeDatabasePool();
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
