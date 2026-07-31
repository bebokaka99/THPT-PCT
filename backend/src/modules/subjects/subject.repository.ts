import type {
  DatabaseResult,
  DatabaseRow,
} from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  CurriculumSubject,
  CurriculumSubjectInput,
  ListCurriculumQuery,
  ListSubjectsQuery,
  Subject,
  SubjectInput,
} from './subject.types.js';

type SubjectRow = DatabaseRow & Subject;
type CurriculumRow = DatabaseRow & CurriculumSubject;
type CountRow = DatabaseRow & { total: number };

const subjectSelect = `
  SELECT s.*,
    (
      (SELECT COUNT(*) FROM curriculum_subjects cs WHERE cs.subject_id = s.id)
      + (SELECT COUNT(*) FROM timetable_items ti WHERE ti.subject_id = s.id)
      + (SELECT COUNT(*) FROM teaching_assignments ta WHERE ta.subject_id = s.id)
      + (
        SELECT COUNT(*)
        FROM assessment_configurations configuration
        WHERE configuration.subject_id = s.id
      )
    ) AS usage_count
  FROM subjects s
`;

const curriculumSelect = `
  SELECT cs.*,
    ay.name AS academic_year_name,
    s.code AS subject_code,
    s.name AS subject_name,
    s.subject_group,
    s.is_active AS subject_is_active
  FROM curriculum_subjects cs
  JOIN academic_years ay ON ay.id = cs.academic_year_id
  JOIN subjects s ON s.id = cs.subject_id
`;

function mapSubject(row: SubjectRow): Subject {
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    subject_group: row.subject_group,
    description: row.description ?? null,
    is_active: Boolean(row.is_active),
    usage_count: Number(row.usage_count ?? 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapCurriculum(row: CurriculumRow): CurriculumSubject {
  return {
    id: Number(row.id),
    academic_year_id: Number(row.academic_year_id),
    academic_year_name: row.academic_year_name,
    subject_id: Number(row.subject_id),
    subject_code: row.subject_code,
    subject_name: row.subject_name,
    subject_group: row.subject_group,
    grade_level: Number(row.grade_level),
    periods_per_week: Number(row.periods_per_week),
    is_required: Boolean(row.is_required),
    is_active: Boolean(row.is_active),
    subject_is_active: Boolean(row.subject_is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function findSubjects(query: ListSubjectsQuery) {
  const where: string[] = [];
  const params: Array<string | number | boolean> = [];
  if (query.q) {
    where.push('(s.code ILIKE ? OR s.name ILIKE ?)');
    params.push(`%${query.q}%`, `%${query.q}%`);
  }
  if (query.subject_group) {
    where.push('s.subject_group = ?');
    params.push(query.subject_group);
  }
  if (query.is_active !== undefined) {
    where.push('s.is_active = ?');
    params.push(query.is_active);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (query.page - 1) * query.limit;
  const [rows] = await databasePool.query<SubjectRow[]>(
    `${subjectSelect} ${whereSql}
     ORDER BY s.is_active DESC, s.name ASC, s.id ASC
     LIMIT ? OFFSET ?`,
    [...params, query.limit, offset],
  );
  const [countRows] = await databasePool.query<CountRow[]>(
    `SELECT COUNT(*) AS total FROM subjects s ${whereSql}`,
    params,
  );
  return {
    data: rows.map(mapSubject),
    total: Number(countRows[0]?.total ?? 0),
  };
}

export async function findSubjectById(id: number) {
  const [rows] = await databasePool.query<SubjectRow[]>(
    `${subjectSelect} WHERE s.id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? mapSubject(rows[0]) : null;
}

export async function findSubjectByCode(code: string) {
  const [rows] = await databasePool.query<SubjectRow[]>(
    `${subjectSelect} WHERE s.code = ? LIMIT 1`,
    [code],
  );
  return rows[0] ? mapSubject(rows[0]) : null;
}

export async function insertSubject(input: SubjectInput) {
  const [result] = await databasePool.query<DatabaseResult>(
    `
      INSERT INTO subjects (
        code, name, subject_group, description, is_active
      ) VALUES (?, ?, ?, ?, ?)
      RETURNING id
    `,
    [
      input.code,
      input.name,
      input.subject_group,
      input.description ?? null,
      input.is_active ?? true,
    ],
  );
  return findSubjectById(result.insertId);
}

export async function updateSubjectRecord(
  id: number,
  input: Omit<SubjectInput, 'code'>,
) {
  await databasePool.query(
    `
      UPDATE subjects
      SET name = ?, subject_group = ?, description = ?, is_active = ?
      WHERE id = ?
    `,
    [
      input.name,
      input.subject_group,
      input.description ?? null,
      input.is_active ?? true,
      id,
    ],
  );
  return findSubjectById(id);
}

export async function importSubjectRecords(inputs: SubjectInput[]) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    for (const input of inputs) {
      await connection.query(
        `
          INSERT INTO subjects (
            code, name, subject_group, description, is_active
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            subject_group = EXCLUDED.subject_group,
            description = EXCLUDED.description,
            is_active = EXCLUDED.is_active
        `,
        [
          input.code,
          input.name,
          input.subject_group,
          input.description ?? null,
          input.is_active ?? true,
        ],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteSubjectRecord(id: number) {
  const [result] = await databasePool.query<DatabaseResult>(
    'DELETE FROM subjects WHERE id = ?',
    [id],
  );
  return result.affectedRows > 0;
}

export async function findCurriculumSubjects(query: ListCurriculumQuery) {
  const where: string[] = [];
  const params: Array<number | boolean> = [];
  if (query.academic_year_id) {
    where.push('cs.academic_year_id = ?');
    params.push(query.academic_year_id);
  }
  if (query.grade_level) {
    where.push('cs.grade_level = ?');
    params.push(query.grade_level);
  }
  if (query.is_active !== undefined) {
    where.push('cs.is_active = ?');
    params.push(query.is_active);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await databasePool.query<CurriculumRow[]>(
    `${curriculumSelect} ${whereSql}
     ORDER BY ay.start_date DESC, cs.grade_level ASC, s.name ASC`,
    params,
  );
  return rows.map(mapCurriculum);
}

export async function findCurriculumSubjectById(id: number) {
  const [rows] = await databasePool.query<CurriculumRow[]>(
    `${curriculumSelect} WHERE cs.id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? mapCurriculum(rows[0]) : null;
}

export async function findActiveCurriculumSubject(
  academicYearId: number,
  gradeLevel: number,
  subjectId: number,
) {
  const [rows] = await databasePool.query<CurriculumRow[]>(
    `${curriculumSelect}
     WHERE cs.academic_year_id = ?
       AND cs.grade_level = ?
       AND cs.subject_id = ?
       AND cs.is_active = TRUE
       AND s.is_active = TRUE
     LIMIT 1`,
    [academicYearId, gradeLevel, subjectId],
  );
  return rows[0] ? mapCurriculum(rows[0]) : null;
}

export async function insertCurriculumSubject(
  input: CurriculumSubjectInput,
) {
  const [result] = await databasePool.query<DatabaseResult>(
    `
      INSERT INTO curriculum_subjects (
        academic_year_id, subject_id, grade_level, periods_per_week,
        is_required, is_active
      ) VALUES (?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
    [
      input.academic_year_id,
      input.subject_id,
      input.grade_level,
      input.periods_per_week,
      input.is_required ?? true,
      input.is_active ?? true,
    ],
  );
  return findCurriculumSubjectById(result.insertId);
}

export async function updateCurriculumSubjectRecord(
  id: number,
  input: CurriculumSubjectInput,
) {
  await databasePool.query(
    `
      UPDATE curriculum_subjects
      SET subject_id = ?, periods_per_week = ?, is_required = ?, is_active = ?
      WHERE id = ?
    `,
    [
      input.subject_id,
      input.periods_per_week,
      input.is_required ?? true,
      input.is_active ?? true,
      id,
    ],
  );
  return findCurriculumSubjectById(id);
}

export async function deleteCurriculumSubjectRecord(id: number) {
  const [result] = await databasePool.query<DatabaseResult>(
    'DELETE FROM curriculum_subjects WHERE id = ?',
    [id],
  );
  return result.affectedRows > 0;
}

export async function subjectHasTimetableUsage(subjectId: number) {
  const [rows] = await databasePool.query<Array<{ exists: boolean }>>(
    `
      SELECT EXISTS (
        SELECT 1 FROM timetable_items WHERE subject_id = ?
      ) AS exists
    `,
    [subjectId],
  );
  return Boolean(rows[0]?.exists);
}

export async function curriculumExists(
  academicYearId: number,
  subjectId: number,
  gradeLevel: number,
  excludeId?: number,
) {
  const [rows] = await databasePool.query<Array<{ exists: boolean }>>(
    `
      SELECT EXISTS (
        SELECT 1 FROM curriculum_subjects
        WHERE academic_year_id = ?
          AND subject_id = ?
          AND grade_level = ?
          ${excludeId ? 'AND id <> ?' : ''}
      ) AS exists
    `,
    excludeId
      ? [academicYearId, subjectId, gradeLevel, excludeId]
      : [academicYearId, subjectId, gradeLevel],
  );
  return Boolean(rows[0]?.exists);
}
