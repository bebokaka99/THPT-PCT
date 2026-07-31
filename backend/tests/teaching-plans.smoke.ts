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
    [email, `Teaching plan smoke ${role}`, await hashPassword(password)],
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
  const password = 'teaching-plan-smoke-password';
  const userIds: number[] = [];
  let classroomId = 0;
  let subjectId = 0;
  let curriculumId = 0;
  let assignmentId = 0;
  let planId = 0;
  const periodResult = await postgresPool.query<{ academic_year_id: number; academic_year_name: string; semester_id: number; semester_start: string }>(
    `SELECT year_record.id AS academic_year_id, year_record.name AS academic_year_name,
      semester.id AS semester_id, semester.start_date::text AS semester_start
     FROM academic_years year_record JOIN semesters semester ON semester.academic_year_id = year_record.id
     WHERE year_record.status <> 'closed' AND semester.status <> 'closed'
     ORDER BY semester.end_date DESC LIMIT 1`,
  );
  assert.ok(periodResult.rows[0]);
  const period = periodResult.rows[0];
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try {
    const adminId = await createUser(`plan-admin-${suffix}@pct.local`, 'admin', password);
    const teacherId = await createUser(`plan-teacher-${suffix}@pct.local`, 'teacher', password);
    const otherTeacherId = await createUser(`plan-other-${suffix}@pct.local`, 'teacher', password);
    const studentId = await createUser(`plan-student-${suffix}@pct.local`, 'student', password);
    userIds.push(adminId, teacherId, otherTeacherId, studentId);
    const classroom = await postgresPool.query<{ id: number }>(
      `INSERT INTO classrooms (name, school_year, academic_year_id, grade_level, is_active)
       VALUES ($1, $2, $3, 12, TRUE) RETURNING id`,
      [`PLAN-${suffix}`, period.academic_year_name, period.academic_year_id],
    );
    classroomId = Number(classroom.rows[0].id);
    const subject = await postgresPool.query<{ id: number }>(
      `INSERT INTO subjects (code, name, subject_group) VALUES ($1, $2, 'other') RETURNING id`,
      [`PLAN_${String(suffix).slice(-8)}`, `Plan subject ${suffix}`],
    );
    subjectId = Number(subject.rows[0].id);
    const curriculum = await postgresPool.query<{ id: number }>(
      `INSERT INTO curriculum_subjects (academic_year_id, subject_id, grade_level, periods_per_week)
       VALUES ($1, $2, 12, 2) RETURNING id`, [period.academic_year_id, subjectId],
    );
    curriculumId = Number(curriculum.rows[0].id);
    const assignment = await postgresPool.query<{ id: number }>(
      `INSERT INTO teaching_assignments (teacher_user_id, classroom_id, subject_id, semester_id, status, assigned_at, created_by_user_id)
       VALUES ($1, $2, $3, $4, 'active', $5::date, $6) RETURNING id`,
      [teacherId, classroomId, subjectId, period.semester_id, period.semester_start, adminId],
    );
    assignmentId = Number(assignment.rows[0].id);

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const admin = await login(baseUrl, `plan-admin-${suffix}@pct.local`, password);
    const teacher = await login(baseUrl, `plan-teacher-${suffix}@pct.local`, password);
    const otherTeacher = await login(baseUrl, `plan-other-${suffix}@pct.local`, password);
    const student = await login(baseUrl, `plan-student-${suffix}@pct.local`, password);
    const headers = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
    const payload = { teaching_assignment_id: assignmentId, title: 'Kế hoạch học kỳ', week_number: 3, objectives: 'Hoàn thành chương trình', content: 'Tuần 1 đến tuần 18', resources: 'Sách giáo khoa' };
    const create = await fetch(`${baseUrl}/teaching-plans`, { method: 'POST', headers: headers(teacher.accessToken), body: JSON.stringify(payload) });
    assert.equal(create.status, 201);
    const plan = (await create.json() as DataResponse<{ id: number; status: string; version_number: number; week_number: number }>).data;
    planId = plan.id;
    assert.equal(plan.status, 'draft');
    assert.equal(plan.version_number, 1);
    assert.equal(plan.week_number, 3);
    const summary = await fetch(`${baseUrl}/teaching-plans/summary`, { headers: headers(admin.accessToken) });
    assert.equal(summary.status, 200);
    const duplicate = await fetch(`${baseUrl}/teaching-plans`, { method: 'POST', headers: headers(teacher.accessToken), body: JSON.stringify(payload) });
    assert.equal(duplicate.status, 409);
    const otherRead = await fetch(`${baseUrl}/teaching-plans/${planId}`, { headers: headers(otherTeacher.accessToken) });
    assert.equal(otherRead.status, 403);
    const otherCreate = await fetch(`${baseUrl}/teaching-plans`, { method: 'POST', headers: headers(otherTeacher.accessToken), body: JSON.stringify(payload) });
    assert.equal(otherCreate.status, 403);
    const studentList = await fetch(`${baseUrl}/teaching-plans`, { headers: headers(student.accessToken) });
    assert.equal(studentList.status, 403);

    const submit = await fetch(`${baseUrl}/teaching-plans/${planId}/submit`, { method: 'POST', headers: headers(teacher.accessToken) });
    assert.equal(submit.status, 200);
    const editSubmitted = await fetch(`${baseUrl}/teaching-plans/${planId}`, { method: 'PATCH', headers: headers(teacher.accessToken), body: JSON.stringify({ title: 'Không được sửa' }) });
    assert.equal(editSubmitted.status, 409);
    const reject = await fetch(`${baseUrl}/teaching-plans/${planId}/reject`, { method: 'POST', headers: headers(admin.accessToken), body: JSON.stringify({ comment: 'Cần bổ sung mục tiêu cụ thể' }) });
    assert.equal(reject.status, 200);
    const update = await fetch(`${baseUrl}/teaching-plans/${planId}`, { method: 'PATCH', headers: headers(teacher.accessToken), body: JSON.stringify({ title: 'Kế hoạch học kỳ đã chỉnh sửa', objectives: 'Mục tiêu theo tuần' }) });
    assert.equal(update.status, 200);
    const updated = (await update.json() as DataResponse<{ version_number: number; status: string }>).data;
    assert.equal(updated.version_number, 2);
    assert.equal(updated.status, 'draft');
    assert.equal((await fetch(`${baseUrl}/teaching-plans/${planId}/submit`, { method: 'POST', headers: headers(teacher.accessToken) })).status, 200);
    assert.equal((await fetch(`${baseUrl}/teaching-plans/${planId}/approve`, { method: 'POST', headers: headers(admin.accessToken), body: JSON.stringify({ comment: 'Đạt yêu cầu' }) })).status, 200);
    const editApproved = await fetch(`${baseUrl}/teaching-plans/${planId}`, { method: 'PATCH', headers: headers(teacher.accessToken), body: JSON.stringify({ title: 'Sửa âm thầm' }) });
    assert.equal(editApproved.status, 409);
    const counts = await postgresPool.query<{ versions: number; audits: number }>(
      `SELECT (SELECT COUNT(*)::integer FROM teaching_plan_versions WHERE teaching_plan_id = $1) AS versions,
        (SELECT COUNT(*)::integer FROM teaching_plan_audits WHERE teaching_plan_id = $1) AS audits`, [planId],
    );
    assert.equal(Number(counts.rows[0].versions), 2);
    assert.ok(Number(counts.rows[0].audits) >= 6);
    console.log('Teaching plan assignment scope, review workflow, immutable approval, versioning and student denial passed.');
  } finally {
    if (planId) await postgresPool.query(`DELETE FROM teaching_plans WHERE id = $1`, [planId]);
    if (assignmentId) await postgresPool.query(`DELETE FROM teaching_assignments WHERE id = $1`, [assignmentId]);
    if (curriculumId) await postgresPool.query(`DELETE FROM curriculum_subjects WHERE id = $1`, [curriculumId]);
    if (subjectId) await postgresPool.query(`DELETE FROM subjects WHERE id = $1`, [subjectId]);
    if (classroomId) await postgresPool.query(`DELETE FROM classrooms WHERE id = $1`, [classroomId]);
    if (userIds.length) await postgresPool.query(`DELETE FROM users WHERE id = ANY($1::bigint[])`, [userIds]);
    server.close();
    await closeDatabasePool();
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
