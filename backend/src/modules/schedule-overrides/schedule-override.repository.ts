import type { DatabaseConnection, DatabaseResult, DatabaseRow } from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type { DailyScheduleItem, ScheduleOverride, ScheduleOverrideInput, ScheduleOverrideQuery } from './schedule-override.types.js';

type Row = DatabaseRow & Record<string, any>;

function mapDate(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return new Date(text).toISOString().slice(0, 10);
}

export async function findPublishedTimetableItemContext(itemId: number) {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT item.id, item.timetable_id, item.teacher_user_id, item.subject_id,
      item.subject_name,
      item.day_of_week, item.shift_id, item.lesson_index, item.room,
      timetable.classroom_id, timetable.semester_id, timetable.status
     FROM timetable_items item
     JOIN timetables timetable ON timetable.id = item.timetable_id
     WHERE item.id = ? AND timetable.status = 'published'
     LIMIT 1`,
    [itemId],
  );
  if (!rows[0]) return null;
  return {
    id: Number(rows[0].id),
    timetable_id: Number(rows[0].timetable_id),
    classroom_id: Number(rows[0].classroom_id),
    semester_id: rows[0].semester_id === null ? null : Number(rows[0].semester_id),
    teacher_user_id: rows[0].teacher_user_id === null ? null : Number(rows[0].teacher_user_id),
    subject_id: rows[0].subject_id === null ? null : Number(rows[0].subject_id),
    subject_name: String(rows[0].subject_name),
    day_of_week: Number(rows[0].day_of_week),
    shift_id: Number(rows[0].shift_id),
    lesson_index: Number(rows[0].lesson_index),
    room: rows[0].room ?? null,
  };
}

export async function findEligibleSubstituteTeachers(input: {
  classroomId: number;
  subjectId: number;
  semesterId: number;
  excludeTeacherUserId: number | null;
}) {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT DISTINCT teacher.id AS user_id, teacher.full_name, teacher.email
     FROM teaching_assignments assignment
     JOIN users teacher ON teacher.id = assignment.teacher_user_id
     JOIN user_roles user_role ON user_role.user_id = teacher.id
     JOIN roles role ON role.id = user_role.role_id AND role.name = 'teacher'
     WHERE assignment.classroom_id = ?
       AND assignment.subject_id = ?
       AND assignment.semester_id = ?
       AND assignment.status = 'active'
       AND teacher.status = 'active'
       AND (?::BIGINT IS NULL OR teacher.id <> ?::BIGINT)
     ORDER BY teacher.full_name, teacher.id`,
    [
      input.classroomId,
      input.subjectId,
      input.semesterId,
      input.excludeTeacherUserId,
      input.excludeTeacherUserId,
    ],
  );
  return rows.map((row) => ({
    user_id: Number(row.user_id),
    full_name: String(row.full_name),
    email: row.email ? String(row.email) : null,
  }));
}

export async function findPublishedOverrideConflicts(input: {
  classroomId: number;
  timetableId: number;
  timetableItemId: number;
  semesterId: number | null;
  date: string;
  dayOfWeek: number;
  shiftId: number;
  lessonIndex: number;
  teacherUserId: number | null;
  room: string | null;
}) {
  const [rows] = await databasePool.query<Row[]>(
    `
      WITH occupied AS (
        SELECT item.timetable_id, timetable.classroom_id,
          item.day_of_week, item.shift_id, item.lesson_index,
          item.teacher_user_id, item.room,
          classroom.name AS classroom_name
        FROM timetable_items item
        JOIN timetables timetable ON timetable.id = item.timetable_id
          AND timetable.status = 'published'
          AND timetable.semester_id IS NOT DISTINCT FROM ?::BIGINT
        JOIN classrooms classroom ON classroom.id = timetable.classroom_id
        WHERE item.id <> ?
        UNION ALL
        SELECT item.timetable_id, timetable.classroom_id,
          COALESCE(override.new_day_of_week, item.day_of_week),
          COALESCE(override.new_shift_id, item.shift_id),
          COALESCE(override.new_lesson_index, item.lesson_index),
          COALESCE(override.substitute_teacher_user_id, item.teacher_user_id),
          COALESCE(override.room, item.room),
          classroom.name
        FROM daily_schedule_overrides override
        JOIN timetable_items item ON item.id = override.timetable_item_id
        JOIN timetables timetable ON timetable.id = item.timetable_id
          AND timetable.status = 'published'
          AND timetable.semester_id IS NOT DISTINCT FROM ?::BIGINT
        JOIN classrooms classroom ON classroom.id = timetable.classroom_id
        WHERE override.status = 'published'
          AND override.override_date = ?::date
          AND override.override_type <> 'cancelled'
          AND override.id <> COALESCE(?::BIGINT, 0)
      )
      SELECT CASE
        WHEN occupied.classroom_id = ? THEN 'classroom'
        WHEN ?::BIGINT IS NOT NULL AND occupied.teacher_user_id = ?::BIGINT THEN 'teacher'
        ELSE 'room'
      END AS conflict_type,
      occupied.classroom_id, occupied.classroom_name
      FROM occupied
      WHERE occupied.day_of_week = ?
        AND occupied.shift_id = ?
        AND occupied.lesson_index = ?
        AND (
          occupied.classroom_id = ?
          OR (
            (?::BIGINT IS NOT NULL AND occupied.teacher_user_id = ?::BIGINT)
            OR (NULLIF(lower(btrim(?::TEXT)), '') IS NOT NULL
              AND lower(btrim(occupied.room)) = lower(btrim(?::TEXT)))
          )
        )
      LIMIT 10
    `,
    [
      input.semesterId, input.timetableItemId,
      input.semesterId, input.date, null,
      input.classroomId, input.teacherUserId, input.teacherUserId,
      input.dayOfWeek, input.shiftId, input.lessonIndex, input.classroomId,
      input.teacherUserId, input.teacherUserId, input.room, input.room,
    ],
  );
  return rows.map((row) => ({
    type: row.conflict_type as 'teacher' | 'room' | 'classroom',
    classroom_id: Number(row.classroom_id),
    classroom_name: row.classroom_name,
  }));
}

const overrideSelect = `
  SELECT override.*,
    classroom.name AS classroom_name,
    item.day_of_week AS original_day_of_week,
    item.shift_id AS original_shift_id,
    original_shift.name AS original_shift_name,
    item.lesson_index AS original_lesson_index,
    item.subject_id,
    item.subject_name,
    item.teacher_user_id AS original_teacher_user_id,
    original_teacher.full_name AS original_teacher_name,
    substitute.full_name AS substitute_teacher_name,
    new_shift.name AS new_shift_name,
    creator.full_name AS created_by_name,
    approver.full_name AS approved_by_name
  FROM daily_schedule_overrides override
  JOIN classrooms classroom ON classroom.id = override.classroom_id
  JOIN timetable_items item ON item.id = override.timetable_item_id
  JOIN school_shifts original_shift ON original_shift.id = item.shift_id
  LEFT JOIN users original_teacher ON original_teacher.id = item.teacher_user_id
  LEFT JOIN users substitute ON substitute.id = override.substitute_teacher_user_id
  LEFT JOIN school_shifts new_shift ON new_shift.id = override.new_shift_id
  JOIN users creator ON creator.id = override.created_by_user_id
  LEFT JOIN users approver ON approver.id = override.approved_by_user_id
`;

function mapOverride(row: Row): ScheduleOverride {
  return {
    id: Number(row.id),
    classroom_id: Number(row.classroom_id),
    classroom_name: row.classroom_name,
    timetable_id: Number(row.timetable_id),
    timetable_item_id: Number(row.timetable_item_id),
    override_date: mapDate(row.override_date),
    override_type: row.override_type,
    status: row.status,
    substitute_teacher_user_id: row.substitute_teacher_user_id === null ? null : Number(row.substitute_teacher_user_id),
    substitute_teacher_name: row.substitute_teacher_name ?? null,
    original_day_of_week: Number(row.original_day_of_week),
    original_shift_id: Number(row.original_shift_id),
    original_shift_name: row.original_shift_name,
    original_lesson_index: Number(row.original_lesson_index),
    subject_id: row.subject_id === null ? null : Number(row.subject_id),
    subject_name: row.subject_name,
    original_teacher_user_id: row.original_teacher_user_id === null ? null : Number(row.original_teacher_user_id),
    original_teacher_name: row.original_teacher_name ?? null,
    new_day_of_week: row.new_day_of_week === null ? null : Number(row.new_day_of_week),
    new_shift_id: row.new_shift_id === null ? null : Number(row.new_shift_id),
    new_shift_name: row.new_shift_name ?? null,
    new_lesson_index: row.new_lesson_index === null ? null : Number(row.new_lesson_index),
    room: row.room ?? null,
    reason: row.reason,
    created_by_user_id: Number(row.created_by_user_id),
    created_by_name: row.created_by_name,
    approved_by_user_id: row.approved_by_user_id === null ? null : Number(row.approved_by_user_id),
    approved_by_name: row.approved_by_name ?? null,
    published_at: row.published_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function findOverrideById(id: number) {
  const [rows] = await databasePool.query<Row[]>(`${overrideSelect} WHERE override.id = ? LIMIT 1`, [id]);
  return rows[0] ? mapOverride(rows[0]) : null;
}

export async function findClassroomOverrides(classroomId: number, query: ScheduleOverrideQuery) {
  const where = ['override.classroom_id = ?'];
  const params: Array<number | string> = [classroomId];
  if (query.date) { where.push('override.override_date = ?::date'); params.push(query.date); }
  if (query.status) { where.push('override.status = ?::daily_schedule_override_status'); params.push(query.status); }
  const [rows] = await databasePool.query<Row[]>(
    `${overrideSelect} WHERE ${where.join(' AND ')} ORDER BY override.override_date DESC, override.created_at DESC, override.id DESC`,
    params,
  );
  return rows.map(mapOverride);
}

export async function findAllOverrides(query: ScheduleOverrideQuery) {
  const where: string[] = [];
  const params: Array<number | string> = [];
  if (query.date) { where.push('override.override_date = ?::date'); params.push(query.date); }
  if (query.status) { where.push('override.status = ?::daily_schedule_override_status'); params.push(query.status); }
  const [rows] = await databasePool.query<Row[]>(
    `${overrideSelect}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}
     ORDER BY override.override_date DESC, override.created_at DESC, override.id DESC`,
    params,
  );
  return rows.map(mapOverride);
}

export async function findPublishedOverridesForDate(classroomId: number, date: string) {
  const [rows] = await databasePool.query<Row[]>(
    `${overrideSelect} WHERE override.classroom_id = ? AND override.override_date = ?::date AND override.status = 'published'`,
    [classroomId, date],
  );
  return rows.map(mapOverride);
}

export async function findDailyScheduleForTeacher(teacherUserId: number, date: string): Promise<DailyScheduleItem[]> {
  const [rows] = await databasePool.query<Row[]>(
    `
      SELECT item.*, timetable.classroom_id, classroom.name AS classroom_name,
        override.id AS override_id, override.override_type, override.status AS override_status,
        override.new_day_of_week, override.new_shift_id, override.new_lesson_index,
        override.room AS override_room, override.substitute_teacher_user_id,
        substitute.full_name AS substitute_teacher_name,
        shift.name AS shift_name, new_shift.name AS new_shift_name,
        original_teacher.full_name AS original_teacher_name
      FROM timetable_items item
      JOIN timetables timetable ON timetable.id = item.timetable_id AND timetable.status = 'published'
      JOIN classrooms classroom ON classroom.id = timetable.classroom_id AND classroom.is_active = TRUE
      JOIN school_shifts shift ON shift.id = item.shift_id
      LEFT JOIN daily_schedule_overrides override
        ON override.timetable_item_id = item.id
       AND override.override_date = ?::date
       AND override.status = 'published'
      LEFT JOIN users substitute ON substitute.id = override.substitute_teacher_user_id
      LEFT JOIN users original_teacher ON original_teacher.id = item.teacher_user_id
      LEFT JOIN school_shifts new_shift ON new_shift.id = override.new_shift_id
      WHERE ((item.teacher_user_id = ? AND COALESCE(override.override_type::text, '') <> 'substitute')
         OR override.substitute_teacher_user_id = ?)
        AND (item.day_of_week = EXTRACT(ISODOW FROM ?::date) OR override.id IS NOT NULL)
      ORDER BY COALESCE(override.new_day_of_week, item.day_of_week),
        COALESCE(new_shift.sort_order, shift.sort_order),
        COALESCE(override.new_lesson_index, item.lesson_index), classroom.name
    `,
    [date, teacherUserId, teacherUserId, date],
  );
  return rows.map((row) => mapDailyRow(row, row.substitute_teacher_user_id === teacherUserId));
}

function mapDailyRow(row: Row, substituteIsViewer = false): DailyScheduleItem {
  const cancelled = row.override_type === 'cancelled';
  const isSubstitute = Boolean(substituteIsViewer && row.substitute_teacher_user_id);
  return {
    id: Number(row.id),
    timetable_item_id: Number(row.id),
    classroom_id: Number(row.classroom_id),
    classroom_name: row.classroom_name,
    timetable_id: Number(row.timetable_id),
    override_id: row.override_id === null ? null : Number(row.override_id),
    override_type: row.override_type ?? null,
    override_status: row.override_status ?? null,
    is_cancelled: cancelled,
    day_of_week: Number(row.new_day_of_week ?? row.day_of_week),
    shift_id: Number(row.new_shift_id ?? row.shift_id),
    shift_name: row.new_shift_name ?? row.shift_name,
    lesson_index: Number(row.new_lesson_index ?? row.lesson_index),
    subject_id: row.subject_id === null ? null : Number(row.subject_id),
    subject_name: row.subject_name,
    teacher_user_id: isSubstitute ? Number(row.substitute_teacher_user_id) : (row.teacher_user_id === null ? null : Number(row.teacher_user_id)),
    teacher_name: isSubstitute ? row.substitute_teacher_name : (row.teacher_name ?? row.original_teacher_name ?? null),
    room: row.override_room ?? row.room ?? null,
    note: row.note ?? null,
    original_day_of_week: Number(row.day_of_week),
    original_shift_id: Number(row.shift_id),
    original_lesson_index: Number(row.lesson_index),
  };
}

export async function findClassroomDailySchedule(classroomId: number, date: string): Promise<DailyScheduleItem[]> {
  const [rows] = await databasePool.query<Row[]>(
    `
      SELECT item.*, timetable.classroom_id, classroom.name AS classroom_name,
        override.id AS override_id, override.override_type, override.status AS override_status,
        override.new_day_of_week, override.new_shift_id, override.new_lesson_index,
        override.room AS override_room, override.substitute_teacher_user_id,
        substitute.full_name AS substitute_teacher_name,
        shift.name AS shift_name, new_shift.name AS new_shift_name,
        original_teacher.full_name AS original_teacher_name
      FROM timetable_items item
      JOIN timetables timetable ON timetable.id = item.timetable_id AND timetable.status = 'published'
      JOIN classrooms classroom ON classroom.id = timetable.classroom_id AND classroom.is_active = TRUE
      JOIN school_shifts shift ON shift.id = item.shift_id
      LEFT JOIN daily_schedule_overrides override
        ON override.timetable_item_id = item.id
       AND override.override_date = ?::date
       AND override.status = 'published'
      LEFT JOIN users substitute ON substitute.id = override.substitute_teacher_user_id
      LEFT JOIN users original_teacher ON original_teacher.id = item.teacher_user_id
      LEFT JOIN school_shifts new_shift ON new_shift.id = override.new_shift_id
      WHERE item.timetable_id = timetable.id AND timetable.classroom_id = ?
        AND (item.day_of_week = EXTRACT(ISODOW FROM ?::date) OR override.id IS NOT NULL)
      ORDER BY COALESCE(override.new_day_of_week, item.day_of_week),
        COALESCE(new_shift.sort_order, shift.sort_order),
        COALESCE(override.new_lesson_index, item.lesson_index)
    `,
    [date, classroomId, date],
  );
  return rows.map((row) => mapDailyRow(row));
}

async function audit(connection: DatabaseConnection, overrideId: number, actorUserId: number, action: string, oldData: unknown, newData: unknown) {
  await connection.query(
    `INSERT INTO daily_schedule_override_audits (override_id, actor_user_id, action, old_data, new_data)
     VALUES (?, ?, ?, ?::jsonb, ?::jsonb)`,
    [overrideId, actorUserId, action, JSON.stringify(oldData ?? null), JSON.stringify(newData ?? null)],
  );
}

export async function createOverrideRecord(classroomId: number, input: ScheduleOverrideInput, actorUserId: number, status: 'draft' | 'proposed') {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query<DatabaseResult>(
      `INSERT INTO daily_schedule_overrides (
        classroom_id, timetable_id, timetable_item_id, override_date, override_type, status,
        substitute_teacher_user_id, new_day_of_week, new_shift_id, new_lesson_index, room,
        reason, created_by_user_id
      )
      SELECT ?, item.timetable_id, item.id, ?::date, ?::daily_schedule_override_type, ?::daily_schedule_override_status,
        ?, ?, ?, ?, ?, ?, ?
      FROM timetable_items item
      WHERE item.id = ?
      RETURNING id`,
      [classroomId, input.override_date, input.override_type, status,
        input.substitute_teacher_user_id ?? null, input.new_day_of_week ?? null,
        input.new_shift_id ?? null, input.new_lesson_index ?? null, input.room ?? null,
        input.reason, actorUserId, input.timetable_item_id],
    );
    if (!result.insertId) throw new Error('SCHEDULE_OVERRIDE_CREATE_FAILED');
    await audit(connection, result.insertId, actorUserId, 'create', null, input);
    await connection.commit();
    return findOverrideById(result.insertId);
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

export async function updateOverrideRecord(id: number, input: ScheduleOverrideInput, actorUserId: number) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [currentRows] = await connection.query<Row[]>('SELECT * FROM daily_schedule_overrides WHERE id = ? FOR UPDATE', [id]);
    const current = currentRows[0];
    if (!current) { await connection.rollback(); return null; }
    await connection.query(
      `UPDATE daily_schedule_overrides SET override_type = ?::daily_schedule_override_type,
        substitute_teacher_user_id = ?, new_day_of_week = ?, new_shift_id = ?, new_lesson_index = ?,
        room = ?, reason = ?, status = ?::daily_schedule_override_status,
        approved_by_user_id = NULL, published_at = NULL
       WHERE id = ?`,
      [input.override_type, input.substitute_teacher_user_id ?? null, input.new_day_of_week ?? null,
        input.new_shift_id ?? null, input.new_lesson_index ?? null, input.room ?? null,
        input.reason, input.status ?? 'draft', id],
    );
    await audit(connection, id, actorUserId, 'update', current, input);
    await connection.commit();
    return findOverrideById(id);
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

export async function setOverrideStatus(id: number, status: 'published' | 'archived', actorUserId: number) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [currentRows] = await connection.query<Row[]>('SELECT * FROM daily_schedule_overrides WHERE id = ? FOR UPDATE', [id]);
    const current = currentRows[0];
    if (!current) { await connection.rollback(); return null; }
    const [result] = await connection.query<DatabaseResult>(
      `UPDATE daily_schedule_overrides SET status = ?::daily_schedule_override_status,
        approved_by_user_id = CASE WHEN ? = 'published' THEN ? ELSE approved_by_user_id END,
        published_at = CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE published_at END
       WHERE id = ?`,
      [status, status, actorUserId, status, id],
    );
    if (!result.affectedRows) { await connection.rollback(); return null; }
    await audit(connection, id, actorUserId, status === 'published' ? 'publish' : 'archive', current, { status });
    await connection.commit();
    return findOverrideById(id);
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

export async function deleteOverrideRecord(id: number, actorUserId: number) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [currentRows] = await connection.query<Row[]>('SELECT * FROM daily_schedule_overrides WHERE id = ? FOR UPDATE', [id]);
    const current = currentRows[0];
    if (!current) { await connection.rollback(); return false; }
    await audit(connection, id, actorUserId, 'delete', current, null);
    await connection.query("SELECT set_config('app.allow_daily_schedule_override_audit_cleanup', 'on', TRUE)");
    const [result] = await connection.query<DatabaseResult>('DELETE FROM daily_schedule_overrides WHERE id = ?', [id]);
    await connection.commit();
    return result.affectedRows > 0;
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

export async function findOverrideAudit(id: number) {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT audit.*, actor.full_name AS actor_name
     FROM daily_schedule_override_audits audit
     JOIN users actor ON actor.id = audit.actor_user_id
     WHERE audit.override_id = ? ORDER BY audit.created_at DESC, audit.id DESC`,
    [id],
  );
  return rows.map((row) => ({ ...row, id: Number(row.id), override_id: Number(row.override_id), actor_user_id: Number(row.actor_user_id) }));
}
