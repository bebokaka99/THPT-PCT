import type {
  DatabaseConnection,
  DatabaseResult,
  DatabaseRow,
} from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  AcademicCalendarAudit,
  AcademicCalendarConflict,
  AcademicCalendarEntry,
  AcademicCalendarEntryStatus,
  AcademicCalendarListQuery,
  AcademicCalendarResolvedInput,
  AcademicCalendarScope,
} from './academic-calendar.types.js';

type Row = DatabaseRow & Record<string, any>;
type QueryConnection = Pick<DatabaseConnection, 'query'>;

const entrySelect = `
  SELECT entry.*,
    academic_year.name AS academic_year_name,
    semester.name AS semester_name,
    classroom.name AS classroom_name,
    subject.name AS subject_name,
    teacher.full_name AS teacher_name
  FROM academic_calendar_entries entry
  JOIN academic_years academic_year ON academic_year.id = entry.academic_year_id
  LEFT JOIN semesters semester ON semester.id = entry.semester_id
  LEFT JOIN classrooms classroom ON classroom.id = entry.classroom_id
  LEFT JOIN subjects subject ON subject.id = entry.subject_id
  LEFT JOIN users teacher ON teacher.id = entry.teacher_user_id
`;

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function nullableIso(value: unknown) {
  return value ? iso(value) : null;
}

function mapEntry(row: Row): AcademicCalendarEntry {
  return {
    id: Number(row.id),
    academic_year_id: Number(row.academic_year_id),
    academic_year_name: String(row.academic_year_name),
    semester_id: row.semester_id === null ? null : Number(row.semester_id),
    semester_name: row.semester_name ? String(row.semester_name) : null,
    entry_type: row.entry_type,
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    classroom_id: row.classroom_id === null ? null : Number(row.classroom_id),
    classroom_name: row.classroom_name ? String(row.classroom_name) : null,
    subject_id: row.subject_id === null ? null : Number(row.subject_id),
    subject_name: row.subject_name ? String(row.subject_name) : null,
    teaching_assignment_id: row.teaching_assignment_id === null ? null : Number(row.teaching_assignment_id),
    teacher_user_id: row.teacher_user_id === null ? null : Number(row.teacher_user_id),
    teacher_name: row.teacher_name ? String(row.teacher_name) : null,
    starts_at: iso(row.starts_at),
    ends_at: iso(row.ends_at),
    all_day: Boolean(row.all_day),
    room: row.room ? String(row.room) : null,
    status: row.status,
    revision: Number(row.revision),
    created_by_user_id: row.created_by_user_id === null ? null : Number(row.created_by_user_id),
    published_by_user_id: row.published_by_user_id === null ? null : Number(row.published_by_user_id),
    published_at: nullableIso(row.published_at),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

function buildWhere(query: AcademicCalendarListQuery, scope: AcademicCalendarScope) {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (query.q) {
    where.push('(entry.title ILIKE ? OR entry.description ILIKE ? OR subject.name ILIKE ?)');
    const search = `%${query.q}%`;
    params.push(search, search, search);
  }
  if (query.entry_type) {
    where.push('entry.entry_type = ?::academic_calendar_entry_type');
    params.push(query.entry_type);
  }
  if (query.status) {
    where.push('entry.status = ?::academic_calendar_entry_status');
    params.push(query.status);
  }
  if (query.classroom_id) {
    where.push('entry.classroom_id = ?');
    params.push(query.classroom_id);
  }
  if (query.subject_id) {
    where.push('entry.subject_id = ?');
    params.push(query.subject_id);
  }
  if (query.academic_year_id) {
    where.push('entry.academic_year_id = ?');
    params.push(query.academic_year_id);
  }
  if (query.semester_id) {
    where.push('entry.semester_id = ?');
    params.push(query.semester_id);
  }
  if (query.from) {
    where.push("entry.ends_at >= (?::date AT TIME ZONE 'Asia/Ho_Chi_Minh')");
    params.push(query.from);
  }
  if (query.to) {
    where.push("entry.starts_at < ((?::date + 1) AT TIME ZONE 'Asia/Ho_Chi_Minh')");
    params.push(query.to);
  }

  if (scope.role === 'teacher') {
    where.push(`(
      (entry.teacher_user_id = ? AND entry.status IN ('proposed', 'published'))
      OR (entry.classroom_id IS NULL AND entry.status = 'published')
    )`);
    params.push(scope.userId);
  } else if (scope.role === 'student' || scope.role === 'guardian') {
    const studentId = scope.role === 'student' ? scope.userId : scope.studentId;
    where.push("entry.status = 'published'");
    where.push(`(
      entry.classroom_id IS NULL OR EXISTS (
        SELECT 1 FROM student_enrollments enrollment
        WHERE enrollment.student_user_id = ?
          AND enrollment.classroom_id = entry.classroom_id
          AND enrollment.enrolled_at <= (entry.starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
          AND (enrollment.ended_at IS NULL OR enrollment.ended_at >= (entry.starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
      )
    )`);
    params.push(studentId);
  }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export async function findAcademicCalendarEntries(
  query: AcademicCalendarListQuery,
  scope: AcademicCalendarScope,
) {
  const { whereSql, params } = buildWhere(query, scope);
  const offset = (query.page - 1) * query.limit;
  const [rows] = await databasePool.query<Row[]>(
    `${entrySelect} ${whereSql}
     ORDER BY entry.starts_at ASC, entry.id ASC LIMIT ? OFFSET ?`,
    [...params, query.limit, offset],
  );
  const [counts] = await databasePool.query<Array<{ total: number }>>(
    `SELECT COUNT(*) AS total
     FROM academic_calendar_entries entry
     LEFT JOIN subjects subject ON subject.id = entry.subject_id
     ${whereSql}`,
    params,
  );
  return { data: rows.map(mapEntry), total: Number(counts[0]?.total ?? 0) };
}

export async function findAcademicCalendarEntryById(id: number) {
  const [rows] = await databasePool.query<Row[]>(
    `${entrySelect} WHERE entry.id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? mapEntry(rows[0]) : null;
}

export async function findAcademicCalendarTeachingScope(id: number) {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT assignment.id, assignment.teacher_user_id,
       assignment.classroom_id, assignment.subject_id, assignment.semester_id,
       semester.academic_year_id, assignment.status,
       semester.start_date, semester.end_date
     FROM teaching_assignments assignment
     JOIN semesters semester ON semester.id = assignment.semester_id
     WHERE assignment.id = ? LIMIT 1`,
    [id],
  );
  if (!rows[0]) return null;
  return {
    id: Number(rows[0].id),
    teacher_user_id: Number(rows[0].teacher_user_id),
    classroom_id: Number(rows[0].classroom_id),
    subject_id: Number(rows[0].subject_id),
    semester_id: Number(rows[0].semester_id),
    academic_year_id: Number(rows[0].academic_year_id),
    status: String(rows[0].status),
    start_date: iso(rows[0].start_date).slice(0, 10),
    end_date: iso(rows[0].end_date).slice(0, 10),
  };
}

export async function academicYearExists(id: number) {
  const [rows] = await databasePool.query<Row[]>(
    'SELECT 1 FROM academic_years WHERE id = ? LIMIT 1',
    [id],
  );
  return Boolean(rows[0]);
}

export async function academicPeriodScopeExists(
  academicYearId: number,
  semesterId: number | null,
) {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT 1 FROM academic_years academic_year
     WHERE academic_year.id = ?
       AND (? IS NULL OR EXISTS (
         SELECT 1 FROM semesters semester
         WHERE semester.id = ? AND semester.academic_year_id = academic_year.id
       ))
     LIMIT 1`,
    [academicYearId, semesterId, semesterId],
  );
  return Boolean(rows[0]);
}

export async function guardianCanViewStudent(guardianId: number, studentId: number) {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT 1 FROM student_guardian_links
     WHERE guardian_user_id = ? AND student_user_id = ? AND status = 'verified'
     LIMIT 1`,
    [guardianId, studentId],
  );
  return Boolean(rows[0]);
}

export async function studentCanViewAcademicCalendarEntry(entryId: number, studentId: number) {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT 1 FROM academic_calendar_entries entry
     WHERE entry.id = ? AND entry.status = 'published'
       AND (
         entry.classroom_id IS NULL OR EXISTS (
           SELECT 1 FROM student_enrollments enrollment
           WHERE enrollment.student_user_id = ?
             AND enrollment.classroom_id = entry.classroom_id
             AND enrollment.enrolled_at <= (entry.starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
             AND (enrollment.ended_at IS NULL OR enrollment.ended_at >= (entry.starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
         )
       ) LIMIT 1`,
    [entryId, studentId],
  );
  return Boolean(rows[0]);
}

async function insertAudit(
  connection: QueryConnection,
  entryId: number,
  actorUserId: number,
  action: 'create' | 'update' | 'publish' | 'archive',
  revision: number,
  oldData: AcademicCalendarEntry | null,
) {
  const current = await findEntryByIdWithConnection(connection, entryId);
  await connection.query(
    `INSERT INTO academic_calendar_entry_audits (
       entry_id, actor_user_id, action, revision, old_data, new_data
     ) VALUES (?, ?, ?, ?, ?::jsonb, ?::jsonb)`,
    [entryId, actorUserId, action, revision, oldData ? JSON.stringify(oldData) : null, JSON.stringify(current)],
  );
}

async function findEntryByIdWithConnection(connection: QueryConnection, id: number) {
  const [rows] = await connection.query<Row[]>(
    `${entrySelect} WHERE entry.id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? mapEntry(rows[0]) : null;
}

export async function insertAcademicCalendarEntry(
  input: AcademicCalendarResolvedInput,
  status: 'draft' | 'proposed',
  actorUserId: number,
) {
  const connection = await databasePool.getConnection();
  let id = 0;
  try {
    await connection.beginTransaction();
    const [result] = await connection.query<DatabaseResult>(
      `INSERT INTO academic_calendar_entries (
         academic_year_id, semester_id, entry_type, title, description,
         classroom_id, subject_id, teaching_assignment_id, teacher_user_id,
         starts_at, ends_at, all_day, room, status, created_by_user_id
       ) VALUES (?, ?, ?::academic_calendar_entry_type, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::academic_calendar_entry_status, ?)
       RETURNING id`,
      [input.academic_year_id, input.semester_id, input.entry_type, input.title,
        input.description ?? null, input.classroom_id, input.subject_id,
        input.teaching_assignment_id, input.teacher_user_id, input.starts_at,
        input.ends_at, input.all_day, input.room ?? null, status, actorUserId],
    );
    id = result.insertId;
    await insertAudit(connection, id, actorUserId, 'create', 1, null);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findAcademicCalendarEntryById(id);
}

export async function updateAcademicCalendarEntryRecord(
  id: number,
  input: AcademicCalendarResolvedInput,
  actorUserId: number,
) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const old = await findEntryByIdWithConnection(connection, id);
    if (!old) throw new Error('ACADEMIC_CALENDAR_NOT_FOUND');
    const revision = old.revision + 1;
    await connection.query(
      `UPDATE academic_calendar_entries SET
         academic_year_id = ?, semester_id = ?, entry_type = ?::academic_calendar_entry_type,
         title = ?, description = ?, classroom_id = ?, subject_id = ?,
         teaching_assignment_id = ?, teacher_user_id = ?, starts_at = ?, ends_at = ?,
         all_day = ?, room = ?, revision = ?
       WHERE id = ?`,
      [input.academic_year_id, input.semester_id, input.entry_type, input.title,
        input.description ?? null, input.classroom_id, input.subject_id,
        input.teaching_assignment_id, input.teacher_user_id, input.starts_at,
        input.ends_at, input.all_day, input.room ?? null, revision, id],
    );
    await insertAudit(connection, id, actorUserId, 'update', revision, old);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findAcademicCalendarEntryById(id);
}

export async function setAcademicCalendarEntryStatus(
  id: number,
  status: Extract<AcademicCalendarEntryStatus, 'published' | 'archived'>,
  actorUserId: number,
) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('SELECT pg_advisory_xact_lock(hashtext(?))', ['academic-calendar-publish']);
    const old = await findEntryByIdWithConnection(connection, id);
    if (!old) throw new Error('ACADEMIC_CALENDAR_NOT_FOUND');
    const revision = old.revision + 1;
    await connection.query(
      `UPDATE academic_calendar_entries SET status = ?::academic_calendar_entry_status,
         revision = ?, published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, NOW()) ELSE published_at END,
         published_by_user_id = CASE WHEN ? = 'published' THEN ? ELSE published_by_user_id END
       WHERE id = ?`,
      [status, revision, status, status, actorUserId, id],
    );
    await insertAudit(connection, id, actorUserId, status === 'published' ? 'publish' : 'archive', revision, old);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findAcademicCalendarEntryById(id);
}

export async function deleteAcademicCalendarEntryRecord(id: number) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("SET LOCAL app.allow_academic_calendar_audit_cleanup = 'on'");
    const [result] = await connection.query<DatabaseResult>(
      "DELETE FROM academic_calendar_entries WHERE id = ? AND status IN ('draft', 'proposed')",
      [id],
    );
    await connection.commit();
    return result.affectedRows > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function findAcademicCalendarConflicts(
  input: AcademicCalendarResolvedInput,
  excludeId?: number,
): Promise<AcademicCalendarConflict[]> {
  if (!input.classroom_id && !input.teacher_user_id && !input.room) return [];
  const [calendarRows] = await databasePool.query<Row[]>(
    `SELECT entry.id, entry.title, entry.starts_at, entry.ends_at,
       CASE
         WHEN entry.classroom_id = ? THEN 'classroom'
         WHEN entry.teacher_user_id = ? THEN 'teacher'
         ELSE 'room'
       END AS resource
     FROM academic_calendar_entries entry
     WHERE entry.status = 'published'
       AND entry.id <> COALESCE(?, -1)
       AND tstzrange(entry.starts_at, entry.ends_at, '[)') && tstzrange(?::timestamptz, ?::timestamptz, '[)')
       AND (
         (?::bigint IS NOT NULL AND entry.classroom_id = ?)
         OR (?::bigint IS NOT NULL AND entry.teacher_user_id = ?)
         OR (NULLIF(lower(btrim(?::text)), '') IS NOT NULL AND lower(btrim(entry.room)) = lower(btrim(?::text)))
       )
     ORDER BY entry.starts_at`,
    [input.classroom_id, input.teacher_user_id, excludeId ?? null,
      input.starts_at, input.ends_at, input.classroom_id, input.classroom_id,
      input.teacher_user_id, input.teacher_user_id, input.room ?? null, input.room ?? null],
  );
  const conflicts: AcademicCalendarConflict[] = calendarRows.map((row) => ({
    source: 'academic_calendar',
    resource: row.resource,
    conflicting_id: Number(row.id),
    title: String(row.title),
    starts_at: iso(row.starts_at),
    ends_at: iso(row.ends_at),
    message: `Trùng ${row.resource === 'classroom' ? 'lớp' : row.resource === 'teacher' ? 'giáo viên' : 'phòng'} với lịch ${row.title}`,
  }));

  if (!input.semester_id || input.all_day || !['test', 'exam', 'make_up'].includes(input.entry_type)) return conflicts;
  const [timetableRows] = await databasePool.query<Row[]>(
    `SELECT item.id, timetable.title,
       period.starts_at, period.ends_at,
       CASE
         WHEN timetable.classroom_id = ? THEN 'classroom'
         WHEN item.teacher_user_id = ? THEN 'teacher'
         ELSE 'room'
       END AS resource
     FROM timetables timetable
     JOIN timetable_items item ON item.timetable_id = timetable.id
     JOIN bell_periods period ON period.shift_id = item.shift_id
       AND period.period_index = item.lesson_index
     WHERE timetable.status = 'published'
       AND timetable.semester_id = ?
       AND item.day_of_week = EXTRACT(ISODOW FROM (?::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh'))
       AND period.starts_at < (?::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')::time
       AND period.ends_at > (?::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')::time
       AND (
         timetable.classroom_id = ? OR item.teacher_user_id = ?
         OR (NULLIF(lower(btrim(?::text)), '') IS NOT NULL AND lower(btrim(item.room)) = lower(btrim(?::text)))
       )
       AND NOT (? IN ('test', 'exam') AND item.teaching_assignment_id = ?)
     ORDER BY period.starts_at`,
    [input.classroom_id, input.teacher_user_id, input.semester_id,
      input.starts_at, input.ends_at, input.starts_at, input.classroom_id,
      input.teacher_user_id, input.room ?? null, input.room ?? null,
      input.entry_type, input.teaching_assignment_id],
  );
  for (const row of timetableRows) {
    const localDate = input.starts_at.slice(0, 10);
    conflicts.push({
      source: 'timetable',
      resource: row.resource,
      conflicting_id: Number(row.id),
      title: String(row.title),
      starts_at: `${localDate}T${String(row.starts_at)}+07:00`,
      ends_at: `${localDate}T${String(row.ends_at)}+07:00`,
      message: `Trùng ${row.resource === 'classroom' ? 'lớp' : row.resource === 'teacher' ? 'giáo viên' : 'phòng'} với thời khóa biểu ${row.title}`,
    });
  }
  return conflicts;
}

export async function findAcademicCalendarAudits(entryId: number): Promise<AcademicCalendarAudit[]> {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT audit.*, actor.full_name AS actor_name
     FROM academic_calendar_entry_audits audit
     LEFT JOIN users actor ON actor.id = audit.actor_user_id
     WHERE audit.entry_id = ? ORDER BY audit.revision DESC, audit.id DESC`,
    [entryId],
  );
  return rows.map((row) => ({
    id: Number(row.id), entry_id: Number(row.entry_id),
    actor_user_id: row.actor_user_id === null ? null : Number(row.actor_user_id),
    actor_name: row.actor_name ? String(row.actor_name) : null,
    action: row.action, revision: Number(row.revision),
    old_data: row.old_data ?? null, new_data: row.new_data,
    created_at: iso(row.created_at),
  }));
}
