import type {
  DatabaseConnection,
  DatabaseResult,
  DatabaseRow,
} from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  CreateEnrollmentInput,
  EndEnrollmentInput,
  ListEnrollmentsQuery,
  StudentEnrollment,
  TransferEnrollmentInput,
} from './enrollment.types.js';

type EnrollmentRow = DatabaseRow & StudentEnrollment;
type CountRow = DatabaseRow & { total: number };

const enrollmentSelect = `
  SELECT enrollment.*,
    profile.student_code,
    student.username,
    student.email,
    student.full_name,
    classroom.name AS classroom_name,
    academic_year.name AS academic_year_name
  FROM student_enrollments enrollment
  JOIN users student ON student.id = enrollment.student_user_id
  LEFT JOIN student_profiles profile ON profile.user_id = student.id
  JOIN classrooms classroom ON classroom.id = enrollment.classroom_id
  JOIN academic_years academic_year
    ON academic_year.id = enrollment.academic_year_id
`;

function dateValue(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mapEnrollment(row: EnrollmentRow): StudentEnrollment {
  return {
    id: Number(row.id),
    student_user_id: Number(row.student_user_id),
    student_code: row.student_code ?? null,
    username: row.username ?? null,
    email: row.email ?? null,
    full_name: row.full_name,
    classroom_id: Number(row.classroom_id),
    classroom_name: row.classroom_name,
    academic_year_id: Number(row.academic_year_id),
    academic_year_name: row.academic_year_name,
    status: row.status,
    enrolled_at: dateValue(row.enrolled_at),
    ended_at: row.ended_at ? dateValue(row.ended_at) : null,
    previous_enrollment_id:
      row.previous_enrollment_id === null
        ? null
        : Number(row.previous_enrollment_id),
    note: row.note ?? null,
    created_by_user_id:
      row.created_by_user_id === null
        ? null
        : Number(row.created_by_user_id),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function findEnrollments(query: ListEnrollmentsQuery) {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (query.q) {
    where.push(`(
      student.full_name ILIKE ?
      OR student.username ILIKE ?
      OR student.email ILIKE ?
      OR profile.student_code ILIKE ?
    )`);
    const keyword = `%${query.q}%`;
    params.push(keyword, keyword, keyword, keyword);
  }
  if (query.academic_year_id) {
    where.push('enrollment.academic_year_id = ?');
    params.push(query.academic_year_id);
  }
  if (query.classroom_id) {
    where.push('enrollment.classroom_id = ?');
    params.push(query.classroom_id);
  }
  if (query.status) {
    where.push('enrollment.status = ?');
    params.push(query.status);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (query.page - 1) * query.limit;
  const [rows] = await databasePool.query<EnrollmentRow[]>(
    `${enrollmentSelect}
     ${whereSql}
     ORDER BY academic_year.start_date DESC,
       student.full_name ASC, enrollment.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, query.limit, offset],
  );
  const [countRows] = await databasePool.query<CountRow[]>(
    `
      SELECT COUNT(*) AS total
      FROM student_enrollments enrollment
      JOIN users student ON student.id = enrollment.student_user_id
      LEFT JOIN student_profiles profile ON profile.user_id = student.id
      JOIN classrooms classroom ON classroom.id = enrollment.classroom_id
      JOIN academic_years academic_year
        ON academic_year.id = enrollment.academic_year_id
      ${whereSql}
    `,
    params,
  );
  return {
    data: rows.map(mapEnrollment),
    total: Number(countRows[0]?.total ?? 0),
  };
}

export async function findEnrollmentById(id: number) {
  const [rows] = await databasePool.query<EnrollmentRow[]>(
    `${enrollmentSelect} WHERE enrollment.id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? mapEnrollment(rows[0]) : null;
}

export async function findStudentEnrollmentHistory(studentUserId: number) {
  const [rows] = await databasePool.query<EnrollmentRow[]>(
    `${enrollmentSelect}
     WHERE enrollment.student_user_id = ?
     ORDER BY academic_year.start_date DESC, enrollment.created_at DESC`,
    [studentUserId],
  );
  return rows.map(mapEnrollment);
}

export async function findActiveEnrollment(
  studentUserId: number,
  academicYearId: number,
  connection?: DatabaseConnection,
) {
  const executor = connection ?? databasePool;
  const [rows] = await executor.query<Array<{ id: number; classroom_id: number }>>(
    `
      SELECT id, classroom_id
      FROM student_enrollments
      WHERE student_user_id = ?
        AND academic_year_id = ?
        AND status = 'active'
      LIMIT 1
    `,
    [studentUserId, academicYearId],
  );
  return rows[0]
    ? { id: Number(rows[0].id), classroom_id: Number(rows[0].classroom_id) }
    : null;
}

export async function studentUserIsEligible(studentUserId: number) {
  const [rows] = await databasePool.query<Array<{ eligible: boolean }>>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM users user_account
        JOIN user_roles user_role ON user_role.user_id = user_account.id
        JOIN roles role ON role.id = user_role.role_id
        WHERE user_account.id = ?
          AND user_account.status = 'active'
          AND role.name = 'student'
      ) AS eligible
    `,
    [studentUserId],
  );
  return Boolean(rows[0]?.eligible);
}

export async function createEnrollmentRecord(
  input: CreateEnrollmentInput & {
    academic_year_id: number;
    created_by_user_id: number;
  },
) {
  const [result] = await databasePool.query<DatabaseResult>(
    `
      INSERT INTO student_enrollments (
        student_user_id, classroom_id, academic_year_id, status,
        enrolled_at, note, created_by_user_id
      )
      VALUES (?, ?, ?, 'active', ?, ?, ?)
      RETURNING id
    `,
    [
      input.student_user_id,
      input.classroom_id,
      input.academic_year_id,
      input.enrolled_at,
      input.note ?? null,
      input.created_by_user_id,
    ],
  );
  return findEnrollmentById(result.insertId);
}

export async function transferEnrollmentRecord(
  enrollmentId: number,
  input: TransferEnrollmentInput & {
    academic_year_id: number;
    student_user_id: number;
    created_by_user_id: number;
  },
) {
  const connection = await databasePool.getConnection();
  let newEnrollmentId = 0;
  try {
    await connection.beginTransaction();
    const [lockedRows] = await connection.query<Array<{ id: number }>>(
      `
        SELECT id
        FROM student_enrollments
        WHERE id = ? AND status = 'active'
        FOR UPDATE
      `,
      [enrollmentId],
    );
    if (!lockedRows[0]) {
      await connection.rollback();
      return null;
    }

    await connection.query(
      `
        UPDATE student_enrollments
        SET status = 'transferred', ended_at = ?,
          note = COALESCE(?, note)
        WHERE id = ?
      `,
      [input.effective_date, input.note ?? null, enrollmentId],
    );
    const [result] = await connection.query<DatabaseResult>(
      `
        INSERT INTO student_enrollments (
          student_user_id, classroom_id, academic_year_id, status,
          enrolled_at, previous_enrollment_id, note, created_by_user_id
        )
        VALUES (?, ?, ?, 'active', ?, ?, ?, ?)
        RETURNING id
      `,
      [
        input.student_user_id,
        input.target_classroom_id,
        input.academic_year_id,
        input.effective_date,
        enrollmentId,
        input.note ?? null,
        input.created_by_user_id,
      ],
    );
    newEnrollmentId = result.insertId;
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findEnrollmentById(newEnrollmentId);
}

export async function endEnrollmentRecord(
  enrollmentId: number,
  input: EndEnrollmentInput,
) {
  const [result] = await databasePool.query<DatabaseResult>(
    `
      UPDATE student_enrollments
      SET status = ?, ended_at = ?, note = COALESCE(?, note)
      WHERE id = ? AND status = 'active'
    `,
    [
      input.status,
      input.effective_date,
      input.note ?? null,
      enrollmentId,
    ],
  );
  return result.affectedRows > 0 ? findEnrollmentById(enrollmentId) : null;
}
