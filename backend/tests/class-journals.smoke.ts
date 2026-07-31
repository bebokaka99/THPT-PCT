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
    [email, `Class journal smoke ${role}`, await hashPassword(password)],
  );
  const id = Number(result.rows[0].id);
  await postgresPool.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = $2`, [id, role]);
  return id;
}

async function login(baseUrl: string, email: string, password: string) {
  const response = await fetch(`${baseUrl}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: email, password }) });
  assert.equal(response.status, 200);
  return (await response.json()) as LoginResponse;
}

async function run() {
  const suffix = Date.now();
  const password = 'class-journal-smoke-password';
  const userIds: number[] = [];
  let classroomId = 0;
  let subjectId = 0;
  let curriculumId = 0;
  let assignmentId = 0;
  let substituteAssignmentId = 0;
  let timetableId = 0;
  let itemId = 0;
  let overrideId = 0;
  let journalId = 0;
  const periodResult = await postgresPool.query<{ academic_year_id: number; academic_year_name: string; semester_id: number; semester_start: string; semester_end: string }>(
    `SELECT year_record.id AS academic_year_id, year_record.name AS academic_year_name,
      semester.id AS semester_id, semester.start_date::text AS semester_start,
      semester.end_date::text AS semester_end
     FROM academic_years year_record JOIN semesters semester ON semester.academic_year_id = year_record.id
     WHERE year_record.status <> 'closed' AND semester.status <> 'closed'
     ORDER BY semester.end_date DESC LIMIT 1`,
  );
  assert.ok(periodResult.rows[0]);
  const period = periodResult.rows[0];
  const journalDate = await postgresPool.query<{ date: string }>(
    `SELECT (semester.start_date + ((1 - EXTRACT(ISODOW FROM semester.start_date)::integer + 7) % 7))::text AS date
     FROM semesters semester WHERE semester.id = $1`, [period.semester_id],
  );
  const date = journalDate.rows[0].date;
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try {
    const adminId = await createUser(`journal-admin-${suffix}@pct.local`, 'admin', password);
    const teacherId = await createUser(`journal-teacher-${suffix}@pct.local`, 'teacher', password);
    const substituteId = await createUser(`journal-substitute-${suffix}@pct.local`, 'teacher', password);
    const studentId = await createUser(`journal-student-${suffix}@pct.local`, 'student', password);
    userIds.push(adminId, teacherId, substituteId, studentId);
    const classroom = await postgresPool.query<{ id: number }>(
      `INSERT INTO classrooms (name, school_year, academic_year_id, grade_level, is_active)
       VALUES ($1, $2, $3, 12, TRUE) RETURNING id`, [`JOURNAL-${suffix}`, period.academic_year_name, period.academic_year_id],
    );
    classroomId = Number(classroom.rows[0].id);
    const subject = await postgresPool.query<{ id: number }>(
      `INSERT INTO subjects (code, name, subject_group) VALUES ($1, $2, 'other') RETURNING id`, [`JOURNAL_${String(suffix).slice(-8)}`, `Journal subject ${suffix}`],
    );
    subjectId = Number(subject.rows[0].id);
    const curriculum = await postgresPool.query<{ id: number }>(
      `INSERT INTO curriculum_subjects (academic_year_id, subject_id, grade_level, periods_per_week) VALUES ($1, $2, 12, 2) RETURNING id`, [period.academic_year_id, subjectId],
    );
    curriculumId = Number(curriculum.rows[0].id);
    const assignment = await postgresPool.query<{ id: number }>(
      `INSERT INTO teaching_assignments (teacher_user_id, classroom_id, subject_id, semester_id, status, assigned_at, created_by_user_id) VALUES ($1, $2, $3, $4, 'active', $5::date, $6) RETURNING id`, [teacherId, classroomId, subjectId, period.semester_id, period.semester_start, adminId],
    );
    assignmentId = Number(assignment.rows[0].id);
    const substituteAssignment = await postgresPool.query<{ id: number }>(
      `INSERT INTO teaching_assignments (teacher_user_id, classroom_id, subject_id, semester_id, status, assigned_at, created_by_user_id) VALUES ($1, $2, $3, $4, 'active', $5::date, $6) RETURNING id`, [substituteId, classroomId, subjectId, period.semester_id, period.semester_start, adminId],
    );
    substituteAssignmentId = Number(substituteAssignment.rows[0].id);
    const timetable = await postgresPool.query<{ id: number }>(
      `INSERT INTO timetables (classroom_id, school_year, semester, title, is_active, academic_year_id, semester_id, status, version_number, created_by_user_id) VALUES ($1, $2, $3, $4, FALSE, $5, $6, 'draft', 1, $7) RETURNING id`, [classroomId, period.academic_year_name, '1', 'Journal smoke timetable', period.academic_year_id, period.semester_id, adminId],
    );
    timetableId = Number(timetable.rows[0].id);
    const item = await postgresPool.query<{ id: number }>(
      `INSERT INTO timetable_items (timetable_id, day_of_week, shift_id, lesson_index, subject_id, teaching_assignment_id, teacher_user_id, subject_name, teacher_name) VALUES ($1, 1, 1, 1, $2, $3, $4, $5, $6) RETURNING id`, [timetableId, subjectId, assignmentId, teacherId, `Journal subject ${suffix}`, `Class journal smoke teacher`],
    );
    itemId = Number(item.rows[0].id);
    await postgresPool.query(`UPDATE timetables SET status = 'published', is_active = TRUE, published_at = CURRENT_TIMESTAMP, published_by_user_id = $1 WHERE id = $2`, [adminId, timetableId]);

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const admin = await login(baseUrl, `journal-admin-${suffix}@pct.local`, password);
    const teacher = await login(baseUrl, `journal-teacher-${suffix}@pct.local`, password);
    const substitute = await login(baseUrl, `journal-substitute-${suffix}@pct.local`, password);
    const student = await login(baseUrl, `journal-student-${suffix}@pct.local`, password);
    const headers = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
    const options = await fetch(`${baseUrl}/class-journals/options?date=${date}`, { headers: headers(teacher.accessToken) });
    assert.equal(options.status, 200);
    assert.equal((await options.json() as { data: Array<{ timetable_item_id: number }> }).data.some((entry) => entry.timetable_item_id === itemId), true);

    const create = await fetch(`${baseUrl}/class-journals`, { method: 'POST', headers: headers(teacher.accessToken), body: JSON.stringify({ timetable_item_id: itemId, journal_date: date, lesson_content: 'Nội dung tiết học', status: 'draft' }) });
    assert.equal(create.status, 201);
    journalId = (await create.json() as DataResponse<{ id: number }>).data.id;
    const duplicate = await fetch(`${baseUrl}/class-journals`, { method: 'POST', headers: headers(teacher.accessToken), body: JSON.stringify({ timetable_item_id: itemId, journal_date: date, status: 'draft' }) });
    assert.equal(duplicate.status, 409);
    const studentRead = await fetch(`${baseUrl}/class-journals`, { headers: headers(student.accessToken) });
    assert.equal(studentRead.status, 403);
    const complete = await fetch(`${baseUrl}/class-journals/${journalId}`, { method: 'PATCH', headers: headers(teacher.accessToken), body: JSON.stringify({ timetable_item_id: itemId, journal_date: date, lesson_content: 'Đã hoàn thành bài', status: 'completed' }) });
    assert.equal(complete.status, 200);
    const adminWithoutReason = await fetch(`${baseUrl}/class-journals/${journalId}`, { method: 'PATCH', headers: headers(admin.accessToken), body: JSON.stringify({ timetable_item_id: itemId, journal_date: date, lesson_content: 'Admin chỉnh lý', status: 'completed' }) });
    assert.equal(adminWithoutReason.status, 400);
    const adminCorrection = await fetch(`${baseUrl}/class-journals/${journalId}`, { method: 'PATCH', headers: headers(admin.accessToken), body: JSON.stringify({ timetable_item_id: itemId, journal_date: date, lesson_content: 'Admin chỉnh lý có audit', status: 'completed', correction_reason: 'Sửa nội dung theo biên bản' }) });
    assert.equal(adminCorrection.status, 200);
    const audit = await fetch(`${baseUrl}/class-journals/${journalId}/audit`, { headers: headers(admin.accessToken) });
    assert.equal(audit.status, 200);

    await postgresPool.query(`ALTER TABLE class_journal_audits DISABLE TRIGGER trg_class_journal_audit_immutable`);
    await postgresPool.query(`DELETE FROM class_journal_entries WHERE id = $1`, [journalId]);
    await postgresPool.query(`ALTER TABLE class_journal_audits ENABLE TRIGGER trg_class_journal_audit_immutable`);
    journalId = 0;

    const override = await postgresPool.query<{ id: number }>(
      `INSERT INTO daily_schedule_overrides (classroom_id, timetable_id, timetable_item_id, override_date, override_type, status, substitute_teacher_user_id, reason, created_by_user_id) VALUES ($1, $2, $3, $4::date, 'substitute', 'published', $5, 'Smoke test dạy thay', $6) RETURNING id`, [classroomId, timetableId, itemId, date, substituteId, adminId],
    );
    overrideId = Number(override.rows[0].id);
    const originalAfterOverride = await fetch(`${baseUrl}/class-journals`, { method: 'POST', headers: headers(teacher.accessToken), body: JSON.stringify({ timetable_item_id: itemId, journal_date: date, status: 'completed' }) });
    assert.equal(originalAfterOverride.status, 403);
    const substituteCreate = await fetch(`${baseUrl}/class-journals`, { method: 'POST', headers: headers(substitute.accessToken), body: JSON.stringify({ timetable_item_id: itemId, journal_date: date, status: 'completed' }) });
    assert.equal(substituteCreate.status, 201);
    journalId = (await substituteCreate.json() as DataResponse<{ id: number }>).data.id;
    const report = await fetch(`${baseUrl}/class-journals/report?from=${date}&to=${date}`, { headers: headers(admin.accessToken) });
    assert.equal(report.status, 200);
    console.log('Class journal uniqueness, teacher scope, effective substitute denial, admin correction audit and report passed.');
  } finally {
    await postgresPool.query(`ALTER TABLE class_journal_audits DISABLE TRIGGER trg_class_journal_audit_immutable`);
    try {
      if (journalId) await postgresPool.query(`DELETE FROM class_journal_entries WHERE id = $1`, [journalId]);
    } finally {
      await postgresPool.query(`ALTER TABLE class_journal_audits ENABLE TRIGGER trg_class_journal_audit_immutable`);
    }
    if (overrideId) await postgresPool.query(`DELETE FROM daily_schedule_overrides WHERE id = $1`, [overrideId]);
    if (timetableId) await postgresPool.query(`DELETE FROM timetables WHERE id = $1`, [timetableId]);
    if (substituteAssignmentId) await postgresPool.query(`DELETE FROM teaching_assignments WHERE id = $1`, [substituteAssignmentId]);
    if (assignmentId) await postgresPool.query(`DELETE FROM teaching_assignments WHERE id = $1`, [assignmentId]);
    if (curriculumId) await postgresPool.query(`DELETE FROM curriculum_subjects WHERE id = $1`, [curriculumId]);
    if (subjectId) await postgresPool.query(`DELETE FROM subjects WHERE id = $1`, [subjectId]);
    if (classroomId) await postgresPool.query(`DELETE FROM classrooms WHERE id = $1`, [classroomId]);
    if (userIds.length) await postgresPool.query(`DELETE FROM users WHERE id = ANY($1::bigint[])`, [userIds]);
    server.close();
    await closeDatabasePool();
  }
}

run().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
