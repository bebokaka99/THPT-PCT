import type {
  DatabaseConnection,
  DatabaseResult,
  DatabaseRow,
} from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  Assignment,
  AssignmentAttachment,
  AssignmentAttachmentInput,
  AssignmentDetail,
  AssignmentInput,
  AssignmentListQuery,
  AssignmentSubmission,
  AssignmentSubmissionFile,
  AssignmentSubmissionStatus,
} from './assignment.types.js';

type AssignmentRow = DatabaseRow & Assignment;
type CountRow = DatabaseRow & { total: number };
type ExistsRow = DatabaseRow & { exists: boolean };
type SubmissionRow = DatabaseRow & AssignmentSubmission;
type SubmissionFileRow = DatabaseRow & AssignmentSubmissionFile;

export type AssignmentScope =
  | { role: 'admin' }
  | { role: 'teacher'; userId: number }
  | { role: 'student'; userId: number };

const assignmentSelect = `
  SELECT assignment.*,
    classroom.name AS classroom_name,
    subject.name AS subject_name,
    semester.name AS semester_name,
    teaching.teacher_user_id,
    teacher.full_name AS teacher_name,
    (SELECT COUNT(*) FROM assignment_submissions submission
      WHERE submission.assignment_id = assignment.id
        AND submission.status <> 'withdrawn')::INTEGER AS submission_count,
    (SELECT COUNT(DISTINCT enrollment.student_user_id)
      FROM student_enrollments enrollment
      WHERE enrollment.classroom_id = assignment.classroom_id
        AND enrollment.enrolled_at <= COALESCE(assignment.published_at::DATE, CURRENT_DATE)
        AND (enrollment.ended_at IS NULL
          OR enrollment.ended_at >= COALESCE(assignment.published_at::DATE, CURRENT_DATE))
    )::INTEGER AS student_count
  FROM assignments assignment
  JOIN classrooms classroom ON classroom.id = assignment.classroom_id
  JOIN subjects subject ON subject.id = assignment.subject_id
  JOIN semesters semester ON semester.id = assignment.semester_id
  JOIN teaching_assignments teaching
    ON teaching.id = assignment.teaching_assignment_id
  JOIN users teacher ON teacher.id = teaching.teacher_user_id
`;

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function nullableIso(value: unknown) {
  return value ? iso(value) : null;
}

function mapAssignment(row: AssignmentRow): Assignment {
  return {
    ...row,
    id: Number(row.id),
    classroom_id: Number(row.classroom_id),
    subject_id: Number(row.subject_id),
    semester_id: Number(row.semester_id),
    teaching_assignment_id: Number(row.teaching_assignment_id),
    teacher_user_id: Number(row.teacher_user_id),
    created_by_user_id:
      row.created_by_user_id === null ? null : Number(row.created_by_user_id),
    due_at: iso(row.due_at),
    published_at: nullableIso(row.published_at),
    closed_at: nullableIso(row.closed_at),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    submission_count: Number(row.submission_count),
    student_count: Number(row.student_count),
    my_submission_status:
      row.my_submission_status === undefined
        ? undefined
        : row.my_submission_status,
  };
}

function mapAttachment(
  row: DatabaseRow & AssignmentAttachment,
): AssignmentAttachment {
  return {
    ...row,
    id: Number(row.id),
    assignment_id: Number(row.assignment_id),
    media_file_id:
      row.media_file_id === null ? null : Number(row.media_file_id),
    size: row.size === null ? null : Number(row.size),
    sort_order: Number(row.sort_order),
    created_at: iso(row.created_at),
  };
}

function mapFile(row: SubmissionFileRow): AssignmentSubmissionFile {
  return {
    id: Number(row.id),
    submission_id: Number(row.submission_id),
    media_file_id:
      row.media_file_id === null ? null : Number(row.media_file_id),
    file_url: String(row.file_url),
    original_name: String(row.original_name),
    mime_type: String(row.mime_type),
    size: Number(row.size),
    version: Number(row.version),
    is_active: Boolean(row.is_active),
    uploaded_at: iso(row.uploaded_at),
    replaced_at: nullableIso(row.replaced_at),
  };
}

function mapSubmission(row: SubmissionRow): AssignmentSubmission {
  const currentFile =
    row.current_file && typeof row.current_file === 'object'
      ? mapFile(row.current_file as SubmissionFileRow)
      : null;
  return {
    id: Number(row.id),
    assignment_id: Number(row.assignment_id),
    student_user_id: Number(row.student_user_id),
    student_name: String(row.student_name ?? ''),
    student_code: row.student_code ?? null,
    status: row.status,
    first_submitted_at: iso(row.first_submitted_at),
    last_submitted_at: iso(row.last_submitted_at),
    note: row.note ?? null,
    content_text: row.content_text ?? null,
    link_url: row.link_url ?? null,
    feedback: row.feedback ?? null,
    score: row.score === null || row.score === undefined ? null : Number(row.score),
    returned_at: nullableIso(row.returned_at),
    graded_at: nullableIso(row.graded_at),
    reviewed_by_user_id:
      row.reviewed_by_user_id === null || row.reviewed_by_user_id === undefined
        ? null
        : Number(row.reviewed_by_user_id),
    current_file: currentFile,
  };
}

function buildWhere(query: AssignmentListQuery, scope: AssignmentScope) {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (query.q) {
    where.push(
      '(assignment.title ILIKE ? OR assignment.description ILIKE ? OR subject.name ILIKE ?)',
    );
    const search = `%${query.q}%`;
    params.push(search, search, search);
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
  if (scope.role === 'teacher') {
    where.push('teaching.teacher_user_id = ?');
    params.push(scope.userId);
  }
  if (scope.role === 'student') {
    where.push("assignment.status IN ('published', 'closed')");
    where.push(`EXISTS (
      SELECT 1 FROM student_enrollments enrollment
      WHERE enrollment.student_user_id = ?
        AND enrollment.classroom_id = assignment.classroom_id
        AND enrollment.enrolled_at <= assignment.published_at::DATE
        AND (enrollment.ended_at IS NULL
          OR enrollment.ended_at >= assignment.published_at::DATE)
    )`);
    params.push(scope.userId);
  }
  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

export async function findAssignments(
  query: AssignmentListQuery,
  scope: AssignmentScope,
) {
  const { whereSql, params } = buildWhere(query, scope);
  const offset = (query.page - 1) * query.limit;
  const studentSelect =
    scope.role === 'student'
      ? `, (SELECT submission.status
          FROM assignment_submissions submission
          WHERE submission.assignment_id = assignment.id
            AND submission.student_user_id = ?
          LIMIT 1) AS my_submission_status`
      : '';
  const selectParams =
    scope.role === 'student' ? [scope.userId, ...params] : params;
  const [rows] = await databasePool.query<AssignmentRow[]>(
    `${assignmentSelect.replace(
      '  FROM assignments assignment',
      `${studentSelect}\n  FROM assignments assignment`,
    )}
     ${whereSql}
     ORDER BY assignment.due_at ASC, assignment.created_at DESC
     LIMIT ? OFFSET ?`,
    [...selectParams, query.limit, offset],
  );
  const [countRows] = await databasePool.query<CountRow[]>(
    `SELECT COUNT(*) AS total
     FROM assignments assignment
     JOIN teaching_assignments teaching
       ON teaching.id = assignment.teaching_assignment_id
     JOIN subjects subject ON subject.id = assignment.subject_id
     ${whereSql}`,
    params,
  );
  return {
    data: rows.map(mapAssignment),
    total: Number(countRows[0]?.total ?? 0),
  };
}

export async function findAssignmentById(id: number) {
  const [rows] = await databasePool.query<AssignmentRow[]>(
    `${assignmentSelect} WHERE assignment.id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? mapAssignment(rows[0]) : null;
}

export async function findAssignmentAttachments(assignmentId: number) {
  const [rows] = await databasePool.query<
    Array<DatabaseRow & AssignmentAttachment>
  >(
    `SELECT * FROM assignment_attachments
     WHERE assignment_id = ?
     ORDER BY sort_order, id`,
    [assignmentId],
  );
  return rows.map(mapAttachment);
}

export async function studentCanAccessAssignment(
  assignmentId: number,
  studentUserId: number,
) {
  const [rows] = await databasePool.query<ExistsRow[]>(
    `SELECT EXISTS (
      SELECT 1
      FROM assignments assignment
      JOIN student_enrollments enrollment
        ON enrollment.classroom_id = assignment.classroom_id
       AND enrollment.student_user_id = ?
       AND enrollment.enrolled_at <= assignment.published_at::DATE
       AND (enrollment.ended_at IS NULL
         OR enrollment.ended_at >= assignment.published_at::DATE)
      WHERE assignment.id = ?
        AND assignment.status IN ('published', 'closed')
    ) AS exists`,
    [studentUserId, assignmentId],
  );
  return Boolean(rows[0]?.exists);
}

export async function findTeachingScope(teachingAssignmentId: number) {
  const [rows] = await databasePool.query<
    Array<
      DatabaseRow & {
        id: number;
        teacher_user_id: number;
        classroom_id: number;
        subject_id: number;
        semester_id: number;
        status: string;
      }
    >
  >(
    `SELECT id, teacher_user_id, classroom_id, subject_id, semester_id, status
     FROM teaching_assignments WHERE id = ? LIMIT 1`,
    [teachingAssignmentId],
  );
  return rows[0]
    ? {
        ...rows[0],
        id: Number(rows[0].id),
        teacher_user_id: Number(rows[0].teacher_user_id),
        classroom_id: Number(rows[0].classroom_id),
        subject_id: Number(rows[0].subject_id),
        semester_id: Number(rows[0].semester_id),
      }
    : null;
}

async function replaceAttachments(
  connection: DatabaseConnection,
  assignmentId: number,
  attachments: AssignmentAttachmentInput[],
) {
  await connection.query(
    'DELETE FROM assignment_attachments WHERE assignment_id = ?',
    [assignmentId],
  );
  for (const attachment of attachments) {
    await connection.query(
      `INSERT INTO assignment_attachments (
        assignment_id, media_file_id, file_url, original_name, mime_type,
        size, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        assignmentId,
        attachment.media_file_id ?? null,
        attachment.file_url,
        attachment.original_name ?? null,
        attachment.mime_type ?? null,
        attachment.size ?? null,
        attachment.sort_order,
      ],
    );
  }
}

export async function insertAssignment(
  input: AssignmentInput,
  scope: {
    classroom_id: number;
    subject_id: number;
    semester_id: number;
  },
  userId: number,
) {
  const connection = await databasePool.getConnection();
  let id = 0;
  try {
    await connection.beginTransaction();
    const [result] = await connection.query<DatabaseResult>(
      `INSERT INTO assignments (
        classroom_id, subject_id, semester_id, teaching_assignment_id,
        title, description, due_at, allow_late, max_score,
        guardian_can_view_feedback, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        scope.classroom_id,
        scope.subject_id,
        scope.semester_id,
        input.teaching_assignment_id,
        input.title,
        input.description ?? null,
        input.due_at,
        input.allow_late,
        input.max_score ?? null,
        input.guardian_can_view_feedback ?? true,
        userId,
      ],
    );
    id = result.insertId;
    await replaceAttachments(connection, id, input.attachments ?? []);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findAssignmentById(id);
}

export async function updateAssignmentRecord(
  id: number,
  input: {
    title: string;
    description: string | null;
    due_at: string;
    allow_late: boolean;
    max_score: number | null;
    guardian_can_view_feedback: boolean;
    attachments?: AssignmentAttachmentInput[];
  },
) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE assignments
       SET title = ?, description = ?, due_at = ?, allow_late = ?,
           max_score = ?, guardian_can_view_feedback = ?
       WHERE id = ?`,
      [input.title, input.description, input.due_at, input.allow_late,
        input.max_score, input.guardian_can_view_feedback, id],
    );
    if (input.attachments) {
      await replaceAttachments(connection, id, input.attachments);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findAssignmentById(id);
}

export async function setAssignmentStatusRecord(
  id: number,
  status: 'published' | 'closed',
) {
  await databasePool.query(
    `UPDATE assignments SET
      status = ?,
      published_at = CASE
        WHEN ? = 'published' THEN COALESCE(published_at, NOW())
        ELSE published_at
      END,
      closed_at = CASE WHEN ? = 'closed' THEN NOW() ELSE NULL END
     WHERE id = ?`,
    [status, status, status, id],
  );
  return findAssignmentById(id);
}

export async function deleteAssignmentRecord(id: number) {
  const [rows] = await databasePool.query<CountRow[]>(
    'SELECT COUNT(*) AS total FROM assignment_submissions WHERE assignment_id = ?',
    [id],
  );
  if (Number(rows[0]?.total ?? 0) > 0) return false;
  const [result] = await databasePool.query<DatabaseResult>(
    "DELETE FROM assignments WHERE id = ? AND status = 'draft'",
    [id],
  );
  return result.affectedRows > 0;
}

const currentFileExpression = `(
  SELECT jsonb_build_object(
    'id', file.id,
    'submission_id', file.submission_id,
    'media_file_id', file.media_file_id,
    'file_url', file.file_url,
    'original_name', file.original_name,
    'mime_type', file.mime_type,
    'size', file.size,
    'version', file.version,
    'is_active', file.is_active,
    'uploaded_at', file.uploaded_at,
    'replaced_at', file.replaced_at
  )
  FROM assignment_submission_files file
  WHERE file.submission_id = submission.id AND file.is_active = TRUE
  LIMIT 1
) AS current_file`;

export async function findStudentSubmission(
  assignmentId: number,
  studentUserId: number,
  includeFiles = false,
) {
  const [rows] = await databasePool.query<SubmissionRow[]>(
    `SELECT submission.*, student.full_name AS student_name,
       profile.student_code, ${currentFileExpression}
     FROM assignment_submissions submission
     JOIN users student ON student.id = submission.student_user_id
     LEFT JOIN student_profiles profile ON profile.user_id = student.id
     WHERE submission.assignment_id = ? AND submission.student_user_id = ?
     LIMIT 1`,
    [assignmentId, studentUserId],
  );
  if (!rows[0]) return null;
  const submission = mapSubmission(rows[0]);
  if (includeFiles) {
    const [files] = await databasePool.query<SubmissionFileRow[]>(
      `SELECT * FROM assignment_submission_files
       WHERE submission_id = ? ORDER BY version DESC`,
      [submission.id],
    );
    submission.files = files.map(mapFile);
  }
  return submission;
}

export async function findAssignmentDetail(
  id: number,
  studentUserId?: number,
): Promise<AssignmentDetail | null> {
  const assignment = await findAssignmentById(id);
  if (!assignment) return null;
  return {
    ...assignment,
    attachments: await findAssignmentAttachments(id),
    my_submission: studentUserId
      ? await findStudentSubmission(id, studentUserId, true)
      : null,
  };
}

export async function findAssignmentSubmissions(assignmentId: number) {
  const [rows] = await databasePool.query<SubmissionRow[]>(
    `SELECT submission.*, student.full_name AS student_name,
       profile.student_code, ${currentFileExpression}
     FROM assignment_submissions submission
     JOIN users student ON student.id = submission.student_user_id
     LEFT JOIN student_profiles profile ON profile.user_id = student.id
     WHERE submission.assignment_id = ?
     ORDER BY submission.last_submitted_at DESC`,
    [assignmentId],
  );
  return rows.map(mapSubmission);
}

export async function saveStudentSubmission(
  assignmentId: number,
  studentUserId: number,
  input: {
    note: string | null;
    content_text: string | null;
    link_url: string | null;
    file: {
      storage_path: string;
      original_name: string;
      mime_type: string;
      size: number;
    } | null;
  },
) {
  const connection = await databasePool.getConnection();
  let submissionId = 0;
  try {
    await connection.beginTransaction();
    const [assignmentRows] = await connection.query<
      Array<
        DatabaseRow & {
          status: string;
          due_at: Date;
          allow_late: boolean;
        }
      >
    >(
      `SELECT status, due_at, allow_late
       FROM assignments WHERE id = ? FOR UPDATE`,
      [assignmentId],
    );
    const assignment = assignmentRows[0];
    if (!assignment || !['published', 'closed'].includes(assignment.status)) {
      throw new Error('ASSIGNMENT_NOT_OPEN');
    }
    const [accessRows] = await connection.query<ExistsRow[]>(
      `SELECT EXISTS (
        SELECT 1 FROM assignments assignment
        JOIN student_enrollments enrollment
          ON enrollment.classroom_id = assignment.classroom_id
         AND enrollment.student_user_id = ?
         AND enrollment.enrolled_at <= assignment.published_at::DATE
         AND (enrollment.ended_at IS NULL
           OR enrollment.ended_at >= assignment.published_at::DATE)
        WHERE assignment.id = ?
      ) AS exists`,
      [studentUserId, assignmentId],
    );
    if (!accessRows[0]?.exists) throw new Error('ASSIGNMENT_STUDENT_SCOPE');

    const isLate = new Date() > new Date(assignment.due_at);
    if (isLate && !assignment.allow_late) {
      throw new Error('ASSIGNMENT_DEADLINE_PASSED');
    }
    const status: AssignmentSubmissionStatus = isLate ? 'late' : 'submitted';
    const [existingRows] = await connection.query<
      Array<DatabaseRow & { id: number; status: AssignmentSubmissionStatus }>
    >(
      `SELECT id, status FROM assignment_submissions
       WHERE assignment_id = ? AND student_user_id = ? FOR UPDATE`,
      [assignmentId, studentUserId],
    );
    const existing = existingRows[0];
    let oldFileId: number | null = null;
    if (existing) {
      submissionId = Number(existing.id);
      const [oldFiles] = await connection.query<
        Array<DatabaseRow & { id: number }>
      >(
        `SELECT id FROM assignment_submission_files
         WHERE submission_id = ? AND is_active = TRUE FOR UPDATE`,
        [submissionId],
      );
      oldFileId = oldFiles[0] ? Number(oldFiles[0].id) : null;
      if (input.file) {
        await connection.query(
          `UPDATE assignment_submission_files SET is_active = FALSE, replaced_at = NOW()
           WHERE submission_id = ? AND is_active = TRUE`,
          [submissionId],
        );
      }
      await connection.query(
        `UPDATE assignment_submissions SET status = ?, note = ?,
          content_text = ?, link_url = ?, feedback = NULL, score = NULL,
          returned_at = NULL, graded_at = NULL, reviewed_by_user_id = NULL,
          last_submitted_at = NOW(), withdrawn_at = NULL
         WHERE id = ?`,
        [status, input.note, input.content_text, input.link_url, submissionId],
      );
    } else {
      const [result] = await connection.query<DatabaseResult>(
        `INSERT INTO assignment_submissions (
          assignment_id, student_user_id, status, note, content_text, link_url
        ) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
        [assignmentId, studentUserId, status, input.note, input.content_text, input.link_url],
      );
      submissionId = result.insertId;
    }
    if (!input.file && !existing && !input.content_text && !input.link_url) {
      throw new Error('ASSIGNMENT_CONTENT_REQUIRED');
    }
    let newFileId: number | null = null;
    if (input.file) {
      const [versionRows] = await connection.query<Array<DatabaseRow & { version: number }>>(
        `SELECT COALESCE(MAX(version), 0) + 1 AS version FROM assignment_submission_files WHERE submission_id = ?`,
        [submissionId],
      );
      const version = Number(versionRows[0]?.version ?? 1);
      const [fileResult] = await connection.query<DatabaseResult>(
        `INSERT INTO assignment_submission_files (
          submission_id, file_url, storage_path, original_name, mime_type, size, version, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE) RETURNING id`,
        [submissionId, '/api/assignments/pending', input.file.storage_path,
          input.file.original_name, input.file.mime_type, input.file.size, version],
      );
      newFileId = fileResult.insertId;
      await connection.query(
        `UPDATE assignment_submission_files SET file_url = ? WHERE id = ?`,
        [`/api/assignments/${assignmentId}/submissions/${submissionId}/files/${newFileId}/download`, newFileId],
      );
    }
    await connection.query(
      `INSERT INTO assignment_submission_audits (
        submission_id, actor_user_id, action, old_status, new_status,
        old_file_id, new_file_id, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        submissionId,
        studentUserId,
        input.file && existing ? 'replace' : 'submit',
        existing?.status ?? null,
        status,
        oldFileId,
        newFileId,
        input.note,
      ],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findStudentSubmission(assignmentId, studentUserId, true);
}

export async function findAssignmentRoster(assignmentId: number) {
  const [rows] = await databasePool.query<SubmissionRow[]>(
    `SELECT assignment.id AS assignment_id, submission.id,
       enrollment.student_user_id, student.full_name AS student_name,
       profile.student_code, submission.status, submission.note,
       submission.first_submitted_at, submission.last_submitted_at,
       submission.content_text, submission.link_url, submission.feedback,
       submission.score, submission.returned_at, submission.graded_at,
       submission.reviewed_by_user_id, ${currentFileExpression}
     FROM assignments assignment
     JOIN student_enrollments enrollment
       ON enrollment.classroom_id = assignment.classroom_id
      AND enrollment.enrolled_at <= COALESCE(assignment.published_at::DATE, CURRENT_DATE)
      AND (enrollment.ended_at IS NULL OR enrollment.ended_at >= COALESCE(assignment.published_at::DATE, CURRENT_DATE))
     JOIN users student ON student.id = enrollment.student_user_id
     LEFT JOIN student_profiles profile ON profile.user_id = student.id
     LEFT JOIN assignment_submissions submission
       ON submission.assignment_id = assignment.id
      AND submission.student_user_id = enrollment.student_user_id
     WHERE assignment.id = ?
     ORDER BY student.full_name, enrollment.student_user_id`,
    [assignmentId],
  );
  return rows.map((row) => ({
    ...mapSubmission({
      ...row,
      id: row.id ?? 0,
      assignment_id: assignmentId,
      status: row.status ?? 'not_started',
      first_submitted_at: row.first_submitted_at ?? new Date(0),
      last_submitted_at: row.last_submitted_at ?? new Date(0),
    } as SubmissionRow),
    id: row.id === null || row.id === undefined ? null : Number(row.id),
    first_submitted_at: row.first_submitted_at ? iso(row.first_submitted_at) : null,
    last_submitted_at: row.last_submitted_at ? iso(row.last_submitted_at) : null,
    status: row.status ?? 'not_started',
  }));
}

export async function reviewAssignmentSubmission(
  assignmentId: number,
  submissionId: number,
  reviewerId: number,
  input: { action: 'return' | 'grade'; feedback: string | null; score: number | null },
) {
  const connection = await databasePool.getConnection();
  let studentUserId = 0;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<Array<DatabaseRow & {
      status: AssignmentSubmissionStatus;
      student_user_id: number;
      max_score: number | null;
    }>>(
      `SELECT submission.status, submission.student_user_id, assignment.max_score
       FROM assignment_submissions submission
       JOIN assignments assignment ON assignment.id = submission.assignment_id
       WHERE submission.id = ? AND submission.assignment_id = ? FOR UPDATE`,
      [submissionId, assignmentId],
    );
    const row = rows[0];
    if (!row) throw new Error('ASSIGNMENT_SUBMISSION_NOT_FOUND');
    studentUserId = Number(row.student_user_id);
    if (input.action === 'grade' && (row.max_score === null || input.score === null)) {
      throw new Error('ASSIGNMENT_SCORE_REQUIRED');
    }
    if (input.action === 'grade' && input.score! > Number(row.max_score)) {
      throw new Error('ASSIGNMENT_SCORE_EXCEEDS_MAX');
    }
    const newStatus: AssignmentSubmissionStatus = input.action === 'grade' ? 'graded' : 'returned';
    await connection.query(
      `UPDATE assignment_submissions SET status = ?, feedback = ?, score = ?,
        returned_at = CASE WHEN ? = 'return' THEN NOW() ELSE NULL END,
        graded_at = CASE WHEN ? = 'grade' THEN NOW() ELSE NULL END,
        reviewed_by_user_id = ? WHERE id = ?`,
      [newStatus, input.feedback, input.action === 'grade' ? input.score : null,
        input.action, input.action, reviewerId, submissionId],
    );
    const [fileRows] = await connection.query<Array<DatabaseRow & { id: number }>>(
      `SELECT id FROM assignment_submission_files WHERE submission_id = ? AND is_active = TRUE LIMIT 1`,
      [submissionId],
    );
    await connection.query(
      `INSERT INTO assignment_submission_audits (
        submission_id, actor_user_id, action, old_status, new_status, new_file_id, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [submissionId, reviewerId, input.action, row.status, newStatus,
        fileRows[0]?.id ?? null, input.feedback],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return { studentUserId, submission: await findSubmissionById(assignmentId, submissionId) };
}

export async function findSubmissionById(assignmentId: number, submissionId: number) {
  const [rows] = await databasePool.query<SubmissionRow[]>(
    `SELECT submission.*, student.full_name AS student_name,
       profile.student_code, ${currentFileExpression}
     FROM assignment_submissions submission
     JOIN users student ON student.id = submission.student_user_id
     LEFT JOIN student_profiles profile ON profile.user_id = student.id
     WHERE submission.assignment_id = ? AND submission.id = ? LIMIT 1`,
    [assignmentId, submissionId],
  );
  return rows[0] ? mapSubmission(rows[0]) : null;
}

export async function findSubmissionFile(assignmentId: number, submissionId: number, fileId: number) {
  const [rows] = await databasePool.query<Array<DatabaseRow & {
    storage_path: string | null;
    original_name: string;
    mime_type: string;
    student_user_id: number;
    teacher_user_id: number;
    created_by_user_id: number | null;
  }>>(
    `SELECT file.storage_path, file.original_name, file.mime_type,
       submission.student_user_id, teaching.teacher_user_id, assignment.created_by_user_id
     FROM assignment_submission_files file
     JOIN assignment_submissions submission ON submission.id = file.submission_id
     JOIN assignments assignment ON assignment.id = submission.assignment_id
     JOIN teaching_assignments teaching ON teaching.id = assignment.teaching_assignment_id
     WHERE file.id = ? AND file.submission_id = ? AND submission.assignment_id = ? LIMIT 1`,
    [fileId, submissionId, assignmentId],
  );
  return rows[0] ?? null;
}
