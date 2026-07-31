import type { DatabaseConnection, DatabaseResult, DatabaseRow } from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  PersonalTeachingTimetableItem,
  ResolvedTimetableInput,
  Timetable,
  TimetableItem,
} from './timetable.types.js';

type TimetableRow = DatabaseRow & Omit<Timetable, 'items'>;
type TimetableItemRow = DatabaseRow & TimetableItem;

function mapItem(row: TimetableItemRow): TimetableItem {
  return {
    id: Number(row.id),
    timetable_id: Number(row.timetable_id),
    day_of_week: Number(row.day_of_week),
    lesson_index: Number(row.lesson_index),
    subject_id: row.subject_id === null ? null : Number(row.subject_id),
    teaching_assignment_id:
      row.teaching_assignment_id === null
        ? null
        : Number(row.teaching_assignment_id),
    subject_name: row.subject_name,
    teacher_name: row.teacher_name ?? null,
    room: row.room ?? null,
    note: row.note ?? null,
    created_at: row.created_at,
  };
}

async function insertItems(connection: DatabaseConnection, timetableId: number, items: TimetableItem[]) {
  if (items.length === 0) return;
  await connection.query(
    `
      INSERT INTO timetable_items (
        timetable_id, day_of_week, lesson_index, subject_id,
        teaching_assignment_id, subject_name, teacher_name, room, note
      )
      VALUES ${items.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}
    `,
    items.flatMap((item) => [
      timetableId,
      item.day_of_week,
      item.lesson_index,
      item.subject_id ?? null,
      item.teaching_assignment_id ?? null,
      item.subject_name,
      item.teacher_name ?? null,
      item.room ?? null,
      item.note ?? null,
    ]),
  );
}

export async function findActiveTimetableByClassroomId(classroomId: number) {
  const [rows] = await databasePool.query<TimetableRow[]>(
    'SELECT * FROM timetables WHERE classroom_id = ? AND is_active = TRUE ORDER BY updated_at DESC, id DESC LIMIT 1',
    [classroomId],
  );
  return rows[0] ? findTimetableById(rows[0].id) : null;
}

export async function findPersonalTeachingTimetable(
  teacherUserId: number,
): Promise<PersonalTeachingTimetableItem[]> {
  const [rows] = await databasePool.query<
    Array<TimetableItemRow & PersonalTeachingTimetableItem>
  >(
    `SELECT item.*,
      timetable.classroom_id,
      classroom.name AS classroom_name,
      timetable.school_year,
      timetable.semester,
      timetable.title AS timetable_title
     FROM timetable_items item
     JOIN timetables timetable ON timetable.id = item.timetable_id
     JOIN classrooms classroom ON classroom.id = timetable.classroom_id
     JOIN teaching_assignments assignment
       ON assignment.id = item.teaching_assignment_id
      AND assignment.classroom_id = timetable.classroom_id
      AND assignment.subject_id = item.subject_id
     WHERE assignment.teacher_user_id = ?
       AND assignment.status = 'active'
       AND timetable.is_active = TRUE
       AND classroom.is_active = TRUE
     ORDER BY item.day_of_week ASC, item.lesson_index ASC,
       classroom.name ASC`,
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
  const [rows] = await databasePool.query<TimetableRow[]>('SELECT * FROM timetables WHERE id = ? LIMIT 1', [id]);
  if (!rows[0]) return null;
  const [items] = await databasePool.query<TimetableItemRow[]>(
    'SELECT * FROM timetable_items WHERE timetable_id = ? ORDER BY day_of_week ASC, lesson_index ASC',
    [id],
  );
  return {
    ...rows[0],
    id: Number(rows[0].id),
    classroom_id: Number(rows[0].classroom_id),
    academic_year_id:
      rows[0].academic_year_id === null
        ? null
        : Number(rows[0].academic_year_id),
    semester_id:
      rows[0].semester_id === null ? null : Number(rows[0].semester_id),
    is_active: Boolean(rows[0].is_active),
    items: items.map(mapItem),
  };
}

export async function createTimetableRecord(classroomId: number, input: ResolvedTimetableInput) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    if (input.is_active) {
      await connection.query('UPDATE timetables SET is_active = FALSE WHERE classroom_id = ?', [classroomId]);
    }
    const [result] = await connection.query<DatabaseResult>(
      `INSERT INTO timetables (
        classroom_id, school_year, semester, academic_year_id, semester_id,
        title, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        classroomId,
        input.school_year,
        input.semester ?? null,
        input.academic_year_id,
        input.semester_id ?? null,
        input.title,
        input.is_active ?? true,
      ],
    );
    await insertItems(connection, result.insertId, input.items);
    await connection.commit();
    return findTimetableById(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateTimetableRecord(id: number, input: ResolvedTimetableInput) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    if (input.is_active) {
      const [rows] = await connection.query<TimetableRow[]>('SELECT classroom_id FROM timetables WHERE id = ? LIMIT 1', [id]);
      if (rows[0]) await connection.query('UPDATE timetables SET is_active = FALSE WHERE classroom_id = ?', [rows[0].classroom_id]);
    }
    await connection.query(
      `UPDATE timetables SET school_year = ?, semester = ?,
        academic_year_id = ?, semester_id = ?, title = ?, is_active = ?
       WHERE id = ?`,
      [
        input.school_year,
        input.semester ?? null,
        input.academic_year_id,
        input.semester_id ?? null,
        input.title,
        input.is_active ?? true,
        id,
      ],
    );
    await connection.query('DELETE FROM timetable_items WHERE timetable_id = ?', [id]);
    await insertItems(connection, id, input.items);
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
  const [result] = await databasePool.query<DatabaseResult>('DELETE FROM timetables WHERE id = ?', [id]);
  return result.affectedRows > 0;
}


