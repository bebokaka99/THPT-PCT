import type {
  DatabaseConnection,
  DatabaseResult,
  DatabaseRow,
} from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  ConductAction,
  ConductAudit,
  ConductRating,
  ConductRecord,
  ConductRosterItem,
  ConductStatus,
  ConductUpsertInput,
} from './conduct.types.js';

type Row = DatabaseRow & Record<string, any>;

const recordSelect = `
  SELECT record.*,
    student.full_name AS student_name,
    profile.student_code,
    classroom.name AS classroom_name,
    semester.name AS semester_name,
    academic_year.name AS academic_year_name
  FROM student_conduct_records record
  JOIN users student ON student.id = record.student_user_id
  LEFT JOIN student_profiles profile ON profile.user_id = student.id
  JOIN classrooms classroom ON classroom.id = record.classroom_id
  JOIN semesters semester ON semester.id = record.semester_id
  JOIN academic_years academic_year ON academic_year.id = record.academic_year_id
`;

function mapRecord(row: Row): ConductRecord {
  return {
    id: Number(row.id),
    student_user_id: Number(row.student_user_id),
    student_code: row.student_code ? String(row.student_code) : null,
    student_name: String(row.student_name),
    classroom_id: Number(row.classroom_id),
    classroom_name: String(row.classroom_name),
    semester_id: Number(row.semester_id),
    semester_name: String(row.semester_name),
    academic_year_id: Number(row.academic_year_id),
    academic_year_name: String(row.academic_year_name),
    rating: row.rating,
    homeroom_comment: row.homeroom_comment
      ? String(row.homeroom_comment)
      : null,
    status: row.status,
    revision: Number(row.revision),
    created_by_user_id:
      row.created_by_user_id === null
        ? null
        : Number(row.created_by_user_id),
    submitted_at: row.submitted_at,
    approved_at: row.approved_at,
    locked_at: row.locked_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function findConductRecordById(
  id: number,
  connection?: DatabaseConnection,
) {
  const executor = connection ?? databasePool;
  const [rows] = await executor.query<Row[]>(
    `${recordSelect} WHERE record.id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? mapRecord(rows[0]) : null;
}

export async function findStudentConductContext(
  studentUserId: number,
  semesterId: number,
) {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT enrollment.student_user_id, enrollment.classroom_id,
       enrollment.academic_year_id, classroom.name AS classroom_name,
       classroom.homeroom_teacher_user_id, semester.name AS semester_name,
       academic_year.name AS academic_year_name
     FROM student_enrollments enrollment
     JOIN semesters semester ON semester.id = ?
       AND semester.academic_year_id = enrollment.academic_year_id
     JOIN classrooms classroom ON classroom.id = enrollment.classroom_id
     JOIN academic_years academic_year ON academic_year.id = enrollment.academic_year_id
     WHERE enrollment.student_user_id = ?
       AND enrollment.enrolled_at <= semester.end_date
       AND (enrollment.ended_at IS NULL OR enrollment.ended_at >= semester.start_date)
     ORDER BY enrollment.created_at DESC
     LIMIT 1`,
    [semesterId, studentUserId],
  );
  return rows[0] ?? null;
}

export async function isClassroomHomeroomTeacher(
  classroomId: number,
  teacherUserId: number,
) {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT id FROM classrooms
     WHERE id = ? AND homeroom_teacher_user_id = ? LIMIT 1`,
    [classroomId, teacherUserId],
  );
  return Boolean(rows[0]);
}

export async function findClassroomConductRoster(
  classroomId: number,
  semesterId: number,
): Promise<ConductRosterItem[]> {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT enrollment.student_user_id AS roster_student_user_id,
       student.full_name AS student_name,
       profile.student_code, record.*, record.id AS record_id,
       classroom.name AS classroom_name, semester.name AS semester_name,
       academic_year.name AS academic_year_name,
       attendance.present_count, attendance.excused_count,
       attendance.unexcused_count, attendance.late_count
     FROM student_enrollments enrollment
     JOIN semesters semester ON semester.id = ?
       AND semester.academic_year_id = enrollment.academic_year_id
     JOIN users student ON student.id = enrollment.student_user_id
     LEFT JOIN student_profiles profile ON profile.user_id = student.id
     JOIN classrooms classroom ON classroom.id = enrollment.classroom_id
     JOIN academic_years academic_year
       ON academic_year.id = enrollment.academic_year_id
     LEFT JOIN student_conduct_records record
       ON record.student_user_id = enrollment.student_user_id
       AND record.semester_id = semester.id
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*) FILTER (WHERE attendance_record.status = 'present')::int
           AS present_count,
         COUNT(*) FILTER (WHERE attendance_record.status = 'excused')::int
           AS excused_count,
         COUNT(*) FILTER (WHERE attendance_record.status = 'unexcused')::int
           AS unexcused_count,
         COUNT(*) FILTER (WHERE attendance_record.status = 'late')::int
           AS late_count
       FROM attendance_records attendance_record
       JOIN attendance_sessions attendance_session
         ON attendance_session.id = attendance_record.session_id
       WHERE attendance_record.student_user_id = enrollment.student_user_id
         AND attendance_session.classroom_id = enrollment.classroom_id
         AND attendance_session.semester_id = semester.id
     ) attendance ON TRUE
     WHERE enrollment.classroom_id = ?
       AND enrollment.enrolled_at <= semester.end_date
       AND (enrollment.ended_at IS NULL OR enrollment.ended_at >= semester.start_date)
     ORDER BY student.full_name`,
    [semesterId, classroomId],
  );
  const data: ConductRosterItem[] = [];
  for (const row of rows) {
    data.push({
      student_user_id: Number(row.roster_student_user_id),
      student_code: row.student_code ? String(row.student_code) : null,
      student_name: String(row.student_name),
      attendance_summary: {
        present: Number(row.present_count ?? 0),
        excused: Number(row.excused_count ?? 0),
        unexcused: Number(row.unexcused_count ?? 0),
        late: Number(row.late_count ?? 0),
      },
      record: row.record_id ? mapRecord(row) : null,
    });
  }
  return data;
}

export async function findPublishedConductForStudent(
  studentUserId: number,
  semesterId: number,
) {
  const [rows] = await databasePool.query<Row[]>(
    `${recordSelect}
     WHERE record.student_user_id = ? AND record.semester_id = ?
       AND record.status IN ('approved', 'locked')
     LIMIT 1`,
    [studentUserId, semesterId],
  );
  return rows[0] ? mapRecord(rows[0]) : null;
}

export async function findPublishedConductForSemester(semesterId: number) {
  const [rows] = await databasePool.query<Row[]>(
    `${recordSelect}
     WHERE record.semester_id = ?
       AND record.status IN ('approved', 'locked')`,
    [semesterId],
  );
  return rows.map(mapRecord);
}

async function insertAudit(
  connection: DatabaseConnection,
  values: {
    recordId: number;
    actorUserId: number;
    action: ConductAction;
    oldStatus: ConductStatus | null;
    newStatus: ConductStatus;
    oldRating: ConductRating | null;
    newRating: ConductRating;
    oldComment: string | null;
    newComment: string | null;
    reason?: string | null;
    revision: number;
  },
) {
  await connection.query(
    `INSERT INTO student_conduct_audits (
       conduct_record_id, actor_user_id, action, old_status, new_status,
       old_rating, new_rating, old_comment, new_comment, reason, revision
     ) VALUES (?, ?, ?, ?::conduct_status, ?::conduct_status,
       ?::conduct_rating, ?::conduct_rating, ?, ?, ?, ?)`,
    [
      values.recordId,
      values.actorUserId,
      values.action,
      values.oldStatus,
      values.newStatus,
      values.oldRating,
      values.newRating,
      values.oldComment,
      values.newComment,
      values.reason ?? null,
      values.revision,
    ],
  );
}

export async function upsertConductRecord(
  context: {
    student_user_id: number;
    classroom_id: number;
    academic_year_id: number;
  },
  input: ConductUpsertInput,
  actorUserId: number,
) {
  const connection = await databasePool.getConnection();
  let recordId = 0;
  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.query<Row[]>(
      `SELECT * FROM student_conduct_records
       WHERE student_user_id = ? AND semester_id = ?
       FOR UPDATE`,
      [context.student_user_id, input.semester_id],
    );
    const current = existingRows[0];
    if (current && current.status !== 'draft') {
      throw new Error('CONDUCT_NOT_DRAFT');
    }
    if (current) {
      const revision = Number(current.revision) + 1;
      await connection.query(
        `UPDATE student_conduct_records
         SET rating = ?::conduct_rating, homeroom_comment = ?,
           revision = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [input.rating, input.homeroom_comment, revision, current.id],
      );
      recordId = Number(current.id);
      await insertAudit(connection, {
        recordId,
        actorUserId,
        action: 'edit',
        oldStatus: current.status,
        newStatus: current.status,
        oldRating: current.rating,
        newRating: input.rating,
        oldComment: current.homeroom_comment ?? null,
        newComment: input.homeroom_comment,
        revision,
      });
    } else {
      const [result] = await connection.query<DatabaseResult>(
        `INSERT INTO student_conduct_records (
           student_user_id, classroom_id, semester_id, academic_year_id,
           rating, homeroom_comment, created_by_user_id
         ) VALUES (?, ?, ?, ?, ?::conduct_rating, ?, ?) RETURNING id`,
        [
          context.student_user_id,
          context.classroom_id,
          input.semester_id,
          context.academic_year_id,
          input.rating,
          input.homeroom_comment,
          actorUserId,
        ],
      );
      recordId = result.insertId;
      await insertAudit(connection, {
        recordId,
        actorUserId,
        action: 'create',
        oldStatus: null,
        newStatus: 'draft',
        oldRating: null,
        newRating: input.rating,
        oldComment: null,
        newComment: input.homeroom_comment,
        revision: 1,
      });
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findConductRecordById(recordId);
}

export class ConductWorkflowConflictError extends Error {}

export async function transitionConductRecord(
  id: number,
  targetStatus: ConductStatus,
  actorUserId: number,
  action: Extract<ConductAction, 'submit' | 'approve' | 'reject' | 'lock'>,
  reason: string | null,
) {
  const expected: Record<typeof action, ConductStatus> = {
    submit: 'draft',
    approve: 'submitted',
    reject: 'submitted',
    lock: 'approved',
  };
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<Row[]>(
      'SELECT * FROM student_conduct_records WHERE id = ? FOR UPDATE',
      [id],
    );
    const current = rows[0];
    if (!current) throw new ConductWorkflowConflictError('NOT_FOUND');
    if (current.status === targetStatus) {
      await connection.commit();
      return findConductRecordById(id);
    }
    if (current.status !== expected[action]) {
      throw new ConductWorkflowConflictError('INVALID_STATE');
    }
    const revision = Number(current.revision) + 1;
    const actorColumn =
      action === 'submit'
        ? 'submitted_by_user_id'
        : action === 'approve'
          ? 'approved_by_user_id'
          : action === 'lock'
            ? 'locked_by_user_id'
            : null;
    const timeColumn =
      action === 'submit'
        ? 'submitted_at'
        : action === 'approve'
          ? 'approved_at'
          : action === 'lock'
            ? 'locked_at'
            : null;
    const metadataSql =
      actorColumn && timeColumn
        ? `, ${actorColumn} = ?, ${timeColumn} = CURRENT_TIMESTAMP`
        : '';
    const params: unknown[] = [targetStatus, revision];
    if (actorColumn) params.push(actorUserId);
    params.push(id);
    await connection.query(
      `UPDATE student_conduct_records
       SET status = ?::conduct_status, revision = ?,
         updated_at = CURRENT_TIMESTAMP${metadataSql}
       WHERE id = ?`,
      params,
    );
    await insertAudit(connection, {
      recordId: id,
      actorUserId,
      action,
      oldStatus: current.status,
      newStatus: targetStatus,
      oldRating: current.rating,
      newRating: current.rating,
      oldComment: current.homeroom_comment ?? null,
      newComment: current.homeroom_comment ?? null,
      reason,
      revision,
    });
    await connection.commit();
    return findConductRecordById(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function findConductAudits(id: number): Promise<ConductAudit[]> {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT audit.*, actor.full_name AS actor_name
     FROM student_conduct_audits audit
     LEFT JOIN users actor ON actor.id = audit.actor_user_id
     WHERE audit.conduct_record_id = ?
     ORDER BY audit.created_at DESC, audit.id DESC`,
    [id],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    conduct_record_id: Number(row.conduct_record_id),
    actor_user_id:
      row.actor_user_id === null ? null : Number(row.actor_user_id),
    actor_name: row.actor_name ? String(row.actor_name) : null,
    action: row.action,
    old_status: row.old_status,
    new_status: row.new_status,
    old_rating: row.old_rating,
    new_rating: row.new_rating,
    old_comment: row.old_comment ?? null,
    new_comment: row.new_comment ?? null,
    reason: row.reason ?? null,
    revision: Number(row.revision),
    created_at: row.created_at,
  }));
}
