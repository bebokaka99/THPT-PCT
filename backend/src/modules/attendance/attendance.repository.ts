import type {
  DatabaseConnection,
  DatabaseResult,
  DatabaseRow,
} from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  AttendanceBulkInput,
  AttendanceListQuery,
  AttendanceRecord,
  AttendanceSession,
  AttendanceSessionDetail,
  AttendanceSessionInput,
  AttendanceSummary,
} from './attendance.types.js';

type SessionRow = DatabaseRow & AttendanceSession;

const sessionSelect = `
  SELECT session.*,
    classroom.name AS classroom_name,
    semester.name AS semester_name,
    subject.name AS subject_name,
    creator.full_name AS created_by_name,
    COUNT(record.id)::INTEGER AS record_count,
    COUNT(record.id) FILTER (WHERE record.status = 'present')::INTEGER
      AS present_count,
    COUNT(record.id) FILTER (WHERE record.status = 'excused')::INTEGER
      AS excused_count,
    COUNT(record.id) FILTER (WHERE record.status = 'unexcused')::INTEGER
      AS unexcused_count,
    COUNT(record.id) FILTER (WHERE record.status = 'late')::INTEGER
      AS late_count
  FROM attendance_sessions session
  JOIN classrooms classroom ON classroom.id = session.classroom_id
  JOIN semesters semester ON semester.id = session.semester_id
  LEFT JOIN subjects subject ON subject.id = session.subject_id
  LEFT JOIN users creator ON creator.id = session.created_by_user_id
  LEFT JOIN attendance_records record ON record.session_id = session.id
`;

const sessionGroup = `
  GROUP BY session.id, classroom.name, semester.name, subject.name,
    creator.full_name
`;

function dateValue(value: unknown) {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function mapSession(row: SessionRow): AttendanceSession {
  return {
    ...row,
    id: Number(row.id),
    classroom_id: Number(row.classroom_id),
    semester_id: Number(row.semester_id),
    subject_id: row.subject_id === null ? null : Number(row.subject_id),
    teaching_assignment_id:
      row.teaching_assignment_id === null
        ? null
        : Number(row.teaching_assignment_id),
    session_date: dateValue(row.session_date),
    lesson_index: Number(row.lesson_index),
    created_by_user_id:
      row.created_by_user_id === null
        ? null
        : Number(row.created_by_user_id),
    record_count: Number(row.record_count),
    present_count: Number(row.present_count),
    excused_count: Number(row.excused_count),
    unexcused_count: Number(row.unexcused_count),
    late_count: Number(row.late_count),
  };
}

export async function findAttendanceSessions(
  query: AttendanceListQuery,
  scope?: { teacher_user_id?: number },
) {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (query.classroom_id) {
    where.push('session.classroom_id = ?');
    params.push(query.classroom_id);
  }
  if (query.semester_id) {
    where.push('session.semester_id = ?');
    params.push(query.semester_id);
  }
  if (query.from) {
    where.push('session.session_date >= ?::date');
    params.push(query.from);
  }
  if (query.to) {
    where.push('session.session_date <= ?::date');
    params.push(query.to);
  }
  if (scope?.teacher_user_id) {
    where.push(`(
      classroom.homeroom_teacher_user_id = ?
      OR EXISTS (
        SELECT 1
        FROM teaching_assignments assignment
        WHERE assignment.teacher_user_id = ?
          AND assignment.classroom_id = session.classroom_id
          AND assignment.semester_id = session.semester_id
          AND (
            session.subject_id IS NULL
            OR assignment.subject_id = session.subject_id
          )
      )
    )`);
    params.push(scope.teacher_user_id, scope.teacher_user_id);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (query.page - 1) * query.limit;
  const [rows] = await databasePool.query<SessionRow[]>(
    `${sessionSelect}
     ${whereSql}
     ${sessionGroup}
     ORDER BY session.session_date DESC, session.lesson_index ASC,
       session.id DESC
     LIMIT ? OFFSET ?`,
    [...params, query.limit, offset],
  );
  const [counts] = await databasePool.query<Array<{ total: number }>>(
    `SELECT COUNT(*) AS total
     FROM attendance_sessions session
     JOIN classrooms classroom ON classroom.id = session.classroom_id
     ${whereSql}`,
    params,
  );
  return {
    data: rows.map(mapSession),
    total: Number(counts[0]?.total ?? 0),
  };
}

export async function findAttendanceSessionById(id: number) {
  const [rows] = await databasePool.query<SessionRow[]>(
    `${sessionSelect}
     WHERE session.id = ?
     ${sessionGroup}
     LIMIT 1`,
    [id],
  );
  return rows[0] ? mapSession(rows[0]) : null;
}

export async function findAttendanceRoster(
  sessionId: number,
): Promise<AttendanceRecord[]> {
  const [rows] = await databasePool.query<
    Array<
      DatabaseRow & {
        id: number | null;
        session_id: number;
        student_user_id: number;
        student_code: string | null;
        student_name: string;
        status: AttendanceRecord['status'] | null;
        note: string | null;
        recorded_by_user_id: number | null;
        updated_at: string | null;
      }
    >
  >(
    `
      SELECT record.id, session.id AS session_id,
        enrollment.student_user_id,
        profile.student_code,
        student.full_name AS student_name,
        record.status,
        record.note,
        record.recorded_by_user_id,
        record.updated_at
      FROM attendance_sessions session
      JOIN student_enrollments enrollment
        ON enrollment.classroom_id = session.classroom_id
        AND enrollment.enrolled_at <= session.session_date
        AND (
          enrollment.ended_at IS NULL
          OR enrollment.ended_at >= session.session_date
        )
      JOIN users student ON student.id = enrollment.student_user_id
      LEFT JOIN student_profiles profile
        ON profile.user_id = enrollment.student_user_id
      LEFT JOIN attendance_records record
        ON record.session_id = session.id
        AND record.student_user_id = enrollment.student_user_id
      WHERE session.id = ?
      ORDER BY student.full_name ASC, enrollment.student_user_id ASC
    `,
    [sessionId],
  );
  return rows.map((row) => ({
    id: row.id === null ? null : Number(row.id),
    session_id: Number(row.session_id),
    student_user_id: Number(row.student_user_id),
    student_code: row.student_code ?? null,
    student_name: row.student_name,
    status: row.status ?? 'present',
    note: row.note ?? null,
    recorded_by_user_id:
      row.recorded_by_user_id === null
        ? null
        : Number(row.recorded_by_user_id),
    updated_at: row.updated_at ?? null,
  }));
}

export async function findAttendanceSessionDetail(
  id: number,
): Promise<AttendanceSessionDetail | null> {
  const session = await findAttendanceSessionById(id);
  if (!session) return null;
  return { ...session, records: await findAttendanceRoster(id) };
}

export async function insertAttendanceSession(
  input: AttendanceSessionInput,
  userId: number,
) {
  const [result] = await databasePool.query<DatabaseResult>(
    `
      INSERT INTO attendance_sessions (
        classroom_id, semester_id, subject_id, teaching_assignment_id,
        session_date, lesson_index, title, created_by_user_id
      )
      VALUES (?, ?, ?, ?, ?::date, ?, ?, ?)
      RETURNING id
    `,
    [
      input.classroom_id,
      input.semester_id,
      input.subject_id ?? null,
      input.teaching_assignment_id ?? null,
      input.session_date,
      input.lesson_index,
      input.title ?? null,
      userId,
    ],
  );
  return findAttendanceSessionDetail(result.insertId);
}

export async function teacherCanManageAttendanceScope(
  teacherUserId: number,
  input: Pick<
    AttendanceSessionInput,
    | 'classroom_id'
    | 'semester_id'
    | 'subject_id'
    | 'teaching_assignment_id'
    | 'session_date'
  >,
) {
  const [rows] = await databasePool.query<
    Array<{ is_homeroom: boolean; assignment_id: number | null }>
  >(
    `
      SELECT
        classroom.homeroom_teacher_user_id = ? AS is_homeroom,
        assignment.id AS assignment_id
      FROM classrooms classroom
      LEFT JOIN teaching_assignments assignment
        ON assignment.teacher_user_id = ?
        AND assignment.classroom_id = classroom.id
        AND assignment.semester_id = ?
        AND assignment.status = 'active'
        AND assignment.assigned_at <= ?::date
        AND (
          assignment.ended_at IS NULL
          OR assignment.ended_at >= ?::date
        )
        AND (?::bigint IS NULL OR assignment.subject_id = ?)
        AND (?::bigint IS NULL OR assignment.id = ?)
      WHERE classroom.id = ?
      ORDER BY assignment.id
      LIMIT 1
    `,
    [
      teacherUserId,
      teacherUserId,
      input.semester_id,
      input.session_date,
      input.session_date,
      input.subject_id ?? null,
      input.subject_id ?? null,
      input.teaching_assignment_id ?? null,
      input.teaching_assignment_id ?? null,
      input.classroom_id,
    ],
  );
  return {
    isHomeroom: Boolean(rows[0]?.is_homeroom),
    assignmentId: rows[0]?.assignment_id
      ? Number(rows[0].assignment_id)
      : null,
  };
}

export async function saveAttendanceRecords(
  session: AttendanceSession,
  input: AttendanceBulkInput,
  actorUserId: number,
) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const studentIds = input.records.map((record) => record.student_user_id);
    const [eligibleRows] = await connection.query<Array<{ total: number }>>(
      `
        SELECT COUNT(DISTINCT enrollment.student_user_id)::INTEGER AS total
        FROM student_enrollments enrollment
        WHERE enrollment.classroom_id = ?
          AND enrollment.enrolled_at <= ?::date
          AND (
            enrollment.ended_at IS NULL
            OR enrollment.ended_at >= ?::date
          )
          AND enrollment.student_user_id = ANY(?::bigint[])
      `,
      [
        session.classroom_id,
        session.session_date,
        session.session_date,
        studentIds,
      ],
    );
    if (Number(eligibleRows[0]?.total ?? 0) !== studentIds.length) {
      throw new Error('ATTENDANCE_STUDENT_SCOPE');
    }

    for (const record of input.records) {
      const [oldRows] = await connection.query<
        Array<{
          id: number;
          status: AttendanceRecord['status'];
          note: string | null;
        }>
      >(
        `
          SELECT id, status, note
          FROM attendance_records
          WHERE session_id = ? AND student_user_id = ?
          FOR UPDATE
        `,
        [session.id, record.student_user_id],
      );
      const old = oldRows[0];
      const note = record.note ?? null;
      if (old && old.status === record.status && old.note === note) continue;

      let recordId: number;
      if (old) {
        await connection.query(
          `
            UPDATE attendance_records
            SET status = ?, note = ?, recorded_by_user_id = ?
            WHERE id = ?
          `,
          [record.status, note, actorUserId, old.id],
        );
        recordId = Number(old.id);
      } else {
        const [created] = await connection.query<DatabaseResult>(
          `
            INSERT INTO attendance_records (
              session_id, student_user_id, status, note, recorded_by_user_id
            )
            VALUES (?, ?, ?, ?, ?)
            RETURNING id
          `,
          [
            session.id,
            record.student_user_id,
            record.status,
            note,
            actorUserId,
          ],
        );
        recordId = created.insertId;
      }
      await connection.query(
        `
          INSERT INTO attendance_record_audits (
            attendance_record_id, session_id, student_user_id, actor_user_id,
            old_status, new_status, old_note, new_note, reason
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          recordId,
          session.id,
          record.student_user_id,
          actorUserId,
          old?.status ?? null,
          record.status,
          old?.note ?? null,
          note,
          input.correction_reason ?? null,
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
  return findAttendanceSessionDetail(session.id);
}

export async function findAttendanceAudits(sessionId: number) {
  const [rows] = await databasePool.query<
    Array<
      DatabaseRow & {
        id: number;
        student_user_id: number;
        student_name: string;
        actor_user_id: number | null;
        actor_name: string | null;
      }
    >
  >(
    `
      SELECT audit.*, student.full_name AS student_name,
        actor.full_name AS actor_name
      FROM attendance_record_audits audit
      JOIN users student ON student.id = audit.student_user_id
      LEFT JOIN users actor ON actor.id = audit.actor_user_id
      WHERE audit.session_id = ?
      ORDER BY audit.changed_at DESC, audit.id DESC
    `,
    [sessionId],
  );
  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    student_user_id: Number(row.student_user_id),
    actor_user_id:
      row.actor_user_id === null ? null : Number(row.actor_user_id),
  }));
}

function mapSummary(row: Record<string, unknown>): AttendanceSummary {
  const total = Number(row.total ?? 0);
  const present = Number(row.present ?? 0);
  const late = Number(row.late ?? 0);
  return {
    total,
    present,
    excused: Number(row.excused ?? 0),
    unexcused: Number(row.unexcused ?? 0),
    late,
    attendance_rate:
      total === 0 ? 0 : Math.round(((present + late) / total) * 1000) / 10,
  };
}

export async function findStudentAttendance(
  studentUserId: number,
  filters: { semesterId?: number; from?: string; to?: string } = {},
) {
  const params: Array<number | string> = [studentUserId];
  const where: string[] = [];
  if (filters.semesterId) {
    where.push('session.semester_id = ?');
    params.push(filters.semesterId);
  }
  if (filters.from) {
    where.push('session.session_date >= ?::date');
    params.push(filters.from);
  }
  if (filters.to) {
    where.push('session.session_date <= ?::date');
    params.push(filters.to);
  }
  const filterSql = where.length ? `AND ${where.join(' AND ')}` : '';
  const [records] = await databasePool.query<
    Array<
      DatabaseRow & {
        id: number;
        session_id: number;
        classroom_id: number;
        lesson_index: number;
      }
    >
  >(
    `
      SELECT record.*, session.session_date, session.lesson_index,
        session.classroom_id, classroom.name AS classroom_name,
        semester.name AS semester_name, subject.name AS subject_name
      FROM attendance_records record
      JOIN attendance_sessions session ON session.id = record.session_id
      JOIN classrooms classroom ON classroom.id = session.classroom_id
      JOIN semesters semester ON semester.id = session.semester_id
      LEFT JOIN subjects subject ON subject.id = session.subject_id
      WHERE record.student_user_id = ?
        ${filterSql}
      ORDER BY session.session_date DESC, session.lesson_index ASC
    `,
    params,
  );
  const [summaryRows] = await databasePool.query<Array<Record<string, unknown>>>(
    `
      SELECT COUNT(*) AS total,
        COUNT(*) FILTER (WHERE record.status = 'present') AS present,
        COUNT(*) FILTER (WHERE record.status = 'excused') AS excused,
        COUNT(*) FILTER (WHERE record.status = 'unexcused') AS unexcused,
        COUNT(*) FILTER (WHERE record.status = 'late') AS late
      FROM attendance_records record
      JOIN attendance_sessions session ON session.id = record.session_id
      WHERE record.student_user_id = ?
        ${filterSql}
    `,
    params,
  );
  return {
    data: records.map((row) => ({
      ...row,
      id: Number(row.id),
      session_id: Number(row.session_id),
      classroom_id: Number(row.classroom_id),
      lesson_index: Number(row.lesson_index),
      session_date: dateValue(row.session_date),
    })),
    summary: mapSummary(summaryRows[0] ?? {}),
  };
}

export async function findClassroomAttendanceSummary(
  classroomId: number,
  filters: { semesterId?: number; from?: string; to?: string } = {},
) {
  const params: Array<number | string> = [classroomId];
  const where: string[] = [];
  if (filters.semesterId) {
    where.push('session.semester_id = ?');
    params.push(filters.semesterId);
  }
  if (filters.from) {
    where.push('session.session_date >= ?::date');
    params.push(filters.from);
  }
  if (filters.to) {
    where.push('session.session_date <= ?::date');
    params.push(filters.to);
  }
  const filterSql = where.length ? `AND ${where.join(' AND ')}` : '';
  const [rows] = await databasePool.query<
    Array<Record<string, unknown> & { student_user_id: number }>
  >(
    `
      SELECT record.student_user_id, student.full_name AS student_name,
        profile.student_code,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE record.status = 'present') AS present,
        COUNT(*) FILTER (WHERE record.status = 'excused') AS excused,
        COUNT(*) FILTER (WHERE record.status = 'unexcused') AS unexcused,
        COUNT(*) FILTER (WHERE record.status = 'late') AS late
      FROM attendance_records record
      JOIN attendance_sessions session ON session.id = record.session_id
      JOIN users student ON student.id = record.student_user_id
      LEFT JOIN student_profiles profile ON profile.user_id = student.id
      WHERE session.classroom_id = ?
        ${filterSql}
      GROUP BY record.student_user_id, student.full_name, profile.student_code
      ORDER BY student.full_name
    `,
    params,
  );
  return rows.map((row) => ({
    student_user_id: Number(row.student_user_id),
    student_name: String(row.student_name),
    student_code: row.student_code ? String(row.student_code) : null,
    ...mapSummary(row),
  }));
}
