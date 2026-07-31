import type { DatabaseConnection, DatabaseResult, DatabaseRow } from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  PersonalTeachingTimetableItem,
  ResolvedTimetableInput,
  SchoolShift,
  SchoolShiftInput,
  Timetable,
  TimetableConflict,
  TimetableItem,
  TimetableStatus,
} from './timetable.types.js';

type TimetableRow = DatabaseRow & Omit<Timetable, 'items'>;
type TimetableItemRow = DatabaseRow & TimetableItem;

function mapItem(row: TimetableItemRow): TimetableItem {
  return {
    id: Number(row.id),
    timetable_id: Number(row.timetable_id),
    shift_id: Number(row.shift_id),
    shift_code: row.shift_code ?? undefined,
    shift_name: row.shift_name ?? undefined,
    day_of_week: Number(row.day_of_week),
    lesson_index: Number(row.lesson_index),
    subject_id: row.subject_id === null ? null : Number(row.subject_id),
    teaching_assignment_id: row.teaching_assignment_id === null
      ? null
      : Number(row.teaching_assignment_id),
    teacher_user_id: row.teacher_user_id === null ? null : Number(row.teacher_user_id),
    subject_name: row.subject_name,
    teacher_name: row.teacher_name ?? null,
    room: row.room ?? null,
    note: row.note ?? null,
    created_at: row.created_at,
  };
}

async function insertItems(
  connection: DatabaseConnection,
  timetableId: number,
  items: TimetableItem[],
) {
  if (items.length === 0) return;
  await connection.query(
    `INSERT INTO timetable_items (
      timetable_id, day_of_week, shift_id, lesson_index, subject_id,
      teaching_assignment_id, teacher_user_id, subject_name, teacher_name,
      room, note
    ) VALUES ${items.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
    items.flatMap((item) => [
      timetableId,
      item.day_of_week,
      item.shift_id,
      item.lesson_index,
      item.subject_id ?? null,
      item.teaching_assignment_id ?? null,
      item.teacher_user_id ?? null,
      item.subject_name,
      item.teacher_name ?? null,
      item.room ?? null,
      item.note ?? null,
    ]),
  );
}

export async function listSchoolShifts(): Promise<SchoolShift[]> {
  const [rows] = await databasePool.query<Array<DatabaseRow & SchoolShift>>(
    `SELECT shift.*, period.id AS period_id, period.period_index,
      period.starts_at::text, period.ends_at::text,
      period.sort_order AS period_sort_order
     FROM school_shifts shift
     LEFT JOIN bell_periods period ON period.shift_id = shift.id
     ORDER BY shift.sort_order, shift.id, period.sort_order, period.period_index`,
  );
  const shifts = new Map<number, SchoolShift>();
  for (const row of rows) {
    const id = Number(row.id);
    const shift = shifts.get(id) ?? {
      id,
      code: row.code,
      name: row.name,
      sort_order: Number(row.sort_order),
      is_active: Boolean(row.is_active),
      created_at: row.created_at,
      updated_at: row.updated_at,
      periods: [],
    };
    if (row.period_id) {
      shift.periods.push({
        id: Number(row.period_id),
        shift_id: id,
        period_index: Number(row.period_index),
        starts_at: String(row.starts_at).slice(0, 5),
        ends_at: String(row.ends_at).slice(0, 5),
        sort_order: Number(row.period_sort_order),
      });
    }
    shifts.set(id, shift);
  }
  return [...shifts.values()];
}

export async function saveSchoolShift(input: SchoolShiftInput, id?: number) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    let shiftId = id;
    if (shiftId) {
      const [result] = await connection.query<DatabaseResult>(
        `UPDATE school_shifts SET code = ?, name = ?, sort_order = ?, is_active = ?
         WHERE id = ?`,
        [input.code, input.name, input.sort_order ?? 0, input.is_active ?? true, shiftId],
      );
      if (!result.affectedRows) {
        await connection.rollback();
        return null;
      }
    } else {
      const [result] = await connection.query<DatabaseResult>(
        `INSERT INTO school_shifts (code, name, sort_order, is_active)
         VALUES (?, ?, ?, ?) RETURNING id`,
        [input.code, input.name, input.sort_order ?? 0, input.is_active ?? true],
      );
      shiftId = result.insertId;
    }
    await connection.query('DELETE FROM bell_periods WHERE shift_id = ?', [shiftId]);
    await connection.query(
      `INSERT INTO bell_periods (
        shift_id, period_index, starts_at, ends_at, sort_order
      ) VALUES ${input.periods.map(() => '(?, ?, ?, ?, ?)').join(', ')}`,
      input.periods.flatMap((period) => [
        shiftId,
        period.period_index,
        period.starts_at,
        period.ends_at,
        period.sort_order,
      ]),
    );
    await connection.commit();
    return (await listSchoolShifts()).find((shift) => shift.id === shiftId) ?? null;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function findPublishedTimetableByClassroomId(classroomId: number) {
  const [rows] = await databasePool.query<TimetableRow[]>(
    `SELECT * FROM timetables WHERE classroom_id = ? AND status = 'published'
     ORDER BY updated_at DESC, id DESC LIMIT 1`,
    [classroomId],
  );
  return rows[0] ? findTimetableById(Number(rows[0].id)) : null;
}

export async function findLatestTimetableByClassroomId(classroomId: number) {
  const [rows] = await databasePool.query<TimetableRow[]>(
    `SELECT * FROM timetables WHERE classroom_id = ?
     ORDER BY CASE status WHEN 'draft' THEN 0 WHEN 'published' THEN 1 ELSE 2 END,
       version_number DESC, updated_at DESC, id DESC LIMIT 1`,
    [classroomId],
  );
  return rows[0] ? findTimetableById(Number(rows[0].id)) : null;
}

export const findActiveTimetableByClassroomId = findPublishedTimetableByClassroomId;

export async function findPersonalTeachingTimetable(
  teacherUserId: number,
): Promise<PersonalTeachingTimetableItem[]> {
  const [rows] = await databasePool.query<Array<TimetableItemRow & PersonalTeachingTimetableItem>>(
    `SELECT item.*, shift.code AS shift_code, shift.name AS shift_name,
      timetable.classroom_id, classroom.name AS classroom_name,
      timetable.school_year, timetable.semester, timetable.title AS timetable_title
     FROM timetable_items item
     JOIN school_shifts shift ON shift.id = item.shift_id
     JOIN timetables timetable ON timetable.id = item.timetable_id
     JOIN classrooms classroom ON classroom.id = timetable.classroom_id
     WHERE item.teacher_user_id = ?
       AND timetable.status = 'published'
       AND classroom.is_active = TRUE
     ORDER BY item.day_of_week, shift.sort_order, item.lesson_index, classroom.name`,
    [teacherUserId],
  );
  return rows.map((row) => ({
    ...mapItem(row),
    classroom_id: Number(row.classroom_id),
    classroom_name: row.classroom_name,
    school_year: row.school_year,
    semester: row.semester ?? null,
    timetable_title: row.timetable_title,
  }));
}

export async function findTimetableById(id: number) {
  const [rows] = await databasePool.query<TimetableRow[]>(
    'SELECT * FROM timetables WHERE id = ? LIMIT 1',
    [id],
  );
  if (!rows[0]) return null;
  const [items] = await databasePool.query<TimetableItemRow[]>(
    `SELECT item.*, shift.code AS shift_code, shift.name AS shift_name
     FROM timetable_items item
     JOIN school_shifts shift ON shift.id = item.shift_id
     WHERE item.timetable_id = ?
     ORDER BY item.day_of_week, shift.sort_order, item.lesson_index`,
    [id],
  );
  const row = rows[0];
  return {
    ...row,
    id: Number(row.id),
    classroom_id: Number(row.classroom_id),
    academic_year_id: row.academic_year_id === null ? null : Number(row.academic_year_id),
    semester_id: row.semester_id === null ? null : Number(row.semester_id),
    version_number: Number(row.version_number),
    published_by_user_id: row.published_by_user_id === null ? null : Number(row.published_by_user_id),
    created_by_user_id: row.created_by_user_id === null ? null : Number(row.created_by_user_id),
    is_active: Boolean(row.is_active),
    items: items.map(mapItem),
  } as Timetable;
}

export async function findTimetableConflicts(
  classroomId: number,
  semesterId: number | null,
  items: TimetableItem[],
  excludeTimetableId?: number,
): Promise<TimetableConflict[]> {
  const conflicts: TimetableConflict[] = [];
  for (const item of items) {
    const [rows] = await databasePool.query<Array<DatabaseRow & {
      conflict_type: 'teacher' | 'room';
      classroom_id: number;
      classroom_name: string;
      shift_name: string;
    }>>(
      `SELECT DISTINCT
        CASE WHEN other_item.teacher_user_id = ?::BIGINT THEN 'teacher' ELSE 'room' END AS conflict_type,
        other_timetable.classroom_id, classroom.name AS classroom_name,
        shift.name AS shift_name
       FROM timetable_items other_item
       JOIN timetables other_timetable ON other_timetable.id = other_item.timetable_id
       JOIN classrooms classroom ON classroom.id = other_timetable.classroom_id
       JOIN school_shifts shift ON shift.id = other_item.shift_id
       WHERE other_timetable.status = 'published'
         AND other_timetable.semester_id IS NOT DISTINCT FROM ?::BIGINT
         AND other_timetable.classroom_id <> ?
         AND other_timetable.id <> COALESCE(?::BIGINT, 0)
         AND other_item.day_of_week = ?
         AND other_item.shift_id = ?
         AND other_item.lesson_index = ?
         AND (
           (?::BIGINT IS NOT NULL AND other_item.teacher_user_id = ?::BIGINT)
           OR (
             NULLIF(lower(btrim(?::TEXT)), '') IS NOT NULL
             AND lower(btrim(other_item.room)) = lower(btrim(?::TEXT))
           )
         )`,
      [
        item.teacher_user_id ?? null,
        semesterId,
        classroomId,
        excludeTimetableId ?? null,
        item.day_of_week,
        item.shift_id,
        item.lesson_index,
        item.teacher_user_id ?? null,
        item.teacher_user_id ?? null,
        item.room ?? null,
        item.room ?? null,
      ],
    );
    for (const row of rows) {
      const type = row.conflict_type;
      conflicts.push({
        type,
        day_of_week: item.day_of_week,
        shift_id: item.shift_id,
        shift_name: row.shift_name,
        lesson_index: item.lesson_index,
        teacher_name: item.teacher_name,
        room: item.room,
        conflicting_classroom_id: Number(row.classroom_id),
        conflicting_classroom_name: row.classroom_name,
        message: type === 'teacher'
          ? `${item.teacher_name ?? 'Giáo viên'} đã có tiết tại lớp ${row.classroom_name}`
          : `Phòng ${item.room} đã được dùng bởi lớp ${row.classroom_name}`,
      });
    }
  }
  return conflicts;
}

export async function createTimetableRecord(
  classroomId: number,
  input: ResolvedTimetableInput,
  userId: number,
  replacePublishedId?: number,
) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [versionRows] = await connection.query<Array<{ next_version: number }>>(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
       FROM timetables WHERE classroom_id = ? AND semester_id IS NOT DISTINCT FROM ?`,
      [classroomId, input.semester_id ?? null],
    );
    const [result] = await connection.query<DatabaseResult>(
      `INSERT INTO timetables (
        classroom_id, school_year, semester, academic_year_id, semester_id,
        title, status, version_number, is_active, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, FALSE, ?) RETURNING id`,
      [
        classroomId,
        input.school_year,
        input.semester ?? null,
        input.academic_year_id,
        input.semester_id ?? null,
        input.title,
        Number(versionRows[0]?.next_version ?? 1),
        userId,
      ],
    );
    await insertItems(connection, result.insertId, input.items);
    if (input.status === 'published') {
      if (replacePublishedId) {
        await connection.query(
          `UPDATE timetables SET status = 'archived' WHERE id = ?`,
          [replacePublishedId],
        );
      }
      await connection.query(
        `UPDATE timetables SET status = 'published', published_by_user_id = ?
         WHERE id = ?`,
        [userId, result.insertId],
      );
    }
    await connection.commit();
    return findTimetableById(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateTimetableRecord(
  id: number,
  input: ResolvedTimetableInput,
  userId: number,
) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE timetables SET school_year = ?, semester = ?, academic_year_id = ?,
        semester_id = ?, title = ?, status = 'draft', is_active = FALSE,
        published_at = NULL, published_by_user_id = NULL,
        version_number = version_number
       WHERE id = ?`,
      [input.school_year, input.semester ?? null, input.academic_year_id,
        input.semester_id ?? null, input.title, id],
    );
    await connection.query('DELETE FROM timetable_items WHERE timetable_id = ?', [id]);
    await insertItems(connection, id, input.items);
    if (input.status === 'published') {
      await connection.query(
        `UPDATE timetables SET status = 'published', published_by_user_id = ?
         WHERE id = ?`,
        [userId, id],
      );
    }
    await connection.commit();
    return findTimetableById(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function setTimetableStatus(
  id: number,
  status: TimetableStatus,
  userId: number,
) {
  await databasePool.query(
    `UPDATE timetables SET status = ?, published_by_user_id = CASE
       WHEN ? = 'published' THEN ? ELSE published_by_user_id END
     WHERE id = ?`,
    [status, status, userId, id],
  );
  return findTimetableById(id);
}

export async function publishTimetableRecord(
  id: number,
  classroomId: number,
  semesterId: number | null,
  userId: number,
) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE timetables SET status = 'archived'
       WHERE classroom_id = ? AND semester_id IS NOT DISTINCT FROM ?
         AND status = 'published' AND id <> ?`,
      [classroomId, semesterId, id],
    );
    await connection.query(
      `UPDATE timetables SET status = 'published', published_by_user_id = ?
       WHERE id = ?`,
      [userId, id],
    );
    await connection.commit();
    return findTimetableById(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteTimetableRecord(id: number) {
  const [result] = await databasePool.query<DatabaseResult>(
    'DELETE FROM timetables WHERE id = ?',
    [id],
  );
  return result.affectedRows > 0;
}
