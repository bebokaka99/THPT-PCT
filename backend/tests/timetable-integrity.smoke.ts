import assert from 'node:assert/strict';
import { postgresPool, closeDatabasePool } from '../src/database/postgres.js';
import {
  findPersonalTeachingTimetable,
  findPublishedTimetableByClassroomId,
  findTimetableConflicts,
  listSchoolShifts,
} from '../src/modules/timetables/timetable.repository.js';
import { previewClassroomTimetableConflicts } from '../src/modules/timetables/timetable.service.js';
import type { AuthUser } from '../src/modules/auth/auth.types.js';
import { hashPassword } from '../src/utils/password.js';

type PeriodRow = {
  academic_year_id: number;
  academic_year_name: string;
  semester_id: number;
  semester_name: string;
  semester_start: string;
};

async function run() {
  const suffix = Date.now();
  const userIds: number[] = [];
  const classroomIds: number[] = [];
  const timetableIds: number[] = [];
  try {
    const shifts = await listSchoolShifts();
    const morning = shifts.find((shift) => shift.code === 'morning');
    const afternoon = shifts.find((shift) => shift.code === 'afternoon');
    assert.equal(morning?.periods.length, 5);
    assert.equal(afternoon?.periods.length, 5);

    const periodResult = await postgresPool.query<PeriodRow>(
      `SELECT year_record.id AS academic_year_id,
        year_record.name AS academic_year_name,
        semester.id AS semester_id,
        semester.name AS semester_name,
        semester.start_date::text AS semester_start
       FROM academic_years year_record
       JOIN semesters semester ON semester.academic_year_id = year_record.id
       WHERE year_record.status <> 'closed' AND year_record.is_locked = FALSE
         AND semester.status <> 'closed' AND semester.is_locked = FALSE
       ORDER BY year_record.start_date DESC, semester.start_date
       LIMIT 1`,
    );
    const period = periodResult.rows[0];
    assert.ok(period, 'A writable semester is required');

    const subjectResult = await postgresPool.query<{ id: number; name: string }>(
      `SELECT id, name FROM subjects WHERE code = 'TOAN'`,
    );
    const subject = subjectResult.rows[0];
    assert.ok(subject, 'TOAN subject is required');
    await postgresPool.query(
      `INSERT INTO curriculum_subjects (
        academic_year_id, subject_id, grade_level, periods_per_week,
        is_required, is_active
      ) VALUES ($1, $2, 12, 4, TRUE, TRUE)
      ON CONFLICT (academic_year_id, subject_id, grade_level)
      DO UPDATE SET is_active = TRUE`,
      [period.academic_year_id, subject.id],
    );

    for (const label of ['one', 'two']) {
      const user = await postgresPool.query<{ id: number }>(
        `INSERT INTO users (email, full_name, password_hash, status)
         VALUES ($1, $2, $3, 'active') RETURNING id`,
        [
          `timetable-${label}-${suffix}@pct.local`,
          `Timetable teacher ${label} ${suffix}`,
          await hashPassword('timetable-smoke-password'),
        ],
      );
      const userId = Number(user.rows[0].id);
      userIds.push(userId);
      await postgresPool.query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT $1, id FROM roles WHERE name = 'teacher'`,
        [userId],
      );
    }

    for (const label of ['A', 'B']) {
      const classroom = await postgresPool.query<{ id: number }>(
        `INSERT INTO classrooms (
          name, school_year, academic_year_id, grade_level, is_active
        ) VALUES ($1, $2, $3, 12, TRUE) RETURNING id`,
        [`TT-${label}-${suffix}`, period.academic_year_name, period.academic_year_id],
      );
      classroomIds.push(Number(classroom.rows[0].id));
    }

    const assignments: number[] = [];
    for (const [teacherId, classroomId] of [
      [userIds[0], classroomIds[0]],
      [userIds[0], classroomIds[1]],
      [userIds[1], classroomIds[1]],
    ]) {
      const assignment = await postgresPool.query<{ id: number }>(
        `INSERT INTO teaching_assignments (
          teacher_user_id, classroom_id, subject_id, semester_id,
          role, status, assigned_at
        ) VALUES ($1, $2, $3, $4, 'primary', 'active', $5)
        RETURNING id`,
        [teacherId, classroomId, subject.id, period.semester_id, period.semester_start],
      );
      assignments.push(Number(assignment.rows[0].id));
    }

    const published = await postgresPool.query<{ id: number }>(
      `INSERT INTO timetables (
        classroom_id, school_year, semester, academic_year_id, semester_id,
        title, status, version_number, is_active
      ) VALUES ($1, $2, $3, $4, $5, 'Published conflict source',
        'draft', 1, FALSE) RETURNING id`,
      [classroomIds[0], period.academic_year_name, period.semester_name,
        period.academic_year_id, period.semester_id],
    );
    const publishedId = Number(published.rows[0].id);
    timetableIds.push(publishedId);
    await postgresPool.query(
      `INSERT INTO timetable_items (
        timetable_id, day_of_week, shift_id, lesson_index, subject_id,
        teaching_assignment_id, teacher_user_id, subject_name, teacher_name,
        room, note
      ) SELECT $1, 1, $2, 1, $3, $4, $5, $6, full_name, 'ROOM-A', NULL
        FROM users WHERE id = $5`,
      [publishedId, morning!.id, subject.id, assignments[0], userIds[0], subject.name],
    );
    await postgresPool.query(
      `UPDATE timetables SET status = 'published' WHERE id = $1`,
      [publishedId],
    );

    const teacherName = `Timetable teacher one ${suffix}`;
    const teacherCandidate = {
      shift_id: morning!.id,
      day_of_week: 1,
      lesson_index: 1,
      subject_id: subject.id,
      teaching_assignment_id: assignments[1],
      teacher_user_id: userIds[0],
      subject_name: subject.name,
      teacher_name: teacherName,
      room: 'ROOM-B',
      note: null,
    };
    const teacherConflict = await findTimetableConflicts(
      classroomIds[1], period.semester_id, [teacherCandidate],
    );
    assert.ok(teacherConflict.some((item) => item.type === 'teacher'));

    const differentShift = await findTimetableConflicts(
      classroomIds[1],
      period.semester_id,
      [{ ...teacherCandidate, shift_id: afternoon!.id }],
    );
    assert.equal(differentShift.length, 0, 'Morning and afternoon periods must be independent slots');

    const roomConflict = await findTimetableConflicts(
      classroomIds[1],
      period.semester_id,
      [{
        ...teacherCandidate,
        teaching_assignment_id: assignments[2],
        teacher_user_id: userIds[1],
        teacher_name: `Timetable teacher two ${suffix}`,
        room: 'ROOM-A',
      }],
    );
    assert.ok(roomConflict.some((item) => item.type === 'room'));

    const admin: AuthUser = {
      id: userIds[0], username: 'smoke-admin', email: null,
      fullName: 'Smoke admin', roles: ['admin'], permissions: ['classrooms.manage'],
    };
    await assert.rejects(
      () => previewClassroomTimetableConflicts(admin, classroomIds[1], {
        title: 'Duplicate classroom slot',
        academic_year_id: period.academic_year_id,
        semester_id: period.semester_id,
        status: 'draft',
        items: [teacherCandidate, {
          ...teacherCandidate,
          teaching_assignment_id: assignments[2],
          teacher_user_id: userIds[1],
          teacher_name: `Timetable teacher two ${suffix}`,
        }],
      }),
      /more than one lesson in the same slot/,
    );

    const draft = await postgresPool.query<{ id: number }>(
      `INSERT INTO timetables (
        classroom_id, school_year, semester, academic_year_id, semester_id,
        title, status, version_number, is_active
      ) VALUES ($1, $2, $3, $4, $5, 'Conflicting draft',
        'draft', 1, FALSE) RETURNING id`,
      [classroomIds[1], period.academic_year_name, period.semester_name,
        period.academic_year_id, period.semester_id],
    );
    const draftId = Number(draft.rows[0].id);
    timetableIds.push(draftId);
    await postgresPool.query(
      `INSERT INTO timetable_items (
        timetable_id, day_of_week, shift_id, lesson_index, subject_id,
        teaching_assignment_id, teacher_user_id, subject_name, teacher_name,
        room, note
      ) VALUES ($1, 1, $2, 1, $3, $4, $5, $6, $7, 'ROOM-B', NULL)`,
      [draftId, morning!.id, subject.id, assignments[1], userIds[0],
        subject.name, teacherName],
    );
    await assert.rejects(
      () => postgresPool.query(`UPDATE timetables SET status = 'published' WHERE id = $1`, [draftId]),
      /TIMETABLE_CONFLICT/,
    );

    assert.equal(await findPublishedTimetableByClassroomId(classroomIds[1]), null,
      'Draft timetable must not be visible as a published classroom schedule');
    const personal = await findPersonalTeachingTimetable(userIds[0]);
    const ownItems = personal.filter((item) => classroomIds.includes(item.classroom_id));
    assert.equal(ownItems.length, 1);
    assert.equal(ownItems[0].classroom_id, classroomIds[0]);

    console.log('Timetable shifts, conflicts, visibility, and DB guard smoke test passed.');
  } finally {
    if (timetableIds.length) {
      await postgresPool.query('DELETE FROM timetables WHERE id = ANY($1::bigint[])', [timetableIds]);
    }
    if (classroomIds.length) {
      await postgresPool.query('DELETE FROM teaching_assignments WHERE classroom_id = ANY($1::bigint[])', [classroomIds]);
      await postgresPool.query('DELETE FROM classrooms WHERE id = ANY($1::bigint[])', [classroomIds]);
    }
    if (userIds.length) {
      await postgresPool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [userIds]);
    }
    await closeDatabasePool();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
