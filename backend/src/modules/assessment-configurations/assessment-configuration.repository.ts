import type {
  DatabaseConnection,
  DatabaseResult,
  DatabaseRow,
} from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  AssessmentCategory,
  AssessmentCategoryInput,
  AssessmentConfiguration,
  AssessmentConfigurationInput,
  AssessmentConfigurationUpdateInput,
  ListAssessmentConfigurationsQuery,
} from './assessment-configuration.types.js';

type ConfigurationRow = DatabaseRow &
  Omit<AssessmentConfiguration, 'categories'>;
type CategoryRow = DatabaseRow & AssessmentCategory;

function mapCategory(row: CategoryRow): AssessmentCategory {
  return {
    id: Number(row.id),
    configuration_id: Number(row.configuration_id),
    code: row.code,
    name: row.name,
    weight_percent: Number(row.weight_percent),
    coefficient: Number(row.coefficient),
    max_entries: Number(row.max_entries),
    score_scale: Number(row.score_scale),
    sort_order: Number(row.sort_order),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapConfiguration(
  row: ConfigurationRow,
  categories: AssessmentCategory[],
): AssessmentConfiguration {
  return {
    id: Number(row.id),
    subject_id: Number(row.subject_id),
    subject_code: row.subject_code,
    subject_name: row.subject_name,
    semester_id: Number(row.semester_id),
    semester_name: row.semester_name,
    semester_code: row.semester_code,
    academic_year_id: Number(row.academic_year_id),
    academic_year_name: row.academic_year_name,
    grade_level: Number(row.grade_level),
    version: Number(row.version),
    title: row.title,
    score_scale: Number(row.score_scale),
    decimal_places: Number(row.decimal_places),
    rounding_mode: row.rounding_mode,
    status: row.status,
    created_by_user_id:
      row.created_by_user_id === null
        ? null
        : Number(row.created_by_user_id),
    activated_at: row.activated_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    categories,
  };
}

const configurationSelect = `
  SELECT
    configuration.*,
    subject.code AS subject_code,
    subject.name AS subject_name,
    semester.name AS semester_name,
    semester.code AS semester_code,
    academic_year.id AS academic_year_id,
    academic_year.name AS academic_year_name
  FROM assessment_configurations configuration
  JOIN subjects subject ON subject.id = configuration.subject_id
  JOIN semesters semester ON semester.id = configuration.semester_id
  JOIN academic_years academic_year
    ON academic_year.id = semester.academic_year_id
`;

async function loadCategories(configurationIds: number[]) {
  if (configurationIds.length === 0) {
    return new Map<number, AssessmentCategory[]>();
  }
  const [rows] = await databasePool.query<CategoryRow[]>(
    `SELECT *
     FROM assessment_categories
     WHERE configuration_id = ANY(?::bigint[])
     ORDER BY configuration_id, sort_order, id`,
    [configurationIds],
  );
  const categories = new Map<number, AssessmentCategory[]>();
  for (const row of rows) {
    const category = mapCategory(row);
    const current = categories.get(category.configuration_id) ?? [];
    current.push(category);
    categories.set(category.configuration_id, current);
  }
  return categories;
}

export async function findAssessmentConfigurations(
  query: ListAssessmentConfigurationsQuery,
  teacherUserId?: number,
) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (query.q) {
    conditions.push(`(
      unaccent(configuration.title) ILIKE unaccent(?)
      OR unaccent(subject.name) ILIKE unaccent(?)
    )`);
    params.push(`%${query.q}%`, `%${query.q}%`);
  }
  if (query.subject_id) {
    conditions.push('configuration.subject_id = ?');
    params.push(query.subject_id);
  }
  if (query.semester_id) {
    conditions.push('configuration.semester_id = ?');
    params.push(query.semester_id);
  }
  if (query.grade_level) {
    conditions.push('configuration.grade_level = ?');
    params.push(query.grade_level);
  }
  if (query.status) {
    conditions.push('configuration.status = ?');
    params.push(query.status);
  }
  if (teacherUserId) {
    conditions.push(`
      configuration.status = 'active'
      AND EXISTS (
        SELECT 1
        FROM teaching_assignments assignment
        JOIN classrooms classroom ON classroom.id = assignment.classroom_id
        WHERE assignment.teacher_user_id = ?
          AND assignment.subject_id = configuration.subject_id
          AND assignment.semester_id = configuration.semester_id
          AND assignment.status = 'active'
          AND classroom.grade_level = configuration.grade_level
      )
    `);
    params.push(teacherUserId);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (query.page - 1) * query.limit;
  const [countRows] = await databasePool.query<Array<{ total: number }>>(
    `SELECT COUNT(*)::int AS total
     FROM assessment_configurations configuration
     JOIN subjects subject ON subject.id = configuration.subject_id
     ${where}`,
    params,
  );
  const [rows] = await databasePool.query<ConfigurationRow[]>(
    `${configurationSelect}
     ${where}
     ORDER BY academic_year.start_date DESC, semester.start_date DESC,
       configuration.grade_level, subject.name, configuration.version DESC
     LIMIT ? OFFSET ?`,
    [...params, query.limit, offset],
  );
  const categories = await loadCategories(rows.map((row) => Number(row.id)));
  return {
    data: rows.map((row) =>
      mapConfiguration(row, categories.get(Number(row.id)) ?? []),
    ),
    total: Number(countRows[0]?.total ?? 0),
  };
}

export async function findAssessmentConfigurationById(id: number) {
  const [rows] = await databasePool.query<ConfigurationRow[]>(
    `${configurationSelect} WHERE configuration.id = ? LIMIT 1`,
    [id],
  );
  if (!rows[0]) return null;
  const categories = await loadCategories([id]);
  return mapConfiguration(rows[0], categories.get(id) ?? []);
}

export async function teacherCanViewAssessmentConfiguration(
  teacherUserId: number,
  configurationId: number,
) {
  const [rows] = await databasePool.query<Array<{ allowed: boolean }>>(
    `SELECT EXISTS (
       SELECT 1
       FROM assessment_configurations configuration
       JOIN teaching_assignments assignment
         ON assignment.subject_id = configuration.subject_id
        AND assignment.semester_id = configuration.semester_id
        AND assignment.teacher_user_id = ?
        AND assignment.status = 'active'
       JOIN classrooms classroom
         ON classroom.id = assignment.classroom_id
        AND classroom.grade_level = configuration.grade_level
       WHERE configuration.id = ?
         AND configuration.status = 'active'
     ) AS allowed`,
    [teacherUserId, configurationId],
  );
  return Boolean(rows[0]?.allowed);
}

async function insertCategories(
  connection: DatabaseConnection,
  configurationId: number,
  categories: AssessmentCategoryInput[],
) {
  for (const category of categories) {
    await connection.query(
      `INSERT INTO assessment_categories (
         configuration_id, code, name, weight_percent, coefficient,
         max_entries, score_scale, sort_order
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        configurationId,
        category.code,
        category.name,
        category.weight_percent,
        category.coefficient,
        category.max_entries,
        category.score_scale,
        category.sort_order,
      ],
    );
  }
}

export async function insertAssessmentConfiguration(
  input: AssessmentConfigurationInput,
  createdByUserId: number,
) {
  const connection = await databasePool.getConnection();
  let configurationId = 0;
  try {
    await connection.beginTransaction();
    const [result] = await connection.query<DatabaseResult>(
      `INSERT INTO assessment_configurations (
         subject_id, semester_id, grade_level, version, title, score_scale,
         decimal_places, rounding_mode, created_by_user_id
       )
       VALUES (
         ?, ?, ?, 1, ?, ?, ?, ?::assessment_rounding_mode, ?
       )
       RETURNING id`,
      [
        input.subject_id,
        input.semester_id,
        input.grade_level,
        input.title,
        input.score_scale,
        input.decimal_places,
        input.rounding_mode,
        createdByUserId,
      ],
    );
    configurationId = result.insertId;
    await insertCategories(connection, configurationId, input.categories);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findAssessmentConfigurationById(configurationId);
}

export async function updateAssessmentConfigurationRecord(
  id: number,
  input: Required<
    Pick<
      AssessmentConfigurationUpdateInput,
      'title' | 'score_scale' | 'decimal_places' | 'rounding_mode'
    >
  > & { categories?: AssessmentCategoryInput[] },
) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE assessment_configurations
       SET title = ?, score_scale = ?, decimal_places = ?,
         rounding_mode = ?::assessment_rounding_mode
       WHERE id = ?`,
      [
        input.title,
        input.score_scale,
        input.decimal_places,
        input.rounding_mode,
        id,
      ],
    );
    if (input.categories) {
      await connection.query(
        'DELETE FROM assessment_categories WHERE configuration_id = ?',
        [id],
      );
      await insertCategories(connection, id, input.categories);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findAssessmentConfigurationById(id);
}

export async function insertAssessmentConfigurationVersion(
  source: AssessmentConfiguration,
  createdByUserId: number,
) {
  const connection = await databasePool.getConnection();
  let configurationId = 0;
  try {
    await connection.beginTransaction();
    const [versionRows] = await connection.query<Array<{ version: number }>>(
      `SELECT COALESCE(MAX(version), 0)::int + 1 AS version
       FROM assessment_configurations
       WHERE subject_id = ? AND semester_id = ? AND grade_level = ?`,
      [source.subject_id, source.semester_id, source.grade_level],
    );
    const [result] = await connection.query<DatabaseResult>(
      `INSERT INTO assessment_configurations (
         subject_id, semester_id, grade_level, version, title, score_scale,
         decimal_places, rounding_mode, created_by_user_id
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?::assessment_rounding_mode, ?)
       RETURNING id`,
      [
        source.subject_id,
        source.semester_id,
        source.grade_level,
        versionRows[0]?.version ?? source.version + 1,
        source.title,
        source.score_scale,
        source.decimal_places,
        source.rounding_mode,
        createdByUserId,
      ],
    );
    configurationId = result.insertId;
    await insertCategories(
      connection,
      configurationId,
      source.categories.map((category) => ({
        code: category.code,
        name: category.name,
        weight_percent: category.weight_percent,
        coefficient: category.coefficient,
        max_entries: category.max_entries,
        score_scale: category.score_scale,
        sort_order: category.sort_order,
      })),
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findAssessmentConfigurationById(configurationId);
}

export async function activateAssessmentConfigurationRecord(
  configuration: AssessmentConfiguration,
) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE assessment_configurations
       SET status = 'archived'
       WHERE subject_id = ?
         AND semester_id = ?
         AND grade_level = ?
         AND status = 'active'
         AND id <> ?`,
      [
        configuration.subject_id,
        configuration.semester_id,
        configuration.grade_level,
        configuration.id,
      ],
    );
    await connection.query(
      `UPDATE assessment_configurations
       SET status = 'active', activated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'draft'`,
      [configuration.id],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findAssessmentConfigurationById(configuration.id);
}

export async function deleteAssessmentConfigurationRecord(id: number) {
  const [result] = await databasePool.query<DatabaseResult>(
    `DELETE FROM assessment_configurations
     WHERE id = ? AND status = 'draft'`,
    [id],
  );
  return result.affectedRows > 0;
}
