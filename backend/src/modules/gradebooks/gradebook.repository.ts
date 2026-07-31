import type {
  DatabaseConnection,
  DatabaseResult,
  DatabaseRow,
} from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  GradebookColumn,
  GradebookDetail,
  GradebookListQuery,
  GradebookChangeRequest,
  GradebookStatus,
  GradebookWorkflowAction,
  GradebookWorkflowAudit,
  GradebookScoreBatchInput,
  GradebookStudent,
  GradebookSummary,
  StudentGradeTotal,
  StudentGradeFilterOptions,
  StudentGradeQuery,
  StudentScore,
  StudentScoreAudit,
  StudentPublishedGrade,
} from './gradebook.types.js';

type Row = DatabaseRow & Record<string, any>;

const summarySelect = `
  SELECT gradebook.*,
    classroom.name AS classroom_name,
    subject.code AS subject_code,
    subject.name AS subject_name,
    semester.name AS semester_name,
    academic_year.id AS academic_year_id,
    academic_year.name AS academic_year_name,
    assignment.teacher_user_id,
    teacher.full_name AS teacher_name,
    (
      SELECT COUNT(DISTINCT enrollment.student_user_id)::int
      FROM student_enrollments enrollment
      WHERE enrollment.classroom_id = gradebook.classroom_id
        AND enrollment.enrolled_at <= semester.end_date
        AND (enrollment.ended_at IS NULL OR enrollment.ended_at >= semester.start_date)
    ) AS student_count,
    (
      SELECT COUNT(DISTINCT score.student_user_id)::int
      FROM student_scores score
      WHERE score.gradebook_id = gradebook.id
    ) AS scored_student_count
  FROM gradebooks gradebook
  JOIN teaching_assignments assignment
    ON assignment.id = gradebook.teaching_assignment_id
  JOIN users teacher ON teacher.id = assignment.teacher_user_id
  JOIN classrooms classroom ON classroom.id = gradebook.classroom_id
  JOIN subjects subject ON subject.id = gradebook.subject_id
  JOIN semesters semester ON semester.id = gradebook.semester_id
  JOIN academic_years academic_year
    ON academic_year.id = semester.academic_year_id
`;

function mapSummary(row: Row): GradebookSummary {
  return {
    id: Number(row.id),
    teaching_assignment_id: Number(row.teaching_assignment_id),
    assessment_configuration_id: Number(row.assessment_configuration_id),
    classroom_id: Number(row.classroom_id),
    classroom_name: String(row.classroom_name),
    subject_id: Number(row.subject_id),
    subject_code: String(row.subject_code),
    subject_name: String(row.subject_name),
    semester_id: Number(row.semester_id),
    semester_name: String(row.semester_name),
    academic_year_id: Number(row.academic_year_id),
    academic_year_name: String(row.academic_year_name),
    teacher_user_id: Number(row.teacher_user_id),
    teacher_name: String(row.teacher_name),
    status: row.status,
    revision: Number(row.revision),
    submitted_by_user_id:
      row.submitted_by_user_id === null ? null : Number(row.submitted_by_user_id),
    submitted_at: row.submitted_at,
    approved_by_user_id:
      row.approved_by_user_id === null ? null : Number(row.approved_by_user_id),
    approved_at: row.approved_at,
    locked_by_user_id:
      row.locked_by_user_id === null ? null : Number(row.locked_by_user_id),
    locked_at: row.locked_at,
    student_count: Number(row.student_count),
    scored_student_count: Number(row.scored_student_count),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapColumn(row: Row): GradebookColumn {
  return {
    id: Number(row.id),
    gradebook_id: Number(row.gradebook_id),
    assessment_category_id: Number(row.assessment_category_id),
    category_code: String(row.category_code),
    category_name: String(row.category_name),
    entry_index: Number(row.entry_index),
    label: String(row.label),
    max_score: Number(row.max_score),
    weight_percent: Number(row.weight_percent),
    sort_order: Number(row.sort_order),
  };
}

function mapScore(row: Row): StudentScore {
  return {
    id: Number(row.id),
    column_id: Number(row.column_id),
    student_user_id: Number(row.student_user_id),
    state: row.state,
    score: row.score === null ? null : Number(row.score),
    version: Number(row.version),
    updated_at: row.updated_at,
  };
}

export async function findGradebooks(
  query: GradebookListQuery,
  teacherUserId?: number,
) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (teacherUserId) {
    conditions.push('assignment.teacher_user_id = ?');
    params.push(teacherUserId);
  }
  if (query.classroom_id) {
    conditions.push('gradebook.classroom_id = ?');
    params.push(query.classroom_id);
  }
  if (query.semester_id) {
    conditions.push('gradebook.semester_id = ?');
    params.push(query.semester_id);
  }
  if (query.status) {
    conditions.push('gradebook.status = ?::gradebook_status');
    params.push(query.status);
  }
  if (query.q) {
    conditions.push(`(
      classroom.name ILIKE ? OR subject.name ILIKE ? OR teacher.full_name ILIKE ?
    )`);
    const search = `%${query.q}%`;
    params.push(search, search, search);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (query.page - 1) * query.limit;
  const [rows] = await databasePool.query<Row[]>(
    `${summarySelect}
     ${where}
     ORDER BY academic_year.start_date DESC, semester.start_date DESC,
       classroom.name, subject.name
     LIMIT ? OFFSET ?`,
    [...params, query.limit, offset],
  );
  const [countRows] = await databasePool.query<Row[]>(
    `SELECT COUNT(*)::int AS total
     FROM gradebooks gradebook
     JOIN teaching_assignments assignment
       ON assignment.id = gradebook.teaching_assignment_id
     JOIN users teacher ON teacher.id = assignment.teacher_user_id
     JOIN classrooms classroom ON classroom.id = gradebook.classroom_id
     JOIN subjects subject ON subject.id = gradebook.subject_id
     ${where}`,
    params,
  );
  return {
    data: rows.map(mapSummary),
    total: Number(countRows[0]?.total ?? 0),
  };
}

export async function findGradebookSummaryById(id: number) {
  const [rows] = await databasePool.query<Row[]>(
    `${summarySelect} WHERE gradebook.id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? mapSummary(rows[0]) : null;
}

export async function findGradebookSetup(teachingAssignmentId: number) {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT assignment.*,
       classroom.grade_level,
       configuration.id AS configuration_id
     FROM teaching_assignments assignment
     JOIN classrooms classroom ON classroom.id = assignment.classroom_id
     LEFT JOIN assessment_configurations configuration
       ON configuration.subject_id = assignment.subject_id
      AND configuration.semester_id = assignment.semester_id
      AND configuration.grade_level = classroom.grade_level
      AND configuration.status = 'active'
     WHERE assignment.id = ?
     LIMIT 1`,
    [teachingAssignmentId],
  );
  return rows[0] ?? null;
}

export async function insertGradebook(
  setup: Row,
  createdByUserId: number,
) {
  const connection = await databasePool.getConnection();
  let id = 0;
  try {
    await connection.beginTransaction();
    const [result] = await connection.query<DatabaseResult>(
      `INSERT INTO gradebooks (
         teaching_assignment_id, assessment_configuration_id,
         classroom_id, subject_id, semester_id, created_by_user_id
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (teaching_assignment_id) DO UPDATE
         SET updated_at = gradebooks.updated_at
       RETURNING id`,
      [
        setup.id,
        setup.configuration_id,
        setup.classroom_id,
        setup.subject_id,
        setup.semester_id,
        createdByUserId,
      ],
    );
    id = result.insertId;
    const [existing] = await connection.query<Row[]>(
      'SELECT COUNT(*)::int AS total FROM gradebook_columns WHERE gradebook_id = ?',
      [id],
    );
    if (Number(existing[0]?.total ?? 0) === 0) {
      const [categories] = await connection.query<Row[]>(
        `SELECT *
         FROM assessment_categories
         WHERE configuration_id = ?
         ORDER BY sort_order, id`,
        [setup.configuration_id],
      );
      for (const category of categories) {
        for (let index = 1; index <= Number(category.max_entries); index += 1) {
          await connection.query(
            `INSERT INTO gradebook_columns (
               gradebook_id, assessment_category_id, category_code,
               category_name, entry_index, label, max_score,
               weight_percent, sort_order
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              category.id,
              category.code,
              category.name,
              index,
              Number(category.max_entries) === 1
                ? category.name
                : `${category.name} ${index}`,
              category.score_scale,
              category.weight_percent,
              Number(category.sort_order) * 100 + index,
            ],
          );
        }
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findGradebookDetail(id);
}

export async function findGradebookTotals(id: number): Promise<StudentGradeTotal[]> {
  const [rows] = await databasePool.query<Row[]>(
    `WITH roster AS (
       SELECT DISTINCT enrollment.student_user_id
       FROM gradebooks gradebook
       JOIN semesters semester ON semester.id = gradebook.semester_id
       JOIN student_enrollments enrollment
         ON enrollment.classroom_id = gradebook.classroom_id
        AND enrollment.enrolled_at <= semester.end_date
        AND (enrollment.ended_at IS NULL OR enrollment.ended_at >= semester.start_date)
       WHERE gradebook.id = ?
     ),
     categories AS (
       SELECT assessment_category_id, max(max_score) AS max_score,
         max(weight_percent) AS weight_percent
       FROM gradebook_columns
       WHERE gradebook_id = ?
       GROUP BY assessment_category_id
     ),
     category_scores AS (
       SELECT roster.student_user_id, category.assessment_category_id,
         category.max_score, category.weight_percent,
         COUNT(score.id) FILTER (
           WHERE score.state IN ('scored', 'absent')
         ) AS counted_entries,
         COALESCE(SUM(
           CASE WHEN score.state = 'scored' THEN score.score ELSE 0 END
         ) FILTER (WHERE score.state IN ('scored', 'absent')), 0) AS score_sum
       FROM roster
       CROSS JOIN categories category
       LEFT JOIN gradebook_columns column_record
         ON column_record.gradebook_id = ?
        AND column_record.assessment_category_id = category.assessment_category_id
       LEFT JOIN student_scores score
         ON score.gradebook_id = ?
        AND score.column_id = column_record.id
        AND score.student_user_id = roster.student_user_id
       GROUP BY roster.student_user_id, category.assessment_category_id,
         category.max_score, category.weight_percent
     ),
     totals AS (
       SELECT student_user_id,
         bool_and(counted_entries > 0) AS is_complete,
         CASE WHEN bool_and(counted_entries > 0) THEN
           SUM(
             (score_sum / NULLIF(counted_entries, 0)) / max_score
             * configuration.score_scale * weight_percent / 100
           )
         END AS raw_score,
         configuration.decimal_places,
         configuration.rounding_mode
       FROM category_scores
       JOIN gradebooks gradebook ON gradebook.id = ?
       JOIN assessment_configurations configuration
         ON configuration.id = gradebook.assessment_configuration_id
       GROUP BY student_user_id, configuration.decimal_places,
         configuration.rounding_mode
     )
     SELECT student_user_id, is_complete, raw_score,
       CASE
         WHEN raw_score IS NULL THEN NULL
         WHEN rounding_mode = 'truncate'
           THEN trunc(raw_score, decimal_places)
         WHEN rounding_mode = 'half_even'
           THEN round_half_even(raw_score, decimal_places)
         ELSE round(raw_score, decimal_places)
       END AS final_score
     FROM totals
     ORDER BY student_user_id`,
    [id, id, id, id, id],
  );
  return rows.map((row) => ({
    student_user_id: Number(row.student_user_id),
    is_complete: Boolean(row.is_complete),
    raw_score: row.raw_score === null ? null : Number(row.raw_score),
    final_score: row.final_score === null ? null : Number(row.final_score),
  }));
}

export async function findGradebookDetail(
  id: number,
): Promise<GradebookDetail | null> {
  const summary = await findGradebookSummaryById(id);
  if (!summary) return null;
  const [[configurationRows], [columnRows], [studentRows], [scoreRows], totals] =
    await Promise.all([
      databasePool.query<Row[]>(
        `SELECT configuration.title, configuration.score_scale,
           configuration.decimal_places, configuration.rounding_mode
         FROM gradebooks gradebook
         JOIN assessment_configurations configuration
           ON configuration.id = gradebook.assessment_configuration_id
         WHERE gradebook.id = ?`,
        [id],
      ),
      databasePool.query<Row[]>(
        `SELECT * FROM gradebook_columns
         WHERE gradebook_id = ? ORDER BY sort_order, id`,
        [id],
      ),
      databasePool.query<Row[]>(
        `SELECT DISTINCT student.id AS user_id, student.full_name,
           profile.student_code
         FROM gradebooks gradebook
         JOIN semesters semester ON semester.id = gradebook.semester_id
         JOIN student_enrollments enrollment
           ON enrollment.classroom_id = gradebook.classroom_id
          AND enrollment.enrolled_at <= semester.end_date
          AND (enrollment.ended_at IS NULL OR enrollment.ended_at >= semester.start_date)
         JOIN users student
           ON student.id = enrollment.student_user_id
          AND student.status = 'active'
         LEFT JOIN student_profiles profile ON profile.user_id = student.id
         WHERE gradebook.id = ?
         ORDER BY student.full_name, student.id`,
        [id],
      ),
      databasePool.query<Row[]>(
        `SELECT * FROM student_scores
         WHERE gradebook_id = ?
         ORDER BY student_user_id, column_id`,
        [id],
      ),
      findGradebookTotals(id),
    ]);
  const configuration = configurationRows[0];
  return {
    ...summary,
    configuration: {
      title: String(configuration.title),
      score_scale: Number(configuration.score_scale),
      decimal_places: Number(configuration.decimal_places),
      rounding_mode: configuration.rounding_mode,
    },
    columns: columnRows.map(mapColumn),
    students: studentRows.map(
      (row): GradebookStudent => ({
        user_id: Number(row.user_id),
        full_name: String(row.full_name),
        student_code: row.student_code ? String(row.student_code) : null,
      }),
    ),
    scores: scoreRows.map(mapScore),
    totals,
  };
}

export class ScoreVersionConflictError extends Error {
  constructor(
    public readonly studentUserId: number,
    public readonly columnId: number,
    public readonly currentVersion: number,
  ) {
    super('SCORE_VERSION_CONFLICT');
  }
}

async function auditScore(
  connection: DatabaseConnection,
  input: {
    scoreId: number;
    gradebookId: number;
    columnId: number;
    studentUserId: number;
    actorUserId: number;
    action: 'insert' | 'update';
    oldState: string | null;
    newState: string;
    oldScore: unknown;
    newScore: unknown;
    oldVersion: number | null;
    newVersion: number;
    reason: string | null;
  },
) {
  await connection.query(
    `INSERT INTO student_score_audits (
       student_score_id, gradebook_id, column_id, student_user_id,
       actor_user_id, action, old_state, new_state, old_score, new_score,
       old_version, new_version, reason
     ) VALUES (?, ?, ?, ?, ?, ?, ?::grade_score_state,
       ?::grade_score_state, ?, ?, ?, ?, ?)`,
    [
      input.scoreId,
      input.gradebookId,
      input.columnId,
      input.studentUserId,
      input.actorUserId,
      input.action,
      input.oldState,
      input.newState,
      input.oldScore,
      input.newScore,
      input.oldVersion,
      input.newVersion,
      input.reason,
    ],
  );
}

export async function saveGradebookScores(
  gradebookId: number,
  input: GradebookScoreBatchInput,
  actorUserId: number,
) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      'SELECT id FROM gradebooks WHERE id = ? FOR UPDATE',
      [gradebookId],
    );
    for (const entry of input.entries) {
      const [rows] = await connection.query<Row[]>(
        `SELECT * FROM student_scores
         WHERE gradebook_id = ? AND column_id = ? AND student_user_id = ?
         FOR UPDATE`,
        [gradebookId, entry.column_id, entry.student_user_id],
      );
      const current = rows[0];
      if (current) {
        if (Number(current.version) !== entry.expected_version) {
          throw new ScoreVersionConflictError(
            entry.student_user_id,
            entry.column_id,
            Number(current.version),
          );
        }
        if (
          current.state === entry.state &&
          String(current.score ?? '') === String(entry.score ?? '')
        ) {
          continue;
        }
        const nextVersion = Number(current.version) + 1;
        await connection.query(
          `UPDATE student_scores
           SET state = ?::grade_score_state, score = ?,
             version = ?, updated_by_user_id = ?
           WHERE id = ?`,
          [
            entry.state,
            entry.score,
            nextVersion,
            actorUserId,
            current.id,
          ],
        );
        await auditScore(connection, {
          scoreId: Number(current.id),
          gradebookId,
          columnId: entry.column_id,
          studentUserId: entry.student_user_id,
          actorUserId,
          action: 'update',
          oldState: current.state,
          newState: entry.state,
          oldScore: current.score,
          newScore: entry.score,
          oldVersion: Number(current.version),
          newVersion: nextVersion,
          reason: input.reason ?? null,
        });
      } else {
        if (entry.expected_version !== 0) {
          throw new ScoreVersionConflictError(
            entry.student_user_id,
            entry.column_id,
            0,
          );
        }
        const [result] = await connection.query<DatabaseResult>(
          `INSERT INTO student_scores (
             gradebook_id, column_id, student_user_id, state, score,
             version, updated_by_user_id
           ) VALUES (?, ?, ?, ?::grade_score_state, ?, 1, ?)
           RETURNING id`,
          [
            gradebookId,
            entry.column_id,
            entry.student_user_id,
            entry.state,
            entry.score,
            actorUserId,
          ],
        );
        await auditScore(connection, {
          scoreId: result.insertId,
          gradebookId,
          columnId: entry.column_id,
          studentUserId: entry.student_user_id,
          actorUserId,
          action: 'insert',
          oldState: null,
          newState: entry.state,
          oldScore: null,
          newScore: entry.score,
          oldVersion: null,
          newVersion: 1,
          reason: input.reason ?? null,
        });
      }
    }
    await connection.query(
      'UPDATE gradebooks SET revision = revision + 1 WHERE id = ?',
      [gradebookId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findGradebookDetail(gradebookId);
}

export async function findGradebookAudits(
  gradebookId: number,
): Promise<StudentScoreAudit[]> {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT audit.*, column_record.label AS column_label,
       student.full_name AS student_name, actor.full_name AS actor_name
     FROM student_score_audits audit
     JOIN gradebook_columns column_record ON column_record.id = audit.column_id
     JOIN users student ON student.id = audit.student_user_id
     LEFT JOIN users actor ON actor.id = audit.actor_user_id
     WHERE audit.gradebook_id = ?
     ORDER BY audit.changed_at DESC, audit.id DESC
     LIMIT 500`,
    [gradebookId],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    student_score_id:
      row.student_score_id === null ? null : Number(row.student_score_id),
    column_id: Number(row.column_id),
    column_label: String(row.column_label),
    student_user_id: Number(row.student_user_id),
    student_name: String(row.student_name),
    actor_user_id: row.actor_user_id === null ? null : Number(row.actor_user_id),
    actor_name: row.actor_name ? String(row.actor_name) : null,
    action: row.action,
    old_state: row.old_state,
    new_state: row.new_state,
    old_score: row.old_score === null ? null : Number(row.old_score),
    new_score: row.new_score === null ? null : Number(row.new_score),
    old_version: row.old_version === null ? null : Number(row.old_version),
    new_version: Number(row.new_version),
    reason: row.reason,
    changed_at: row.changed_at,
  }));
}

export class GradebookWorkflowConflictError extends Error {}

const transitionMatrix: Record<GradebookStatus, GradebookStatus[]> = {
  draft: ['submitted'],
  submitted: ['draft', 'approved'],
  approved: ['locked'],
  locked: [],
};

export async function transitionGradebookStatus(
  gradebookId: number,
  targetStatus: GradebookStatus,
  actorUserId: number,
  action: Extract<GradebookWorkflowAction, 'submit' | 'approve' | 'reject' | 'lock'>,
  reason: string | null,
) {
  const connection = await databasePool.getConnection();
  let changed = false;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<Row[]>(
      'SELECT * FROM gradebooks WHERE id = ? FOR UPDATE',
      [gradebookId],
    );
    const current = rows[0];
    if (!current) throw new GradebookWorkflowConflictError('GRADEBOOK_NOT_FOUND');
    if (current.status === targetStatus) {
      await connection.commit();
      return { gradebook: await findGradebookSummaryById(gradebookId), changed };
    }
    if (
      !transitionMatrix[current.status as GradebookStatus].includes(targetStatus)
    ) {
      throw new GradebookWorkflowConflictError(
        `INVALID_TRANSITION:${current.status}:${targetStatus}`,
      );
    }
    const nextRevision = Number(current.revision) + 1;
    await connection.query(
      `UPDATE gradebooks
       SET status = ?::gradebook_status, revision = ?,
         submitted_by_user_id = CASE
           WHEN ? = 'submitted' THEN ?::bigint
           WHEN ? = 'draft' THEN NULL
           ELSE submitted_by_user_id END,
         submitted_at = CASE
           WHEN ? = 'submitted' THEN CURRENT_TIMESTAMP
           WHEN ? = 'draft' THEN NULL
           ELSE submitted_at END,
         approved_by_user_id = CASE
           WHEN ? = 'approved' THEN ?::bigint
           WHEN ? = 'draft' THEN NULL
           ELSE approved_by_user_id END,
         approved_at = CASE
           WHEN ? = 'approved' THEN CURRENT_TIMESTAMP
           WHEN ? = 'draft' THEN NULL
           ELSE approved_at END,
         locked_by_user_id = CASE
           WHEN ? = 'locked' THEN ?::bigint
           ELSE NULL END,
         locked_at = CASE WHEN ? = 'locked' THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = ?`,
      [
        targetStatus,
        nextRevision,
        targetStatus,
        actorUserId,
        targetStatus,
        targetStatus,
        targetStatus,
        targetStatus,
        actorUserId,
        targetStatus,
        targetStatus,
        targetStatus,
        targetStatus,
        actorUserId,
        targetStatus,
        gradebookId,
      ],
    );
    await connection.query(
      `INSERT INTO gradebook_workflow_audits (
         gradebook_id, actor_user_id, action, old_status, new_status,
         reason, revision
       ) VALUES (?, ?, ?, ?::gradebook_status, ?::gradebook_status, ?, ?)`,
      [
        gradebookId,
        actorUserId,
        action,
        current.status,
        targetStatus,
        reason,
        nextRevision,
      ],
    );
    changed = true;
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return { gradebook: await findGradebookSummaryById(gradebookId), changed };
}

function mapChangeRequest(row: Row): GradebookChangeRequest {
  return {
    id: Number(row.id),
    gradebook_id: Number(row.gradebook_id),
    classroom_name: String(row.classroom_name),
    subject_name: String(row.subject_name),
    teacher_name: String(row.teacher_name),
    requested_by_user_id:
      row.requested_by_user_id === null ? null : Number(row.requested_by_user_id),
    requested_by_name: row.requested_by_name,
    requested_revision: Number(row.requested_revision),
    reason: String(row.reason),
    status: row.status,
    reviewed_by_user_id:
      row.reviewed_by_user_id === null ? null : Number(row.reviewed_by_user_id),
    reviewed_by_name: row.reviewed_by_name,
    review_note: row.review_note,
    reviewed_at: row.reviewed_at,
    created_at: row.created_at,
  };
}

const changeRequestSelect = `
  SELECT request.*, classroom.name AS classroom_name,
    subject.name AS subject_name, teacher.full_name AS teacher_name,
    requester.full_name AS requested_by_name,
    reviewer.full_name AS reviewed_by_name
  FROM gradebook_change_requests request
  JOIN gradebooks gradebook ON gradebook.id = request.gradebook_id
  JOIN classrooms classroom ON classroom.id = gradebook.classroom_id
  JOIN subjects subject ON subject.id = gradebook.subject_id
  JOIN teaching_assignments assignment
    ON assignment.id = gradebook.teaching_assignment_id
  JOIN users teacher ON teacher.id = assignment.teacher_user_id
  LEFT JOIN users requester ON requester.id = request.requested_by_user_id
  LEFT JOIN users reviewer ON reviewer.id = request.reviewed_by_user_id
`;

export async function createGradebookChangeRequestRecord(
  gradebookId: number,
  requestedByUserId: number,
  reason: string,
) {
  const connection = await databasePool.getConnection();
  let requestId = 0;
  let changed = false;
  try {
    await connection.beginTransaction();
    const [books] = await connection.query<Row[]>(
      'SELECT * FROM gradebooks WHERE id = ? FOR UPDATE',
      [gradebookId],
    );
    const gradebook = books[0];
    if (!gradebook) throw new GradebookWorkflowConflictError('GRADEBOOK_NOT_FOUND');
    if (gradebook.status !== 'locked') {
      throw new GradebookWorkflowConflictError('GRADEBOOK_NOT_LOCKED');
    }
    const [pending] = await connection.query<Row[]>(
      `SELECT id FROM gradebook_change_requests
       WHERE gradebook_id = ? AND status = 'pending' LIMIT 1`,
      [gradebookId],
    );
    if (pending[0]) {
      requestId = Number(pending[0].id);
      await connection.commit();
      return {
        request: await findGradebookChangeRequestById(requestId),
        changed,
      };
    }
    const [result] = await connection.query<DatabaseResult>(
      `INSERT INTO gradebook_change_requests (
         gradebook_id, requested_by_user_id, requested_revision, reason
       ) VALUES (?, ?, ?, ?) RETURNING id`,
      [gradebookId, requestedByUserId, gradebook.revision, reason],
    );
    requestId = result.insertId;
    await connection.query(
      `INSERT INTO gradebook_workflow_audits (
         gradebook_id, change_request_id, actor_user_id, action,
         old_status, new_status, reason, revision
       ) VALUES (?, ?, ?, 'change_request_create',
         'locked', 'locked', ?, ?)`,
      [
        gradebookId,
        requestId,
        requestedByUserId,
        reason,
        gradebook.revision,
      ],
    );
    changed = true;
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return {
    request: await findGradebookChangeRequestById(requestId),
    changed,
  };
}

export async function findGradebookChangeRequestById(id: number) {
  const [rows] = await databasePool.query<Row[]>(
    `${changeRequestSelect} WHERE request.id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? mapChangeRequest(rows[0]) : null;
}

export async function findGradebookChangeRequests(
  status?: 'pending' | 'approved' | 'rejected',
) {
  const [rows] = await databasePool.query<Row[]>(
    `${changeRequestSelect}
     ${status ? 'WHERE request.status = ?' : ''}
     ORDER BY request.created_at DESC, request.id DESC
     LIMIT 200`,
    status ? [status] : [],
  );
  return rows.map(mapChangeRequest);
}

export async function reviewGradebookChangeRequestRecord(
  requestId: number,
  reviewerUserId: number,
  decision: 'approved' | 'rejected',
  note: string,
) {
  const connection = await databasePool.getConnection();
  let changed = false;
  let gradebookId = 0;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<Row[]>(
      `SELECT request.*, gradebook.status AS gradebook_status,
         gradebook.revision AS gradebook_revision
       FROM gradebook_change_requests request
       JOIN gradebooks gradebook ON gradebook.id = request.gradebook_id
       WHERE request.id = ? FOR UPDATE OF request, gradebook`,
      [requestId],
    );
    const request = rows[0];
    if (!request) throw new GradebookWorkflowConflictError('REQUEST_NOT_FOUND');
    gradebookId = Number(request.gradebook_id);
    if (Number(request.requested_by_user_id) === reviewerUserId) {
      throw new GradebookWorkflowConflictError('SELF_REVIEW_NOT_ALLOWED');
    }
    if (request.status !== 'pending') {
      if (request.status === decision) {
        await connection.commit();
        return {
          request: await findGradebookChangeRequestById(requestId),
          changed,
        };
      }
      throw new GradebookWorkflowConflictError('REQUEST_ALREADY_REVIEWED');
    }
    if (request.gradebook_status !== 'locked') {
      throw new GradebookWorkflowConflictError('GRADEBOOK_NOT_LOCKED');
    }
    await connection.query(
      `UPDATE gradebook_change_requests
       SET status = ?, reviewed_by_user_id = ?, review_note = ?,
         reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [decision, reviewerUserId, note, requestId],
    );
    let nextRevision = Number(request.gradebook_revision);
    if (decision === 'approved') {
      nextRevision += 1;
      await connection.query(
        `UPDATE gradebooks
         SET status = 'draft', revision = ?,
           submitted_by_user_id = NULL, submitted_at = NULL,
           approved_by_user_id = NULL, approved_at = NULL,
           locked_by_user_id = NULL, locked_at = NULL
         WHERE id = ?`,
        [nextRevision, gradebookId],
      );
    }
    await connection.query(
      `INSERT INTO gradebook_workflow_audits (
         gradebook_id, change_request_id, actor_user_id, action,
         old_status, new_status, reason, revision
       ) VALUES (?, ?, ?, ?, 'locked',
         ?::gradebook_status, ?, ?)`,
      [
        gradebookId,
        requestId,
        reviewerUserId,
        decision === 'approved'
          ? 'change_request_approve'
          : 'change_request_reject',
        decision === 'approved' ? 'draft' : 'locked',
        note,
        nextRevision,
      ],
    );
    changed = true;
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return {
    request: await findGradebookChangeRequestById(requestId),
    gradebook: await findGradebookSummaryById(gradebookId),
    changed,
  };
}

export async function findGradebookWorkflowAudits(
  gradebookId: number,
): Promise<GradebookWorkflowAudit[]> {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT audit.*, actor.full_name AS actor_name
     FROM gradebook_workflow_audits audit
     LEFT JOIN users actor ON actor.id = audit.actor_user_id
     WHERE audit.gradebook_id = ?
     ORDER BY audit.created_at DESC, audit.id DESC`,
    [gradebookId],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    gradebook_id: Number(row.gradebook_id),
    change_request_id:
      row.change_request_id === null ? null : Number(row.change_request_id),
    actor_user_id:
      row.actor_user_id === null ? null : Number(row.actor_user_id),
    actor_name: row.actor_name,
    action: row.action,
    old_status: row.old_status,
    new_status: row.new_status,
    reason: row.reason,
    revision: Number(row.revision),
    created_at: row.created_at,
  }));
}

export async function findPublishedGradesForStudent(
  studentUserId: number,
  query: StudentGradeQuery = {},
): Promise<StudentPublishedGrade[]> {
  const conditions = [
    "gradebook.status IN ('approved', 'locked')",
    `EXISTS (
      SELECT 1
      FROM student_enrollments enrollment
      JOIN semesters scope_semester
        ON scope_semester.id = gradebook.semester_id
      WHERE enrollment.student_user_id = ?
        AND enrollment.classroom_id = gradebook.classroom_id
        AND enrollment.enrolled_at <= scope_semester.end_date
        AND (
          enrollment.ended_at IS NULL
          OR enrollment.ended_at >= scope_semester.start_date
        )
    )`,
  ];
  const params: unknown[] = [studentUserId];
  if (query.academic_year_id) {
    conditions.push('academic_year.id = ?');
    params.push(query.academic_year_id);
  }
  if (query.semester_id) {
    conditions.push('gradebook.semester_id = ?');
    params.push(query.semester_id);
  }
  if (query.subject_id) {
    conditions.push('gradebook.subject_id = ?');
    params.push(query.subject_id);
  }
  const [rows] = await databasePool.query<Row[]>(
    `${summarySelect}
     WHERE ${conditions.join(' AND ')}
     ORDER BY academic_year.start_date DESC, semester.start_date DESC,
       subject.name`,
    params,
  );
  const result: StudentPublishedGrade[] = [];
  for (const row of rows) {
    const summary = mapSummary(row);
    const totals = await findGradebookTotals(summary.id);
    const total = totals.find(
      (item) => item.student_user_id === studentUserId,
    );
    const [configurationRows] = await databasePool.query<Row[]>(
      `SELECT configuration.score_scale
       FROM gradebooks gradebook
       JOIN assessment_configurations configuration
         ON configuration.id = gradebook.assessment_configuration_id
       WHERE gradebook.id = ?`,
      [summary.id],
    );
    const [scoreRows] = await databasePool.query<Row[]>(
      `SELECT gradebook_column.id AS column_id,
         gradebook_column.category_code,
         gradebook_column.category_name,
         gradebook_column.entry_index,
         gradebook_column.label,
         gradebook_column.max_score,
         score.state,
         score.score
       FROM gradebook_columns gradebook_column
       LEFT JOIN student_scores score
         ON score.gradebook_id = gradebook_column.gradebook_id
        AND score.column_id = gradebook_column.id
        AND score.student_user_id = ?
       WHERE gradebook_column.gradebook_id = ?
       ORDER BY gradebook_column.sort_order, gradebook_column.id`,
      [studentUserId, summary.id],
    );
    result.push({
      id: summary.id,
      classroom_name: summary.classroom_name,
      academic_year_id: summary.academic_year_id,
      semester_id: summary.semester_id,
      subject_id: summary.subject_id,
      subject_code: summary.subject_code,
      subject_name: summary.subject_name,
      teacher_name: summary.teacher_name,
      semester_name: summary.semester_name,
      academic_year_name: summary.academic_year_name,
      status: summary.status as 'approved' | 'locked',
      score_scale: Number(configurationRows[0]?.score_scale ?? 10),
      final_score: total?.final_score ?? null,
      approved_at: summary.approved_at,
      locked_at: summary.locked_at,
      scores: scoreRows.map((score) => ({
        column_id: Number(score.column_id),
        category_code: String(score.category_code),
        category_name: String(score.category_name),
        entry_index: Number(score.entry_index),
        label: String(score.label),
        max_score: Number(score.max_score),
        state: score.state ?? 'unscored',
        score: score.score == null ? null : Number(score.score),
      })),
    });
  }
  return result;
}

export async function findPublishedGradeFilterOptionsForStudent(
  studentUserId: number,
): Promise<StudentGradeFilterOptions> {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT DISTINCT
       academic_year.id AS academic_year_id,
       academic_year.name AS academic_year_name,
       academic_year.start_date AS academic_year_start_date,
       semester.id AS semester_id,
       semester.name AS semester_name,
       semester.start_date AS semester_start_date,
       subject.id AS subject_id,
       subject.code AS subject_code,
       subject.name AS subject_name
     FROM gradebooks gradebook
     JOIN semesters semester ON semester.id = gradebook.semester_id
     JOIN academic_years academic_year
       ON academic_year.id = semester.academic_year_id
     JOIN subjects subject ON subject.id = gradebook.subject_id
     WHERE gradebook.status IN ('approved', 'locked')
       AND EXISTS (
         SELECT 1
         FROM student_enrollments enrollment
         WHERE enrollment.student_user_id = ?
           AND enrollment.classroom_id = gradebook.classroom_id
           AND enrollment.enrolled_at <= semester.end_date
           AND (
             enrollment.ended_at IS NULL
             OR enrollment.ended_at >= semester.start_date
           )
       )
     ORDER BY academic_year_start_date DESC, semester_start_date DESC,
       subject_name`,
    [studentUserId],
  );
  const academicYears = new Map<number, { id: number; name: string }>();
  const semesters = new Map<
    number,
    { id: number; academic_year_id: number; name: string }
  >();
  const subjects = new Map<
    string,
    {
      id: number;
      code: string;
      name: string;
      academic_year_id: number;
      semester_id: number;
    }
  >();
  for (const row of rows) {
    const academicYearId = Number(row.academic_year_id);
    const semesterId = Number(row.semester_id);
    const subjectId = Number(row.subject_id);
    academicYears.set(academicYearId, {
      id: academicYearId,
      name: String(row.academic_year_name),
    });
    semesters.set(semesterId, {
      id: semesterId,
      academic_year_id: academicYearId,
      name: String(row.semester_name),
    });
    subjects.set(`${semesterId}:${subjectId}`, {
      id: subjectId,
      code: String(row.subject_code),
      name: String(row.subject_name),
      academic_year_id: academicYearId,
      semester_id: semesterId,
    });
  }
  return {
    academic_years: [...academicYears.values()],
    semesters: [...semesters.values()],
    subjects: [...subjects.values()],
  };
}
