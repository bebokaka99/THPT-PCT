import type {
  DatabaseConnection,
  DatabaseResult,
  DatabaseRow,
} from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  AcademicPeriodStatus,
  AcademicYear,
  AcademicYearInput,
  ListAcademicPeriodsQuery,
  Semester,
  SemesterInput,
} from './academic-period.types.js';

type AcademicYearRow = DatabaseRow & Omit<AcademicYear, 'semesters'>;
type SemesterRow = DatabaseRow & Semester;

function mapDate(value: unknown) {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function mapSemester(row: SemesterRow): Semester {
  return {
    id: Number(row.id),
    academic_year_id: Number(row.academic_year_id),
    name: row.name,
    code: row.code,
    start_date: mapDate(row.start_date),
    end_date: mapDate(row.end_date),
    status: row.status,
    is_locked: Boolean(row.is_locked),
    usage_count: Number(row.usage_count ?? 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapYear(row: AcademicYearRow, semesters: Semester[]): AcademicYear {
  return {
    id: Number(row.id),
    name: row.name,
    start_date: mapDate(row.start_date),
    end_date: mapDate(row.end_date),
    status: row.status,
    is_locked: Boolean(row.is_locked),
    usage_count: Number(row.usage_count ?? 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
    semesters,
  };
}

const yearSelect = `
  SELECT ay.*,
    (
      (SELECT COUNT(*) FROM classrooms c WHERE c.academic_year_id = ay.id)
      + (SELECT COUNT(*) FROM timetables t WHERE t.academic_year_id = ay.id)
      + (
        SELECT COUNT(*)
        FROM teaching_assignments assignment
        JOIN semesters semester ON semester.id = assignment.semester_id
        WHERE semester.academic_year_id = ay.id
      )
      + (
        SELECT COUNT(*)
        FROM assessment_configurations configuration
        JOIN semesters semester ON semester.id = configuration.semester_id
        WHERE semester.academic_year_id = ay.id
      )
      + (
        SELECT COUNT(*)
        FROM attendance_sessions attendance
        JOIN semesters semester ON semester.id = attendance.semester_id
        WHERE semester.academic_year_id = ay.id
      )
    ) AS usage_count
  FROM academic_years ay
`;

const semesterSelect = `
  SELECT s.*,
    (
      (SELECT COUNT(*) FROM timetables t WHERE t.semester_id = s.id)
      + (
        SELECT COUNT(*)
        FROM teaching_assignments assignment
        WHERE assignment.semester_id = s.id
      )
      + (
        SELECT COUNT(*)
        FROM assessment_configurations configuration
        WHERE configuration.semester_id = s.id
      )
      + (
        SELECT COUNT(*)
        FROM attendance_sessions attendance
        WHERE attendance.semester_id = s.id
      )
    ) AS usage_count
  FROM semesters s
`;

async function loadSemesters(yearIds: number[]) {
  if (yearIds.length === 0) return new Map<number, Semester[]>();
  const [rows] = await databasePool.query<SemesterRow[]>(
    `${semesterSelect}
     WHERE s.academic_year_id = ANY(?::bigint[])
     ORDER BY s.start_date ASC, s.id ASC`,
    [yearIds],
  );
  const byYear = new Map<number, Semester[]>();
  for (const row of rows) {
    const semester = mapSemester(row);
    const current = byYear.get(semester.academic_year_id) ?? [];
    current.push(semester);
    byYear.set(semester.academic_year_id, current);
  }
  return byYear;
}

export async function findAcademicYears(query: ListAcademicPeriodsQuery = {}) {
  const params: string[] = [];
  const where = query.status ? 'WHERE ay.status = ?' : '';
  if (query.status) params.push(query.status);
  const [rows] = await databasePool.query<AcademicYearRow[]>(
    `${yearSelect} ${where} ORDER BY ay.start_date DESC, ay.id DESC`,
    params,
  );
  const semesters = await loadSemesters(rows.map((row) => Number(row.id)));
  return rows.map((row) =>
    mapYear(row, semesters.get(Number(row.id)) ?? []),
  );
}

export async function findAcademicYearById(id: number) {
  const [rows] = await databasePool.query<AcademicYearRow[]>(
    `${yearSelect} WHERE ay.id = ? LIMIT 1`,
    [id],
  );
  if (!rows[0]) return null;
  const semesters = await loadSemesters([id]);
  return mapYear(rows[0], semesters.get(id) ?? []);
}

export async function findAcademicYearByName(name: string) {
  const [rows] = await databasePool.query<AcademicYearRow[]>(
    `${yearSelect} WHERE ay.name = ? LIMIT 1`,
    [name],
  );
  if (!rows[0]) return null;
  const id = Number(rows[0].id);
  const semesters = await loadSemesters([id]);
  return mapYear(rows[0], semesters.get(id) ?? []);
}

export async function findActiveAcademicPeriods() {
  const [years] = await databasePool.query<AcademicYearRow[]>(
    `${yearSelect} WHERE ay.status = 'active' LIMIT 1`,
  );
  const [semesters] = await databasePool.query<SemesterRow[]>(
    `${semesterSelect} WHERE s.status = 'active' LIMIT 1`,
  );
  return {
    academic_year: years[0]
      ? mapYear(years[0], [])
      : null,
    semester: semesters[0] ? mapSemester(semesters[0]) : null,
  };
}

export async function findSemesterById(id: number) {
  const [rows] = await databasePool.query<SemesterRow[]>(
    `${semesterSelect} WHERE s.id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? mapSemester(rows[0]) : null;
}

export async function hasAcademicYearDateOverlap(
  startDate: string,
  endDate: string,
  excludeId?: number,
) {
  const [rows] = await databasePool.query<Array<{ exists: boolean }>>(
    `
      SELECT EXISTS (
        SELECT 1 FROM academic_years
        WHERE daterange(start_date, end_date, '[]')
          && daterange(?::date, ?::date, '[]')
          ${excludeId ? 'AND id <> ?' : ''}
      ) AS exists
    `,
    excludeId ? [startDate, endDate, excludeId] : [startDate, endDate],
  );
  return Boolean(rows[0]?.exists);
}

export async function hasSemesterDateOverlap(
  academicYearId: number,
  startDate: string,
  endDate: string,
  excludeId?: number,
) {
  const [rows] = await databasePool.query<Array<{ exists: boolean }>>(
    `
      SELECT EXISTS (
        SELECT 1 FROM semesters
        WHERE academic_year_id = ?
          AND daterange(start_date, end_date, '[]')
            && daterange(?::date, ?::date, '[]')
          ${excludeId ? 'AND id <> ?' : ''}
      ) AS exists
    `,
    excludeId
      ? [academicYearId, startDate, endDate, excludeId]
      : [academicYearId, startDate, endDate],
  );
  return Boolean(rows[0]?.exists);
}

export async function insertAcademicYear(input: AcademicYearInput) {
  const [result] = await databasePool.query<DatabaseResult>(
    `
      INSERT INTO academic_years (name, start_date, end_date)
      VALUES (?, ?::date, ?::date)
      RETURNING id
    `,
    [input.name, input.start_date, input.end_date],
  );
  return findAcademicYearById(result.insertId);
}

export async function updateAcademicYearRecord(
  id: number,
  input: AcademicYearInput,
) {
  await databasePool.query(
    `
      UPDATE academic_years
      SET name = ?, start_date = ?::date, end_date = ?::date
      WHERE id = ?
    `,
    [input.name, input.start_date, input.end_date, id],
  );
  return findAcademicYearById(id);
}

export async function insertSemester(
  academicYearId: number,
  input: SemesterInput,
) {
  const [result] = await databasePool.query<DatabaseResult>(
    `
      INSERT INTO semesters (
        academic_year_id, name, code, start_date, end_date
      )
      VALUES (?, ?, ?, ?::date, ?::date)
      RETURNING id
    `,
    [
      academicYearId,
      input.name,
      input.code,
      input.start_date,
      input.end_date,
    ],
  );
  return findSemesterById(result.insertId);
}

export async function updateSemesterRecord(id: number, input: SemesterInput) {
  await databasePool.query(
    `
      UPDATE semesters
      SET name = ?, code = ?, start_date = ?::date, end_date = ?::date
      WHERE id = ?
    `,
    [input.name, input.code, input.start_date, input.end_date, id],
  );
  return findSemesterById(id);
}

async function activateYearOnConnection(
  connection: DatabaseConnection,
  id: number,
) {
  await connection.query(
    `UPDATE semesters SET status = 'planned'
     WHERE status = 'active' AND academic_year_id <> ?`,
    [id],
  );
  await connection.query(
    `UPDATE academic_years SET status = 'planned'
     WHERE status = 'active' AND id <> ?`,
    [id],
  );
  await connection.query(
    `UPDATE academic_years
     SET status = 'active', is_locked = FALSE
     WHERE id = ?`,
    [id],
  );
}

export async function activateAcademicYearRecord(id: number) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    await activateYearOnConnection(connection, id);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findAcademicYearById(id);
}

export async function activateSemesterRecord(id: number, academicYearId: number) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE semesters SET status = 'planned' WHERE status = 'active' AND id <> ?`,
      [id],
    );
    await activateYearOnConnection(connection, academicYearId);
    await connection.query(
      `UPDATE semesters
       SET status = 'active', is_locked = FALSE
       WHERE id = ?`,
      [id],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findSemesterById(id);
}

export async function closeAcademicYearRecord(id: number) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE semesters
       SET status = 'closed', is_locked = TRUE
       WHERE academic_year_id = ?`,
      [id],
    );
    await connection.query(
      `UPDATE academic_years
       SET status = 'closed', is_locked = TRUE
       WHERE id = ?`,
      [id],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findAcademicYearById(id);
}

export async function closeSemesterRecord(id: number) {
  await databasePool.query(
    `UPDATE semesters
     SET status = 'closed', is_locked = TRUE
     WHERE id = ?`,
    [id],
  );
  return findSemesterById(id);
}

export async function setAcademicYearLockRecord(id: number, isLocked: boolean) {
  await databasePool.query(
    'UPDATE academic_years SET is_locked = ? WHERE id = ?',
    [isLocked, id],
  );
  return findAcademicYearById(id);
}

export async function setSemesterLockRecord(id: number, isLocked: boolean) {
  await databasePool.query(
    'UPDATE semesters SET is_locked = ? WHERE id = ?',
    [isLocked, id],
  );
  return findSemesterById(id);
}

export async function deleteAcademicYearRecord(id: number) {
  const [result] = await databasePool.query<DatabaseResult>(
    'DELETE FROM academic_years WHERE id = ?',
    [id],
  );
  return result.affectedRows > 0;
}

export async function deleteSemesterRecord(id: number) {
  const [result] = await databasePool.query<DatabaseResult>(
    'DELETE FROM semesters WHERE id = ?',
    [id],
  );
  return result.affectedRows > 0;
}

export async function updateAcademicPeriodStatus(
  table: 'academic_years' | 'semesters',
  id: number,
  status: AcademicPeriodStatus,
) {
  await databasePool.query(
    `UPDATE ${table} SET status = ? WHERE id = ?`,
    [status, id],
  );
}
