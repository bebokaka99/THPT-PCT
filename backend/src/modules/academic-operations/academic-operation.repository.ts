import type {
  DatabaseConnection,
  DatabaseResult,
  DatabaseRow,
} from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  AcademicImportJob,
  AcademicImportStatus,
  AcademicImportType,
  CsvRow,
  ImportJobListQuery,
  ImportValidationError,
  ReportFilters,
} from './academic-operation.types.js';

type JobRow = DatabaseRow & AcademicImportJob;
type CountRow = DatabaseRow & { total: number };

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function dateText(value: unknown) {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}

function mapJob(row: JobRow): AcademicImportJob {
  return {
    ...row,
    id: Number(row.id),
    total_rows: Number(row.total_rows),
    valid_rows: Number(row.valid_rows),
    invalid_rows: Number(row.invalid_rows),
    created_by_user_id: Number(row.created_by_user_id),
    preview_rows: Array.isArray(row.preview_rows) ? row.preview_rows : [],
    validation_errors: Array.isArray(row.validation_errors)
      ? row.validation_errors
      : [],
    result_summary:
      row.result_summary && typeof row.result_summary === 'object'
        ? row.result_summary
        : {},
    committed_at: row.committed_at ? iso(row.committed_at) : null,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

export async function findImportJobById(id: number) {
  const [rows] = await databasePool.query<JobRow[]>(
    'SELECT * FROM academic_import_jobs WHERE id = ? LIMIT 1',
    [id],
  );
  return rows[0] ? mapJob(rows[0]) : null;
}

export async function findImportJobByKey(userId: number, key: string) {
  const [rows] = await databasePool.query<JobRow[]>(
    `SELECT * FROM academic_import_jobs
     WHERE created_by_user_id = ? AND idempotency_key = ? LIMIT 1`,
    [userId, key],
  );
  return rows[0] ? mapJob(rows[0]) : null;
}

export async function listImportJobs(
  userId: number,
  query: ImportJobListQuery,
) {
  const where = ['created_by_user_id = ?'];
  const params: Array<string | number> = [userId];
  if (query.type) {
    where.push('import_type = ?');
    params.push(query.type);
  }
  if (query.status) {
    where.push('status = ?');
    params.push(query.status);
  }
  const offset = (query.page - 1) * query.limit;
  const [rows] = await databasePool.query<JobRow[]>(
    `SELECT id, import_type, status, idempotency_key, template_version,
       original_file_name, file_sha256, total_rows, valid_rows, invalid_rows,
       '[]'::jsonb AS preview_rows, '[]'::jsonb AS validation_errors,
       result_summary, error_message, created_by_user_id, committed_at,
       created_at, updated_at
     FROM academic_import_jobs
     WHERE ${where.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, query.limit, offset],
  );
  const [countRows] = await databasePool.query<CountRow[]>(
    `SELECT COUNT(*) AS total FROM academic_import_jobs
     WHERE ${where.join(' AND ')}`,
    params,
  );
  return {
    data: rows.map(mapJob),
    total: Number(countRows[0]?.total ?? 0),
  };
}

export async function createImportJob(
  input: {
    type: AcademicImportType;
    idempotencyKey: string;
    originalFileName: string;
    fileSha256: string;
    rows: CsvRow[];
    errors: ImportValidationError[];
  },
  userId: number,
) {
  const invalidRows = new Set(input.errors.map((error) => error.row)).size;
  const [result] = await databasePool.query<DatabaseResult>(
    `INSERT INTO academic_import_jobs (
      import_type, idempotency_key, original_file_name, file_sha256,
      total_rows, valid_rows, invalid_rows, preview_rows,
      validation_errors, created_by_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?) RETURNING id`,
    [
      input.type,
      input.idempotencyKey,
      input.originalFileName,
      input.fileSha256,
      input.rows.length + invalidRows,
      input.rows.length,
      invalidRows,
      JSON.stringify(input.rows),
      JSON.stringify(input.errors),
      userId,
    ],
  );
  await databasePool.query(
    `INSERT INTO academic_import_audits (
      import_job_id, actor_user_id, action, summary
    ) VALUES (?, ?, 'preview', ?::jsonb)`,
    [
      result.insertId,
      userId,
      JSON.stringify({
        valid_rows: input.rows.length,
        invalid_rows: invalidRows,
      }),
    ],
  );
  return findImportJobById(result.insertId);
}

export async function addImportAudit(
  jobId: number,
  userId: number,
  action: 'commit_started' | 'commit_completed' | 'commit_failed',
  summary: Record<string, unknown>,
) {
  await databasePool.query(
    `INSERT INTO academic_import_audits (
      import_job_id, actor_user_id, action, summary
    ) VALUES (?, ?, ?, ?::jsonb)`,
    [jobId, userId, action, JSON.stringify(summary)],
  );
}

export async function setImportJobStatus(
  jobId: number,
  status: AcademicImportStatus,
  result: Record<string, unknown> = {},
  errorMessage: string | null = null,
) {
  await databasePool.query(
    `UPDATE academic_import_jobs
     SET status = ?, result_summary = ?::jsonb, error_message = ?,
       committed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE committed_at END
     WHERE id = ?`,
    [status, JSON.stringify(result), errorMessage, status, jobId],
  );
  return findImportJobById(jobId);
}

export async function findStudentScopes(codes: string[]) {
  if (codes.length === 0) return [];
  const [rows] = await databasePool.query<
    Array<
      DatabaseRow & {
        student_code: string;
        user_id: number;
        user_status: string;
        is_student: boolean;
      }
    >
  >(
    `SELECT profile.student_code, profile.user_id, student.status AS user_status,
       EXISTS (
         SELECT 1 FROM user_roles mapping
         JOIN roles role_record ON role_record.id = mapping.role_id
         WHERE mapping.user_id = profile.user_id AND role_record.name = 'student'
       ) AS is_student
     FROM student_profiles profile
     JOIN users student ON student.id = profile.user_id
     WHERE profile.student_code = ANY(?)`,
    [codes],
  );
  return rows.map((row) => ({
    ...row,
    user_id: Number(row.user_id),
    is_student: Boolean(row.is_student),
  }));
}

export async function findClassroomImportScopes(ids: number[]) {
  if (ids.length === 0) return [];
  const [rows] = await databasePool.query<
    Array<
      DatabaseRow & {
        id: number;
        academic_year_id: number;
        is_active: boolean;
        year_start_date: string;
        year_end_date: string;
        year_status: string;
        year_is_locked: boolean;
      }
    >
  >(
    `SELECT classroom.id, classroom.academic_year_id, classroom.is_active,
       academic_year.start_date AS year_start_date,
       academic_year.end_date AS year_end_date,
       academic_year.status AS year_status,
       academic_year.is_locked AS year_is_locked
     FROM classrooms classroom
     JOIN academic_years academic_year
       ON academic_year.id = classroom.academic_year_id
     WHERE classroom.id = ANY(?)`,
    [ids],
  );
  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    academic_year_id: Number(row.academic_year_id),
    is_active: Boolean(row.is_active),
    year_is_locked: Boolean(row.year_is_locked),
    year_start_date: dateText(row.year_start_date),
    year_end_date: dateText(row.year_end_date),
  }));
}

export async function findExistingEnrollmentScopes(
  studentUserIds: number[],
  academicYearIds: number[],
) {
  if (studentUserIds.length === 0 || academicYearIds.length === 0) return [];
  const [rows] = await databasePool.query<
    Array<DatabaseRow & { student_user_id: number; academic_year_id: number }>
  >(
    `SELECT student_user_id, academic_year_id
     FROM student_enrollments
     WHERE student_user_id = ANY(?)
       AND academic_year_id = ANY(?)
       AND status = 'active'`,
    [studentUserIds, academicYearIds],
  );
  return rows.map((row) => ({
    student_user_id: Number(row.student_user_id),
    academic_year_id: Number(row.academic_year_id),
  }));
}

export async function findTeachingAssignmentImportScopes(ids: number[]) {
  if (ids.length === 0) return [];
  const [rows] = await databasePool.query<
    Array<
      DatabaseRow & {
        id: number;
        classroom_id: number;
        subject_id: number;
        semester_id: number;
        status: string;
        semester_start_date: string;
        semester_end_date: string;
        semester_status: string;
        semester_is_locked: boolean;
        year_is_locked: boolean;
      }
    >
  >(
    `SELECT assignment.id, assignment.classroom_id, assignment.subject_id,
       assignment.semester_id, assignment.status,
       semester.start_date AS semester_start_date,
       semester.end_date AS semester_end_date,
       semester.status AS semester_status,
       semester.is_locked AS semester_is_locked,
       academic_year.is_locked AS year_is_locked
     FROM teaching_assignments assignment
     JOIN semesters semester ON semester.id = assignment.semester_id
     JOIN academic_years academic_year ON academic_year.id = semester.academic_year_id
     WHERE assignment.id = ANY(?)`,
    [ids],
  );
  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    classroom_id: Number(row.classroom_id),
    subject_id: Number(row.subject_id),
    semester_id: Number(row.semester_id),
    semester_is_locked: Boolean(row.semester_is_locked),
    year_is_locked: Boolean(row.year_is_locked),
    semester_start_date: dateText(row.semester_start_date),
    semester_end_date: dateText(row.semester_end_date),
  }));
}

async function lockJob(
  connection: DatabaseConnection,
  jobId: number,
  userId: number,
) {
  const [rows] = await connection.query<JobRow[]>(
    `SELECT * FROM academic_import_jobs
     WHERE id = ? AND created_by_user_id = ?
     FOR UPDATE`,
    [jobId, userId],
  );
  return rows[0] ? mapJob(rows[0]) : null;
}

async function completeJob(
  connection: DatabaseConnection,
  jobId: number,
  userId: number,
  count: number,
) {
  const summary = { committed_rows: count };
  await connection.query(
    `UPDATE academic_import_jobs
     SET status = 'completed', result_summary = ?::jsonb,
       error_message = NULL, committed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [JSON.stringify(summary), jobId],
  );
  await connection.query(
    `INSERT INTO academic_import_audits (
      import_job_id, actor_user_id, action, summary
    ) VALUES (?, ?, 'commit_completed', ?::jsonb)`,
    [jobId, userId, JSON.stringify(summary)],
  );
}

export async function commitEnrollmentRows(
  jobId: number,
  userId: number,
  rows: Array<{
    student_user_id: number;
    classroom_id: number;
    academic_year_id: number;
    enrolled_at: string;
    note: string | null;
  }>,
) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const job = await lockJob(connection, jobId, userId);
    if (!job) throw new Error('IMPORT_JOB_NOT_FOUND');
    if (job.status === 'completed') {
      await connection.commit();
      return job;
    }
    if (job.status !== 'preview_ready') throw new Error('IMPORT_JOB_STATE');
    await connection.query(
      "UPDATE academic_import_jobs SET status = 'committing' WHERE id = ?",
      [jobId],
    );
    await connection.query(
      `INSERT INTO academic_import_audits (
        import_job_id, actor_user_id, action, summary
      ) VALUES (?, ?, 'commit_started', ?::jsonb)`,
      [jobId, userId, JSON.stringify({ rows: rows.length })],
    );
    for (const row of rows) {
      await connection.query(
        `INSERT INTO student_enrollments (
          student_user_id, classroom_id, academic_year_id, status,
          enrolled_at, note, created_by_user_id
        ) VALUES (?, ?, ?, 'active', ?, ?, ?)`,
        [
          row.student_user_id,
          row.classroom_id,
          row.academic_year_id,
          row.enrolled_at,
          row.note,
          userId,
        ],
      );
    }
    await completeJob(connection, jobId, userId, rows.length);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findImportJobById(jobId);
}

export async function commitAssignmentRows(
  jobId: number,
  userId: number,
  rows: Array<{
    teaching_assignment_id: number;
    classroom_id: number;
    subject_id: number;
    semester_id: number;
    title: string;
    description: string | null;
    due_at: string;
    allow_late: boolean;
  }>,
) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const job = await lockJob(connection, jobId, userId);
    if (!job) throw new Error('IMPORT_JOB_NOT_FOUND');
    if (job.status === 'completed') {
      await connection.commit();
      return job;
    }
    if (job.status !== 'preview_ready') throw new Error('IMPORT_JOB_STATE');
    await connection.query(
      "UPDATE academic_import_jobs SET status = 'committing' WHERE id = ?",
      [jobId],
    );
    await connection.query(
      `INSERT INTO academic_import_audits (
        import_job_id, actor_user_id, action, summary
      ) VALUES (?, ?, 'commit_started', ?::jsonb)`,
      [jobId, userId, JSON.stringify({ rows: rows.length })],
    );
    for (const row of rows) {
      await connection.query(
        `INSERT INTO assignments (
          classroom_id, subject_id, semester_id, teaching_assignment_id,
          title, description, due_at, allow_late, status, created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
        [
          row.classroom_id,
          row.subject_id,
          row.semester_id,
          row.teaching_assignment_id,
          row.title,
          row.description,
          row.due_at,
          row.allow_late,
          userId,
        ],
      );
    }
    await completeJob(connection, jobId, userId, rows.length);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findImportJobById(jobId);
}

export async function exportClassroomRoster(classroomId: number) {
  const [rows] = await databasePool.query<DatabaseRow[]>(
    `SELECT profile.student_code, student.full_name, student.email,
       classroom.name AS classroom_name, academic_year.name AS academic_year,
       enrollment.status, enrollment.enrolled_at, enrollment.ended_at
     FROM student_enrollments enrollment
     JOIN users student ON student.id = enrollment.student_user_id
     LEFT JOIN student_profiles profile ON profile.user_id = student.id
     JOIN classrooms classroom ON classroom.id = enrollment.classroom_id
     JOIN academic_years academic_year ON academic_year.id = enrollment.academic_year_id
     WHERE enrollment.classroom_id = ?
     ORDER BY student.full_name`,
    [classroomId],
  );
  return rows;
}

export async function exportClassroomAttendance(
  classroomId: number,
  semesterId: number,
) {
  const [rows] = await databasePool.query<DatabaseRow[]>(
    `SELECT session.session_date, session.lesson_index,
       subject.name AS subject_name, profile.student_code,
       student.full_name, record.status, record.note
     FROM attendance_sessions session
     JOIN attendance_records record ON record.session_id = session.id
     JOIN users student ON student.id = record.student_user_id
     LEFT JOIN student_profiles profile ON profile.user_id = student.id
     LEFT JOIN subjects subject ON subject.id = session.subject_id
     WHERE session.classroom_id = ? AND session.semester_id = ?
     ORDER BY session.session_date, session.lesson_index, student.full_name`,
    [classroomId, semesterId],
  );
  return rows;
}

export async function getAcademicReportSummary(filters: ReportFilters) {
  const params: number[] = [];
  const classroomWhere: string[] = [];
  if (filters.academic_year_id) {
    classroomWhere.push('classroom.academic_year_id = ?');
    params.push(filters.academic_year_id);
  }
  if (filters.classroom_id) {
    classroomWhere.push('classroom.id = ?');
    params.push(filters.classroom_id);
  }
  const whereSql = classroomWhere.length
    ? `WHERE ${classroomWhere.join(' AND ')}`
    : '';
  const [rows] = await databasePool.query<
    Array<
      DatabaseRow & {
        classroom_count: number;
        active_student_count: number;
        attendance_session_count: number;
        gradebook_count: number;
      }
    >
  >(
    `SELECT
       COUNT(DISTINCT classroom.id)::INTEGER AS classroom_count,
       COUNT(DISTINCT enrollment.student_user_id)
         FILTER (WHERE enrollment.status = 'active')::INTEGER AS active_student_count,
       COUNT(DISTINCT attendance.id)::INTEGER AS attendance_session_count,
       COUNT(DISTINCT gradebook.id)::INTEGER AS gradebook_count
     FROM classrooms classroom
     LEFT JOIN student_enrollments enrollment
       ON enrollment.classroom_id = classroom.id
     LEFT JOIN attendance_sessions attendance
       ON attendance.classroom_id = classroom.id
       ${filters.semester_id ? 'AND attendance.semester_id = ?' : ''}
     LEFT JOIN gradebooks gradebook
       ON gradebook.classroom_id = classroom.id
       ${filters.semester_id ? 'AND gradebook.semester_id = ?' : ''}
       ${filters.subject_id ? 'AND gradebook.subject_id = ?' : ''}
     ${whereSql}`,
    [
      ...(filters.semester_id
        ? [filters.semester_id, filters.semester_id]
        : []),
      ...(filters.subject_id ? [filters.subject_id] : []),
      ...params,
    ],
  );
  const row = rows[0] ?? {};
  return {
    classroom_count: Number(row.classroom_count ?? 0),
    active_student_count: Number(row.active_student_count ?? 0),
    attendance_session_count: Number(row.attendance_session_count ?? 0),
    gradebook_count: Number(row.gradebook_count ?? 0),
  };
}
