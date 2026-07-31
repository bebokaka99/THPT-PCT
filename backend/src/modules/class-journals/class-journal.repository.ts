import type { DatabaseConnection, DatabaseResult, DatabaseRow } from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type { ClassJournal, ClassJournalInput, ClassJournalListQuery } from './class-journal.types.js';

type JournalRow = DatabaseRow & ClassJournal;

const journalSelect = `
  SELECT journal.*, classroom.name AS classroom_name,
    subject.name AS subject_name, semester.name AS semester_name,
    shift.name AS effective_shift_name,
    effective_teacher.full_name AS effective_teacher_name,
    creator.full_name AS created_by_name,
    updater.full_name AS updated_by_name
  FROM class_journal_entries journal
  JOIN classrooms classroom ON classroom.id = journal.classroom_id
  JOIN subjects subject ON subject.id = journal.subject_id
  JOIN semesters semester ON semester.id = journal.semester_id
  JOIN school_shifts shift ON shift.id = journal.effective_shift_id
  JOIN users effective_teacher ON effective_teacher.id = journal.effective_teacher_user_id
  JOIN users creator ON creator.id = journal.created_by_user_id
  LEFT JOIN users updater ON updater.id = journal.updated_by_user_id
`;

function dateValue(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function iso(value: unknown) {
  return value ? (value instanceof Date ? value.toISOString() : String(value)) : null;
}

function mapJournal(row: JournalRow): ClassJournal {
  return {
    ...row,
    id: Number(row.id),
    timetable_item_id: Number(row.timetable_item_id),
    classroom_id: Number(row.classroom_id),
    subject_id: Number(row.subject_id),
    semester_id: Number(row.semester_id),
    journal_date: dateValue(row.journal_date),
    effective_day_of_week: Number(row.effective_day_of_week),
    effective_shift_id: Number(row.effective_shift_id),
    effective_lesson_index: Number(row.effective_lesson_index),
    effective_teacher_user_id: Number(row.effective_teacher_user_id),
    attendance_session_id: row.attendance_session_id === null ? null : Number(row.attendance_session_id),
    created_by_user_id: Number(row.created_by_user_id),
    updated_by_user_id: row.updated_by_user_id === null ? null : Number(row.updated_by_user_id),
    created_at: iso(row.created_at) as string,
    updated_at: iso(row.updated_at) as string,
  };
}

export type EffectiveJournalSlot = {
  timetable_item_id: number;
  classroom_id: number;
  classroom_name: string;
  subject_id: number;
  subject_name: string;
  semester_id: number;
  semester_name: string;
  day_of_week: number;
  shift_id: number;
  shift_name: string;
  lesson_index: number;
  teacher_user_id: number;
  teacher_name: string;
  is_cancelled: boolean;
  override_type: string | null;
};

const effectiveSlotSql = `
  SELECT item.id AS timetable_item_id, timetable.classroom_id,
    classroom.name AS classroom_name, item.subject_id, subject.name AS subject_name,
    timetable.semester_id, semester.name AS semester_name,
    COALESCE(override.new_day_of_week, item.day_of_week) AS day_of_week,
    COALESCE(override.new_shift_id, item.shift_id) AS shift_id,
    COALESCE(new_shift.name, shift.name) AS shift_name,
    COALESCE(override.new_lesson_index, item.lesson_index) AS lesson_index,
    CASE WHEN override.override_type = 'substitute'
      THEN override.substitute_teacher_user_id ELSE item.teacher_user_id END AS teacher_user_id,
    CASE WHEN override.override_type = 'substitute'
      THEN substitute.full_name ELSE COALESCE(item.teacher_name, original_teacher.full_name) END AS teacher_name,
    (override.override_type = 'cancelled') AS is_cancelled,
    override.override_type
  FROM timetable_items item
  JOIN timetables timetable ON timetable.id = item.timetable_id AND timetable.status = 'published'
  JOIN classrooms classroom ON classroom.id = timetable.classroom_id AND classroom.is_active = TRUE
  JOIN semesters semester ON semester.id = timetable.semester_id
  JOIN subjects subject ON subject.id = item.subject_id
  JOIN school_shifts shift ON shift.id = item.shift_id
  LEFT JOIN daily_schedule_overrides override
    ON override.timetable_item_id = item.id AND override.override_date = ?::date AND override.status = 'published'
  LEFT JOIN school_shifts new_shift ON new_shift.id = override.new_shift_id
  LEFT JOIN users substitute ON substitute.id = override.substitute_teacher_user_id
  LEFT JOIN users original_teacher ON original_teacher.id = item.teacher_user_id
`;

export async function findEffectiveJournalSlot(timetableItemId: number, journalDate: string) {
  const [rows] = await databasePool.query<Array<DatabaseRow & EffectiveJournalSlot>>(
    `${effectiveSlotSql} WHERE item.id = ? LIMIT 1`, [journalDate, timetableItemId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    timetable_item_id: Number(row.timetable_item_id),
    classroom_id: Number(row.classroom_id),
    classroom_name: row.classroom_name,
    subject_id: Number(row.subject_id),
    subject_name: row.subject_name,
    semester_id: Number(row.semester_id),
    semester_name: row.semester_name,
    day_of_week: Number(row.day_of_week),
    shift_id: Number(row.shift_id),
    shift_name: row.shift_name,
    lesson_index: Number(row.lesson_index),
    teacher_user_id: Number(row.teacher_user_id),
    teacher_name: row.teacher_name,
    is_cancelled: Boolean(row.is_cancelled),
    override_type: row.override_type ?? null,
  } satisfies EffectiveJournalSlot;
}

function whereForList(query: ClassJournalListQuery, teacherUserId?: number) {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (query.classroom_id) { where.push('journal.classroom_id = ?'); params.push(query.classroom_id); }
  if (query.semester_id) { where.push('journal.semester_id = ?'); params.push(query.semester_id); }
  if (query.from) { where.push('journal.journal_date >= ?::date'); params.push(query.from); }
  if (query.to) { where.push('journal.journal_date <= ?::date'); params.push(query.to); }
  if (query.status) { where.push('journal.status = ?::class_journal_status'); params.push(query.status); }
  if (teacherUserId) {
    where.push('(journal.effective_teacher_user_id = ? OR classroom.homeroom_teacher_user_id = ?)');
    params.push(teacherUserId, teacherUserId);
  }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export async function findClassJournals(query: ClassJournalListQuery, teacherUserId?: number) {
  const { whereSql, params } = whereForList(query, teacherUserId);
  const offset = (query.page - 1) * query.limit;
  const [rows] = await databasePool.query<JournalRow[]>(
    `${journalSelect} ${whereSql} ORDER BY journal.journal_date DESC, journal.effective_lesson_index ASC, journal.id DESC LIMIT ? OFFSET ?`,
    [...params, query.limit, offset],
  );
  const [countRows] = await databasePool.query<Array<{ total: number }>>(
    `SELECT COUNT(*) AS total FROM class_journal_entries journal JOIN classrooms classroom ON classroom.id = journal.classroom_id ${whereSql}`,
    params,
  );
  return { data: rows.map(mapJournal), total: Number(countRows[0]?.total ?? 0) };
}

export async function findClassJournalById(id: number) {
  const [rows] = await databasePool.query<JournalRow[]>(`${journalSelect} WHERE journal.id = ? LIMIT 1`, [id]);
  return rows[0] ? mapJournal(rows[0]) : null;
}

export async function insertClassJournal(slot: EffectiveJournalSlot, input: ClassJournalInput, actorUserId: number) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query<DatabaseResult>(
      `INSERT INTO class_journal_entries (
        timetable_item_id, classroom_id, subject_id, semester_id, journal_date,
        effective_day_of_week, effective_shift_id, effective_lesson_index,
        effective_teacher_user_id, attendance_session_id, lesson_content,
        class_comment, progress_note, homework, status, created_by_user_id, updated_by_user_id
      ) VALUES (?, ?, ?, ?, ?::date, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::class_journal_status, ?, ?)
      RETURNING id`,
      [slot.timetable_item_id, slot.classroom_id, slot.subject_id, slot.semester_id, input.journal_date,
        slot.day_of_week, slot.shift_id, slot.lesson_index, slot.teacher_user_id,
        input.attendance_session_id ?? null, input.lesson_content ?? null, input.class_comment ?? null,
        input.progress_note ?? null, input.homework ?? null, input.status, actorUserId, actorUserId],
    );
    const id = result.insertId;
    await connection.query(
      `INSERT INTO class_journal_audits (journal_entry_id, actor_user_id, action, new_data) VALUES (?, ?, 'create', ?::jsonb)`,
      [id, actorUserId, JSON.stringify(input)],
    );
    await connection.commit();
    return findClassJournalById(id);
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

export async function updateClassJournalRecord(id: number, input: ClassJournalInput, current: ClassJournal, actorUserId: number) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<JournalRow[]>(`SELECT * FROM class_journal_entries WHERE id = ? FOR UPDATE`, [id]);
    if (!rows[0]) { await connection.rollback(); return null; }
    const oldData = rows[0];
    await connection.query(
      `UPDATE class_journal_entries SET attendance_session_id = ?, lesson_content = ?, class_comment = ?, progress_note = ?, homework = ?, status = ?::class_journal_status, updated_by_user_id = ? WHERE id = ?`,
      [input.attendance_session_id ?? null, input.lesson_content ?? null, input.class_comment ?? null, input.progress_note ?? null, input.homework ?? null, input.status, actorUserId, id],
    );
    const action = input.status !== current.status ? (input.status === 'completed' ? 'complete' : input.status === 'cancelled' ? 'cancel' : 'update') : 'update';
    await connection.query(
      `INSERT INTO class_journal_audits (journal_entry_id, actor_user_id, action, reason, old_data, new_data) VALUES (?, ?, ?, ?, ?::jsonb, ?::jsonb)`,
      [id, actorUserId, action, input.correction_reason ?? null, JSON.stringify(oldData), JSON.stringify(input)],
    );
    await connection.commit();
    return findClassJournalById(id);
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

export async function findClassJournalAudits(id: number) {
  const [rows] = await databasePool.query<Array<DatabaseRow & { id: number; actor_user_id: number; actor_name: string }>>(
    `SELECT audit.*, actor.full_name AS actor_name FROM class_journal_audits audit JOIN users actor ON actor.id = audit.actor_user_id WHERE audit.journal_entry_id = ? ORDER BY audit.created_at DESC, audit.id DESC`, [id],
  );
  return rows.map((row) => ({ ...row, id: Number(row.id), actor_user_id: Number(row.actor_user_id) }));
}

export async function findClassJournalReport(query: { from: string; to: string; classroom_id?: number; semester_id?: number }) {
  const params: Array<string | number> = [query.from, query.to, query.from, query.to];
  const filters = ['timetable.status = \'published\'', 'day.day_date BETWEEN ?::date AND ?::date'];
  if (query.classroom_id) { filters.push('timetable.classroom_id = ?'); params.push(query.classroom_id); }
  if (query.semester_id) { filters.push('timetable.semester_id = ?'); params.push(query.semester_id); }
  const [rows] = await databasePool.query<Array<DatabaseRow & { expected_count: number; journal_count: number; completed_count: number; draft_count: number; cancelled_count: number }>>(
    `WITH day AS (SELECT generate_series(?::date, ?::date, interval '1 day')::date AS day_date), expected AS (
       SELECT item.id AS timetable_item_id, timetable.classroom_id, day.day_date
       FROM timetable_items item JOIN timetables timetable ON timetable.id = item.timetable_id CROSS JOIN day
       WHERE ${filters.join(' AND ')} AND EXTRACT(ISODOW FROM day.day_date) = item.day_of_week
     )
     SELECT COUNT(*)::INTEGER AS expected_count,
       COUNT(journal.id)::INTEGER AS journal_count,
       COUNT(journal.id) FILTER (WHERE journal.status = 'completed')::INTEGER AS completed_count,
       COUNT(journal.id) FILTER (WHERE journal.status = 'draft')::INTEGER AS draft_count,
       COUNT(journal.id) FILTER (WHERE journal.status = 'cancelled')::INTEGER AS cancelled_count
     FROM expected LEFT JOIN class_journal_entries journal ON journal.timetable_item_id = expected.timetable_item_id AND journal.journal_date = expected.day_date`, params,
  );
  const [substituteRows] = await databasePool.query<Array<{ total: number }>>(
    `SELECT COUNT(*)::INTEGER AS total FROM daily_schedule_overrides override WHERE override.status = 'published' AND override.override_type = 'substitute' AND override.override_date BETWEEN ?::date AND ?::date${query.classroom_id ? ' AND override.classroom_id = ?' : ''}`,
    query.classroom_id ? [query.from, query.to, query.classroom_id] : [query.from, query.to],
  );
  const row = rows[0];
  return {
    expected_count: Number(row?.expected_count ?? 0),
    journal_count: Number(row?.journal_count ?? 0),
    missing_count: Number(row?.expected_count ?? 0) - Number(row?.journal_count ?? 0),
    completed_count: Number(row?.completed_count ?? 0),
    draft_count: Number(row?.draft_count ?? 0),
    cancelled_count: Number(row?.cancelled_count ?? 0),
    substitute_count: Number(substituteRows[0]?.total ?? 0),
  };
}
