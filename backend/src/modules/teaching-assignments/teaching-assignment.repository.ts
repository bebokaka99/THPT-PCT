import type {
  DatabaseConnection,
  DatabaseResult,
  DatabaseRow,
} from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  ListTeachingAssignmentsQuery,
  TeachingAssignment,
  TeachingAssignmentInput,
  TeachingAssignmentRole,
  TeachingAssignmentStatus,
} from './teaching-assignment.types.js';

type AssignmentRow = DatabaseRow & TeachingAssignment;
type CountRow = DatabaseRow & { total: number };

const assignmentSelect = `
  SELECT assignment.*,
    teacher.full_name AS teacher_name,
    teacher.email AS teacher_email,
    classroom.name AS classroom_name,
    classroom.grade_level,
    classroom.academic_year_id,
    academic_year.name AS academic_year_name,
    subject.code AS subject_code,
    subject.name AS subject_name,
    semester.name AS semester_name,
    semester.code AS semester_code
  FROM teaching_assignments assignment
  JOIN users teacher ON teacher.id = assignment.teacher_user_id
  JOIN classrooms classroom ON classroom.id = assignment.classroom_id
  JOIN academic_years academic_year
    ON academic_year.id = classroom.academic_year_id
  JOIN subjects subject ON subject.id = assignment.subject_id
  JOIN semesters semester ON semester.id = assignment.semester_id
`;

function mapDate(value: unknown) {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function mapAssignment(row: AssignmentRow): TeachingAssignment {
  return {
    ...row,
    id: Number(row.id),
    teacher_user_id: Number(row.teacher_user_id),
    classroom_id: Number(row.classroom_id),
    grade_level: Number(row.grade_level),
    academic_year_id: Number(row.academic_year_id),
    subject_id: Number(row.subject_id),
    semester_id: Number(row.semester_id),
    created_by_user_id:
      row.created_by_user_id === null
        ? null
        : Number(row.created_by_user_id),
    assigned_at: mapDate(row.assigned_at),
    ended_at: row.ended_at ? mapDate(row.ended_at) : null,
  };
}

function buildWhere(
  query: ListTeachingAssignmentsQuery,
  forcedTeacherUserId?: number,
) {
  const where: string[] = [];
  const params: Array<string | number> = [];
  const teacherUserId = forcedTeacherUserId ?? query.teacher_user_id;
  if (teacherUserId) {
    where.push('assignment.teacher_user_id = ?');
    params.push(teacherUserId);
  }
  if (query.classroom_id) {
    where.push('assignment.classroom_id = ?');
    params.push(query.classroom_id);
  }
  if (query.subject_id) {
    where.push('assignment.subject_id = ?');
    params.push(query.subject_id);
  }
  if (query.semester_id) {
    where.push('assignment.semester_id = ?');
    params.push(query.semester_id);
  }
  if (query.status) {
    where.push('assignment.status = ?');
    params.push(query.status);
  }
  if (query.q) {
    where.push(`(
      teacher.full_name ILIKE ?
      OR teacher.email ILIKE ?
      OR classroom.name ILIKE ?
      OR subject.name ILIKE ?
      OR subject.code ILIKE ?
    )`);
    const search = `%${query.q}%`;
    params.push(search, search, search, search, search);
  }
  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

export async function findTeachingAssignments(
  query: ListTeachingAssignmentsQuery,
  forcedTeacherUserId?: number,
) {
  const { whereSql, params } = buildWhere(query, forcedTeacherUserId);
  const offset = (query.page - 1) * query.limit;
  const [rows] = await databasePool.query<AssignmentRow[]>(
    `${assignmentSelect}
     ${whereSql}
     ORDER BY academic_year.start_date DESC, semester.start_date DESC,
       classroom.name ASC, subject.name ASC, teacher.full_name ASC
     LIMIT ? OFFSET ?`,
    [...params, query.limit, offset],
  );
  const [countRows] = await databasePool.query<CountRow[]>(
    `SELECT COUNT(*) AS total
     FROM teaching_assignments assignment
     JOIN users teacher ON teacher.id = assignment.teacher_user_id
     JOIN classrooms classroom ON classroom.id = assignment.classroom_id
     JOIN subjects subject ON subject.id = assignment.subject_id
     ${whereSql}`,
    params,
  );
  return {
    data: rows.map(mapAssignment),
    total: Number(countRows[0]?.total ?? 0),
  };
}

export async function findTeachingAssignmentById(id: number) {
  const [rows] = await databasePool.query<AssignmentRow[]>(
    `${assignmentSelect} WHERE assignment.id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? mapAssignment(rows[0]) : null;
}

export async function activeTeachingAssignmentExists(
  input: Pick<
    TeachingAssignmentInput,
    'teacher_user_id' | 'classroom_id' | 'subject_id' | 'semester_id'
  >,
  excludeId?: number,
) {
  const params: number[] = [
    input.teacher_user_id,
    input.classroom_id,
    input.subject_id,
    input.semester_id,
  ];
  const [rows] = await databasePool.query<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
      SELECT 1 FROM teaching_assignments
      WHERE teacher_user_id = ?
        AND classroom_id = ?
        AND subject_id = ?
        AND semester_id = ?
        AND status = 'active'
        ${excludeId ? 'AND id <> ?' : ''}
    ) AS exists`,
    excludeId ? [...params, excludeId] : params,
  );
  return Boolean(rows[0]?.exists);
}

async function insertOnConnection(
  connection: DatabaseConnection,
  input: TeachingAssignmentInput,
  createdByUserId: number,
) {
  const [result] = await connection.query<DatabaseResult>(
    `INSERT INTO teaching_assignments (
      teacher_user_id, classroom_id, subject_id, semester_id, role,
      status, assigned_at, ended_at, note, created_by_user_id
    ) VALUES (?, ?, ?, ?, ?, 'active', ?, NULL, ?, ?)
    RETURNING id`,
    [
      input.teacher_user_id,
      input.classroom_id,
      input.subject_id,
      input.semester_id,
      input.role,
      input.assigned_at,
      input.note ?? null,
      createdByUserId,
    ],
  );
  return result.insertId;
}

export async function insertTeachingAssignment(
  input: TeachingAssignmentInput,
  createdByUserId: number,
) {
  const id = await insertOnConnection(
    databasePool as unknown as DatabaseConnection,
    input,
    createdByUserId,
  );
  return findTeachingAssignmentById(id);
}

export async function insertTeachingAssignments(
  inputs: TeachingAssignmentInput[],
  createdByUserId: number,
) {
  const connection = await databasePool.getConnection();
  const ids: number[] = [];
  try {
    await connection.beginTransaction();
    for (const input of inputs) {
      ids.push(await insertOnConnection(connection, input, createdByUserId));
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return Promise.all(ids.map(findTeachingAssignmentById));
}

export async function updateTeachingAssignmentRecord(
  id: number,
  input: { role: TeachingAssignmentRole; note: string | null },
) {
  await databasePool.query(
    'UPDATE teaching_assignments SET role = ?, note = ? WHERE id = ?',
    [input.role, input.note, id],
  );
  return findTeachingAssignmentById(id);
}

export async function updateTeachingAssignmentStatusRecord(
  id: number,
  status: TeachingAssignmentStatus,
  effectiveDate: string,
) {
  await databasePool.query(
    `UPDATE teaching_assignments
     SET status = ?,
       ended_at = CASE WHEN ? = 'active' THEN NULL ELSE ?::date END
     WHERE id = ?`,
    [status, status, effectiveDate, id],
  );
  return findTeachingAssignmentById(id);
}

export async function canTeachAssignment(
  teacherUserId: number,
  classroomId: number,
  subjectId: number,
  semesterId: number,
) {
  const [rows] = await databasePool.query<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
      SELECT 1
      FROM teaching_assignments
      WHERE teacher_user_id = ?
        AND classroom_id = ?
        AND subject_id = ?
        AND semester_id = ?
        AND status = 'active'
    ) AS exists`,
    [teacherUserId, classroomId, subjectId, semesterId],
  );
  return Boolean(rows[0]?.exists);
}
