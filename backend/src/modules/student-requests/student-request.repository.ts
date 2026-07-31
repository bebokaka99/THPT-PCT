import type {
  DatabaseConnection,
  DatabaseResult,
  DatabaseRow,
} from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  StudentRequest,
  StudentRequestAttachment,
  StudentRequestCreateInput,
  StudentRequestHistory,
  StudentRequestListQuery,
  StudentRequestStatus,
  StudentRequestType,
  StudentRequestTypeInput,
} from './student-request.types.js';

type Row = DatabaseRow & Record<string, any>;

const requestSelect = `
  SELECT request.*,
    request_type.code AS request_type_code,
    request_type.name AS request_type_name,
    request_type.reviewer_scope,
    request_type.requires_attachment,
    request_type.sla_days,
    student.full_name AS student_name,
    profile.student_code,
    reviewer.full_name AS reviewer_name,
    (SELECT COUNT(*) FROM student_request_attachments attachment
      WHERE attachment.request_id = request.id) AS attachment_count
  FROM student_requests request
  JOIN student_request_types request_type ON request_type.id = request.request_type_id
  JOIN users student ON student.id = request.student_user_id
  LEFT JOIN student_profiles profile ON profile.user_id = student.id
  LEFT JOIN users reviewer ON reviewer.id = request.reviewed_by_user_id
`;

function mapType(row: Row): StudentRequestType {
  return {
    id: Number(row.id),
    code: String(row.code),
    name: String(row.name),
    description: row.description ?? null,
    instructions: row.instructions ?? null,
    reviewer_scope: row.reviewer_scope,
    requires_attachment: Boolean(row.requires_attachment),
    sla_days: Number(row.sla_days),
    form_schema: row.form_schema ?? {},
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapRequest(row: Row): StudentRequest {
  return {
    id: Number(row.id),
    request_type_id: Number(row.request_type_id),
    request_type_code: String(row.request_type_code),
    request_type_name: String(row.request_type_name),
    reviewer_scope: row.reviewer_scope,
    requires_attachment: Boolean(row.requires_attachment),
    sla_days: Number(row.sla_days),
    student_user_id: Number(row.student_user_id),
    student_name: String(row.student_name),
    student_code: row.student_code ?? null,
    title: String(row.title),
    content: String(row.content ?? ''),
    form_data: row.form_data ?? {},
    status: row.status,
    revision: Number(row.revision),
    due_at: row.due_at ?? null,
    submitted_at: row.submitted_at ?? null,
    reviewed_at: row.reviewed_at ?? null,
    reviewed_by_user_id:
      row.reviewed_by_user_id === null ? null : Number(row.reviewed_by_user_id),
    reviewer_name: row.reviewer_name ?? null,
    decision_reason: row.decision_reason ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    attachment_count: Number(row.attachment_count ?? 0),
  };
}

function mapAttachment(row: Row): StudentRequestAttachment {
  return {
    id: Number(row.id),
    request_id: Number(row.request_id),
    original_name: String(row.original_name),
    mime_type: String(row.mime_type),
    size_bytes: Number(row.size_bytes),
    created_at: row.created_at,
    download_url: `/api/student-requests/${row.request_id}/attachments/${row.id}/download`,
  };
}

export async function findStudentRequestTypes(activeOnly = true) {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT * FROM student_request_types
     ${activeOnly ? 'WHERE is_active = TRUE' : ''}
     ORDER BY name, id`,
  );
  return rows.map(mapType);
}

export async function findStudentRequestTypeById(id: number) {
  const [rows] = await databasePool.query<Row[]>(
    'SELECT * FROM student_request_types WHERE id = ? LIMIT 1',
    [id],
  );
  return rows[0] ? mapType(rows[0]) : null;
}

export async function createStudentRequestTypeRecord(
  input: StudentRequestTypeInput,
  actorUserId: number,
) {
  const [result] = await databasePool.query<DatabaseResult>(
    `INSERT INTO student_request_types (
       code, name, description, instructions, reviewer_scope,
       requires_attachment, sla_days, form_schema, is_active, created_by_user_id
     ) VALUES (?, ?, ?, ?, ?::student_request_reviewer_scope, ?, ?, ?::jsonb, ?, ?)
     RETURNING id`,
    [
      input.code,
      input.name,
      input.description ?? null,
      input.instructions ?? null,
      input.reviewer_scope,
      input.requires_attachment,
      input.sla_days,
      JSON.stringify(input.form_schema ?? {}),
      input.is_active,
      actorUserId,
    ],
  );
  return findStudentRequestTypeById(result.insertId);
}

export async function updateStudentRequestTypeRecord(
  id: number,
  input: StudentRequestTypeInput,
) {
  const [result] = await databasePool.query<DatabaseResult>(
    `UPDATE student_request_types SET
       code = ?, name = ?, description = ?, instructions = ?,
       reviewer_scope = ?::student_request_reviewer_scope,
       requires_attachment = ?, sla_days = ?, form_schema = ?::jsonb,
       is_active = ?
     WHERE id = ?`,
    [
      input.code,
      input.name,
      input.description ?? null,
      input.instructions ?? null,
      input.reviewer_scope,
      input.requires_attachment,
      input.sla_days,
      JSON.stringify(input.form_schema ?? {}),
      input.is_active,
      id,
    ],
  );
  return result.affectedRows ? findStudentRequestTypeById(id) : null;
}

export async function findStudentRequests(
  query: StudentRequestListQuery,
  access: { role: 'admin' | 'teacher' | 'student'; userId: number },
) {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (access.role === 'student') {
    where.push('request.student_user_id = ?');
    params.push(access.userId);
  } else {
    where.push(`request.status <> 'draft'`);
  }
  if (access.role === 'teacher') {
    where.push(`request_type.reviewer_scope = 'homeroom' AND EXISTS (
      SELECT 1
      FROM student_enrollments enrollment
      JOIN classrooms classroom ON classroom.id = enrollment.classroom_id
      WHERE enrollment.student_user_id = request.student_user_id
        AND enrollment.status = 'active'
        AND classroom.homeroom_teacher_user_id = ?
    )`);
    params.push(access.userId);
  }
  if (query.status) {
    where.push('request.status = ?::student_request_status');
    params.push(query.status);
  }
  if (query.type_id) {
    where.push('request.request_type_id = ?');
    params.push(query.type_id);
  }
  if (query.q) {
    where.push(
      '(request.title ILIKE ? OR student.full_name ILIKE ? OR profile.student_code ILIKE ?)',
    );
    const search = `%${query.q}%`;
    params.push(search, search, search);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (query.page - 1) * query.limit;
  const [rows] = await databasePool.query<Row[]>(
    `${requestSelect} ${whereSql}
     ORDER BY request.created_at DESC, request.id DESC LIMIT ? OFFSET ?`,
    [...params, query.limit, offset],
  );
  const [counts] = await databasePool.query<Array<{ total: number }>>(
    `SELECT COUNT(*) AS total
     FROM student_requests request
     JOIN student_request_types request_type ON request_type.id = request.request_type_id
     JOIN users student ON student.id = request.student_user_id
     LEFT JOIN student_profiles profile ON profile.user_id = student.id
     ${whereSql}`,
    params,
  );
  return {
    data: rows.map(mapRequest),
    total: Number(counts[0]?.total ?? 0),
  };
}

export async function findStudentRequestById(id: number) {
  const [rows] = await databasePool.query<Row[]>(
    `${requestSelect} WHERE request.id = ? LIMIT 1`,
    [id],
  );
  if (!rows[0]) return null;
  const request = mapRequest(rows[0]);
  const [attachments] = await databasePool.query<Row[]>(
    `SELECT * FROM student_request_attachments
     WHERE request_id = ? ORDER BY created_at, id`,
    [id],
  );
  request.attachments = attachments.map(mapAttachment);
  return request;
}

export async function createStudentRequestRecord(
  studentUserId: number,
  input: StudentRequestCreateInput,
) {
  const connection = await databasePool.getConnection();
  let id = 0;
  try {
    await connection.beginTransaction();
    const [result] = await connection.query<DatabaseResult>(
      `INSERT INTO student_requests (
         request_type_id, student_user_id, title, content, form_data
       ) VALUES (?, ?, ?, ?, ?::jsonb) RETURNING id`,
      [
        input.request_type_id,
        studentUserId,
        input.title,
        input.content,
        JSON.stringify(input.form_data),
      ],
    );
    id = result.insertId;
    await insertHistory(connection, {
      requestId: id,
      actorUserId: studentUserId,
      action: 'create',
      oldStatus: null,
      newStatus: 'draft',
      reason: null,
      revision: 1,
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findStudentRequestById(id);
}

async function insertHistory(
  connection: DatabaseConnection,
  input: {
    requestId: number;
    actorUserId: number;
    action: string;
    oldStatus: StudentRequestStatus | null;
    newStatus: StudentRequestStatus;
    reason: string | null;
    revision: number;
  },
) {
  await connection.query(
    `INSERT INTO student_request_status_history (
       request_id, actor_user_id, action, old_status, new_status, reason, revision
     ) VALUES (?, ?, ?, ?::student_request_status, ?::student_request_status, ?, ?)`,
    [
      input.requestId,
      input.actorUserId,
      input.action,
      input.oldStatus,
      input.newStatus,
      input.reason,
      input.revision,
    ],
  );
}

export async function transitionStudentRequestRecord(
  id: number,
  actorUserId: number,
  input: {
    action: 'submit' | 'start_review' | 'approve' | 'reject' | 'cancel';
    expectedStatuses: StudentRequestStatus[];
    status: StudentRequestStatus;
    reason?: string | null;
    dueAt?: Date | null;
  },
) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<Row[]>(
      'SELECT * FROM student_requests WHERE id = ? FOR UPDATE',
      [id],
    );
    const current = rows[0];
    if (
      !current ||
      !input.expectedStatuses.includes(current.status as StudentRequestStatus)
    ) {
      await connection.rollback();
      return null;
    }
    const revision = Number(current.revision) + 1;
    await connection.query(
      `UPDATE student_requests SET
         status = ?::student_request_status,
         revision = ?,
         submitted_at = CASE WHEN ? = 'submit' THEN CURRENT_TIMESTAMP ELSE submitted_at END,
         due_at = COALESCE(?, due_at),
         reviewed_at = CASE WHEN ? IN ('approve', 'reject') THEN CURRENT_TIMESTAMP ELSE reviewed_at END,
         reviewed_by_user_id = CASE WHEN ? IN ('start_review', 'approve', 'reject') THEN ? ELSE reviewed_by_user_id END,
         decision_reason = CASE WHEN ? IN ('approve', 'reject') THEN ? ELSE decision_reason END
       WHERE id = ?`,
      [
        input.status,
        revision,
        input.action,
        input.dueAt ?? null,
        input.action,
        input.action,
        actorUserId,
        input.action,
        input.reason ?? null,
        id,
      ],
    );
    await insertHistory(connection, {
      requestId: id,
      actorUserId,
      action: input.action,
      oldStatus: current.status,
      newStatus: input.status,
      reason: input.reason ?? null,
      revision,
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findStudentRequestById(id);
}

export async function addStudentRequestAttachmentRecord(
  requestId: number,
  actorUserId: number,
  file: Express.Multer.File,
) {
  const [result] = await databasePool.query<DatabaseResult>(
    `INSERT INTO student_request_attachments (
       request_id, original_name, stored_name, storage_path, mime_type,
       size_bytes, uploaded_by_user_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [
      requestId,
      file.originalname,
      file.filename,
      file.filename,
      file.mimetype,
      file.size,
      actorUserId,
    ],
  );
  const attachment = await findStudentRequestAttachmentRecord(
    requestId,
    result.insertId,
  );
  return attachment ? mapAttachment(attachment) : null;
}

export async function findStudentRequestAttachmentRecord(
  requestId: number,
  attachmentId: number,
) {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT * FROM student_request_attachments
     WHERE request_id = ? AND id = ? LIMIT 1`,
    [requestId, attachmentId],
  );
  return rows[0] ?? null;
}

export async function findStudentRequestHistory(
  requestId: number,
): Promise<StudentRequestHistory[]> {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT history.*, actor.full_name AS actor_name
     FROM student_request_status_history history
     LEFT JOIN users actor ON actor.id = history.actor_user_id
     WHERE history.request_id = ?
     ORDER BY history.created_at, history.id`,
    [requestId],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    request_id: Number(row.request_id),
    actor_user_id:
      row.actor_user_id === null ? null : Number(row.actor_user_id),
    actor_name: row.actor_name ?? null,
    action: String(row.action),
    old_status: row.old_status ?? null,
    new_status: row.new_status,
    reason: row.reason ?? null,
    revision: Number(row.revision),
    created_at: row.created_at,
  }));
}

export async function isHomeroomReviewer(
  teacherUserId: number,
  studentUserId: number,
) {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT classroom.id
     FROM student_enrollments enrollment
     JOIN classrooms classroom ON classroom.id = enrollment.classroom_id
     WHERE enrollment.student_user_id = ?
       AND enrollment.status = 'active'
       AND classroom.homeroom_teacher_user_id = ?
     LIMIT 1`,
    [studentUserId, teacherUserId],
  );
  return Boolean(rows[0]);
}

export async function findHomeroomTeacherUserIds(studentUserId: number) {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT DISTINCT classroom.homeroom_teacher_user_id AS id
     FROM student_enrollments enrollment
     JOIN classrooms classroom ON classroom.id = enrollment.classroom_id
     JOIN users teacher ON teacher.id = classroom.homeroom_teacher_user_id
     WHERE enrollment.student_user_id = ?
       AND enrollment.status = 'active'
       AND classroom.homeroom_teacher_user_id IS NOT NULL
       AND teacher.status = 'active'`,
    [studentUserId],
  );
  return rows.map((row) => Number(row.id));
}
