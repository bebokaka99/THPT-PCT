import type { DatabaseConnection, DatabaseResult, DatabaseRow } from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  CommunicationOption,
  CreateNotificationInput,
  ListMyNotificationsQuery,
  ListNotificationsQuery,
  Notification,
  NotificationReport,
  NotificationTargetRole,
  UserNotification,
} from './notification.types.js';

type NotificationRow = DatabaseRow & Notification;
type UserNotificationRow = DatabaseRow & UserNotification;
type CountRow = DatabaseRow & { total: number };
type UserIdRow = DatabaseRow & { id: number };

function mapNotification(row: NotificationRow): Notification {
  return {
    ...row,
    id: Number(row.id),
    classroom_id: row.classroom_id === null ? null : Number(row.classroom_id),
    grade_level: row.grade_level === null ? null : Number(row.grade_level),
    created_by_user_id: row.created_by_user_id === null ? null : Number(row.created_by_user_id),
    requires_acknowledgement: Boolean(row.requires_acknowledgement),
  };
}

function mapUserNotification(row: UserNotificationRow): UserNotification {
  return {
    ...mapNotification(row),
    user_notification_id: Number(row.user_notification_id),
    delivered_at: row.delivered_at,
    read_at: row.read_at,
    acknowledged_at: row.acknowledged_at,
  };
}

export async function findRecipientUserIds(targetRole: string) {
  const params: string[] = [];
  const roleSql = targetRole === 'all'
    ? ''
    : 'AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.name = ?)';
  if (targetRole !== 'all') params.push(targetRole);
  const [rows] = await databasePool.query<UserIdRow[]>(
    `SELECT u.id FROM users u WHERE u.status = 'active' ${roleSql}`,
    params,
  );
  return rows.map((row) => Number(row.id));
}

export async function findScopedRecipientUserIds(input: CreateNotificationInput) {
  const scope = input.target_scope ?? 'role';
  if (scope === 'school' || scope === 'role') return findRecipientUserIds(input.target_role);
  if (scope === 'users') {
    const ids = input.user_ids ?? [];
    if (!ids.length) return [];
    const [rows] = await databasePool.query<UserIdRow[]>(
      `SELECT DISTINCT u.id FROM users u
       WHERE u.status = 'active' AND u.id = ANY(?::bigint[])
         AND (? = 'all' OR EXISTS (
           SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.id AND r.name = ?
         ))`,
      [ids, input.target_role, input.target_role],
    );
    return rows.map((row) => Number(row.id));
  }

  const classroomClause = scope === 'classroom' ? 'classroom.id = ?' : 'classroom.grade_level = ?';
  const scopeValue = scope === 'classroom' ? input.classroom_id : input.grade_level;
  const queries: Array<Promise<number[]>> = [];
  if (input.target_role === 'all' || input.target_role === 'student') {
    queries.push((async () => {
      const [rows] = await databasePool.query<UserIdRow[]>(
        `SELECT DISTINCT account.id
         FROM classrooms classroom
         JOIN student_enrollments enrollment ON enrollment.classroom_id = classroom.id AND enrollment.status = 'active'
         JOIN users account ON account.id = enrollment.student_user_id AND account.status = 'active'
         WHERE ${classroomClause}`,
        [scopeValue],
      );
      return rows.map((row) => Number(row.id));
    })());
  }
  if (input.target_role === 'all' || input.target_role === 'guardian') {
    queries.push((async () => {
      const [rows] = await databasePool.query<UserIdRow[]>(
        `SELECT DISTINCT guardian.id
         FROM classrooms classroom
         JOIN student_enrollments enrollment ON enrollment.classroom_id = classroom.id AND enrollment.status = 'active'
         JOIN student_guardian_links link ON link.student_user_id = enrollment.student_user_id AND link.status = 'verified'
         JOIN users guardian ON guardian.id = link.guardian_user_id AND guardian.status = 'active'
         LEFT JOIN guardian_notification_preferences preference ON preference.guardian_user_id = guardian.id
         WHERE ${classroomClause} AND COALESCE(preference.in_app_enabled, TRUE) = TRUE`,
        [scopeValue],
      );
      return rows.map((row) => Number(row.id));
    })());
  }
  if (input.target_role === 'all' || input.target_role === 'teacher') {
    queries.push((async () => {
      const [rows] = await databasePool.query<UserIdRow[]>(
        `SELECT DISTINCT teacher.id
         FROM classrooms classroom
         JOIN users teacher ON teacher.status = 'active'
         WHERE ${classroomClause}
           AND (classroom.homeroom_teacher_user_id = teacher.id OR EXISTS (
             SELECT 1 FROM teaching_assignments assignment
             WHERE assignment.classroom_id = classroom.id
               AND assignment.teacher_user_id = teacher.id
               AND assignment.status = 'active'
           ))`,
        [scopeValue],
      );
      return rows.map((row) => Number(row.id));
    })());
  }
  return [...new Set((await Promise.all(queries)).flat())];
}

export async function canTeacherSendToClassroom(userId: number, classroomId: number) {
  const [rows] = await databasePool.query<CountRow[]>(
    `SELECT COUNT(*)::integer AS total
     FROM classrooms classroom
     WHERE classroom.id = ? AND classroom.is_active = TRUE
       AND (classroom.homeroom_teacher_user_id = ? OR EXISTS (
         SELECT 1 FROM teaching_assignments assignment
         WHERE assignment.classroom_id = classroom.id
           AND assignment.teacher_user_id = ? AND assignment.status = 'active'
       ) OR EXISTS (
         SELECT 1 FROM classroom_members member
         WHERE member.classroom_id = classroom.id AND member.user_id = ? AND member.role = 'teacher'
       ))`,
    [classroomId, userId, userId, userId],
  );
  return Number(rows[0]?.total ?? 0) > 0;
}

export async function findCommunicationClassroomOptions(userId: number, admin: boolean) {
  const params: number[] = [];
  const where = admin
    ? 'classroom.is_active = TRUE'
    : `classroom.is_active = TRUE AND (
        classroom.homeroom_teacher_user_id = ? OR EXISTS (
          SELECT 1 FROM teaching_assignments assignment
          WHERE assignment.classroom_id = classroom.id
            AND assignment.teacher_user_id = ? AND assignment.status = 'active'
        ) OR EXISTS (
          SELECT 1 FROM classroom_members member
          WHERE member.classroom_id = classroom.id AND member.user_id = ? AND member.role = 'teacher'
        )
      )`;
  if (!admin) params.push(userId, userId, userId);
  const [rows] = await databasePool.query<Array<DatabaseRow & CommunicationOption>>(
    `SELECT classroom.id, classroom.name, classroom.school_year, classroom.grade_level
     FROM classrooms classroom WHERE ${where}
     ORDER BY classroom.school_year DESC, classroom.grade_level, classroom.name`,
    params,
  );
  return rows.map((row) => ({
    id: Number(row.id), name: row.name, school_year: row.school_year,
    grade_level: row.grade_level === null ? null : Number(row.grade_level),
  }));
}

export async function findActiveUserOptions() {
  const [rows] = await databasePool.query<Array<DatabaseRow & { id: number; full_name: string; email: string | null; role: string | null }>>(
    `SELECT account.id, account.full_name, account.email, MIN(role.name) AS role
     FROM users account
     LEFT JOIN user_roles user_role ON user_role.user_id = account.id
     LEFT JOIN roles role ON role.id = user_role.role_id
     WHERE account.status = 'active'
     GROUP BY account.id, account.full_name, account.email
     ORDER BY account.full_name LIMIT 500`,
  );
  return rows.map((row) => ({ ...row, id: Number(row.id) }));
}

export async function findClassroomStudentUserIds(classroomId: number) {
  const [rows] = await databasePool.query<UserIdRow[]>(
    `SELECT DISTINCT u.id FROM student_enrollments enrollment
     JOIN users u ON u.id = enrollment.student_user_id
     WHERE enrollment.classroom_id = ? AND enrollment.status = 'active' AND u.status = 'active'`,
    [classroomId],
  );
  return rows.map((row) => Number(row.id));
}

export async function findClassroomStudentUserIdsAtDate(classroomId: number, effectiveDate: Date) {
  const [rows] = await databasePool.query<UserIdRow[]>(
    `SELECT DISTINCT u.id FROM student_enrollments enrollment
     JOIN users u ON u.id = enrollment.student_user_id
     WHERE enrollment.classroom_id = ? AND enrollment.enrolled_at <= ?::date
       AND (enrollment.ended_at IS NULL OR enrollment.ended_at >= ?::date) AND u.status = 'active'`,
    [classroomId, effectiveDate, effectiveDate],
  );
  return rows.map((row) => Number(row.id));
}

export async function findClassroomGuardianUserIdsAtDate(classroomId: number, effectiveDate: Date) {
  const [rows] = await databasePool.query<UserIdRow[]>(
    `SELECT DISTINCT guardian.id FROM student_enrollments enrollment
     JOIN student_guardian_links link ON link.student_user_id = enrollment.student_user_id AND link.status = 'verified'
     JOIN users guardian ON guardian.id = link.guardian_user_id
     LEFT JOIN guardian_notification_preferences preference ON preference.guardian_user_id = guardian.id
     WHERE enrollment.classroom_id = ? AND enrollment.enrolled_at <= ?::date
       AND (enrollment.ended_at IS NULL OR enrollment.ended_at >= ?::date)
       AND guardian.status = 'active' AND COALESCE(preference.in_app_enabled, TRUE) = TRUE`,
    [classroomId, effectiveDate, effectiveDate],
  );
  return rows.map((row) => Number(row.id));
}

export async function createNotificationRecord(input: CreateNotificationInput, createdByUserId: number | null, recipientUserIds: number[]) {
  if (input.idempotency_key) {
    const existing = await findNotificationByIdempotencyKey(input.idempotency_key);
    if (existing) return existing;
  }
  const connection: DatabaseConnection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query<DatabaseResult>(
      `INSERT INTO notifications (
         title, message, type, target_role, target_scope, priority, classroom_id,
         grade_level, created_by_user_id, related_url, requires_acknowledgement,
         idempotency_key, expires_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [input.title, input.message, input.type, input.target_role, input.target_scope ?? 'role',
        input.priority ?? 'normal', input.classroom_id ?? null, input.grade_level ?? null,
        createdByUserId, input.related_url ?? null, input.requires_acknowledgement ?? false,
        input.idempotency_key ?? null, input.expires_at ?? null],
    );
    const notificationId = result.insertId;
    const uniqueRecipients = [...new Set(recipientUserIds)];
    if (uniqueRecipients.length > 0) {
      await connection.query(
        `INSERT INTO user_notifications (notification_id, user_id)
         VALUES ${uniqueRecipients.map(() => '(?, ?)').join(', ')}
         ON CONFLICT (notification_id, user_id) DO NOTHING`,
        uniqueRecipients.flatMap((userId) => [notificationId, userId]),
      );
    }
    await connection.query(
      `INSERT INTO notification_audit_logs (notification_id, actor_user_id, action, details)
       VALUES (?, ?, 'create', ?::jsonb)`,
      [notificationId, createdByUserId, JSON.stringify({ recipients: uniqueRecipients.length })],
    );
    await connection.commit();
    return findNotificationById(notificationId);
  } catch (error) {
    await connection.rollback();
    if (input.idempotency_key) {
      const existing = await findNotificationByIdempotencyKey(input.idempotency_key);
      if (existing) return existing;
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function findNotificationById(id: number) {
  const [rows] = await databasePool.query<NotificationRow[]>('SELECT * FROM notifications WHERE id = ? LIMIT 1', [id]);
  return rows[0] ? mapNotification(rows[0]) : null;
}

export async function findNotificationByIdempotencyKey(key: string) {
  const [rows] = await databasePool.query<NotificationRow[]>('SELECT * FROM notifications WHERE idempotency_key = ? LIMIT 1', [key]);
  return rows[0] ? mapNotification(rows[0]) : null;
}

export async function findMyNotifications(userId: number, query: ListMyNotificationsQuery) {
  const where = ['un.user_id = ?', '(n.expires_at IS NULL OR n.expires_at > NOW())'];
  const params: Array<number | string> = [userId];
  if (query.unread) where.push('un.read_at IS NULL');
  if (query.unacknowledged) where.push('n.requires_acknowledgement = TRUE AND un.acknowledged_at IS NULL');
  const offset = (query.page - 1) * query.limit;
  const whereSql = where.join(' AND ');
  const [rows] = await databasePool.query<UserNotificationRow[]>(
    `SELECT n.*, un.id AS user_notification_id, un.delivered_at, un.read_at, un.acknowledged_at
     FROM user_notifications un JOIN notifications n ON n.id = un.notification_id
     WHERE ${whereSql}
     ORDER BY (un.read_at IS NULL) DESC,
       CASE n.priority WHEN 'urgent' THEN 1 WHEN 'important' THEN 2 ELSE 3 END,
       un.created_at DESC, un.id DESC LIMIT ? OFFSET ?`,
    [...params, query.limit, offset],
  );
  const [countRows] = await databasePool.query<CountRow[]>(
    `SELECT COUNT(*) AS total FROM user_notifications un JOIN notifications n ON n.id = un.notification_id WHERE ${whereSql}`,
    params,
  );
  return { data: rows.map(mapUserNotification), total: Number(countRows[0]?.total ?? 0) };
}

export async function countUnreadNotifications(userId: number) {
  const [rows] = await databasePool.query<CountRow[]>(
    `SELECT COUNT(*) AS total FROM user_notifications un JOIN notifications n ON n.id = un.notification_id
     WHERE un.user_id = ? AND un.read_at IS NULL AND (n.expires_at IS NULL OR n.expires_at > NOW())`,
    [userId],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function markUserNotificationRead(userId: number, notificationId: number) {
  const [result] = await databasePool.query<DatabaseResult>(
    'UPDATE user_notifications SET read_at = COALESCE(read_at, NOW()) WHERE user_id = ? AND notification_id = ?',
    [userId, notificationId],
  );
  if (result.affectedRows > 0) {
    await databasePool.query(
      `INSERT INTO notification_audit_logs (notification_id, actor_user_id, action) VALUES (?, ?, 'read')`,
      [notificationId, userId],
    );
  }
  return result.affectedRows > 0;
}

export async function acknowledgeUserNotification(userId: number, notificationId: number) {
  const [result] = await databasePool.query<DatabaseResult>(
    `UPDATE user_notifications un SET read_at = COALESCE(un.read_at, NOW()), acknowledged_at = COALESCE(un.acknowledged_at, NOW())
     FROM notifications n
     WHERE un.notification_id = n.id AND un.user_id = ? AND un.notification_id = ? AND n.requires_acknowledgement = TRUE`,
    [userId, notificationId],
  );
  if (result.affectedRows > 0) {
    await databasePool.query(
      `INSERT INTO notification_audit_logs (notification_id, actor_user_id, action) VALUES (?, ?, 'acknowledge')`,
      [notificationId, userId],
    );
  }
  return result.affectedRows > 0;
}

export async function markAllUserNotificationsRead(userId: number) {
  await databasePool.query(
    'UPDATE user_notifications SET read_at = COALESCE(read_at, NOW()) WHERE user_id = ? AND read_at IS NULL',
    [userId],
  );
}

export async function findNotifications(query: ListNotificationsQuery, createdByUserId?: number) {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (createdByUserId) { where.push('created_by_user_id = ?'); params.push(createdByUserId); }
  if (query.q) { where.push('(title ILIKE ? OR message ILIKE ?)'); params.push(`%${query.q}%`, `%${query.q}%`); }
  if (query.type) { where.push('type = ?'); params.push(query.type); }
  if (query.target_role) { where.push('target_role = ?'); params.push(query.target_role); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (query.page - 1) * query.limit;
  const [rows] = await databasePool.query<NotificationRow[]>(
    `SELECT * FROM notifications ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, query.limit, offset],
  );
  const [countRows] = await databasePool.query<CountRow[]>(`SELECT COUNT(*) AS total FROM notifications ${whereSql}`, params);
  return { data: rows.map(mapNotification), total: Number(countRows[0]?.total ?? 0) };
}

export async function findNotificationReport(id: number): Promise<NotificationReport | null> {
  const notification = await findNotificationById(id);
  if (!notification) return null;
  const [rows] = await databasePool.query<Array<DatabaseRow & NotificationReport['recipient_statuses'][number]>>(
    `SELECT un.user_id, account.full_name, MIN(role.name) AS role,
       un.delivered_at, un.read_at, un.acknowledged_at
     FROM user_notifications un
     JOIN users account ON account.id = un.user_id
     LEFT JOIN user_roles user_role ON user_role.user_id = account.id
     LEFT JOIN roles role ON role.id = user_role.role_id
     WHERE un.notification_id = ?
     GROUP BY un.user_id, account.full_name, un.delivered_at, un.read_at, un.acknowledged_at
     ORDER BY account.full_name`,
    [id],
  );
  const statuses = rows.map((row) => ({ ...row, user_id: Number(row.user_id) }));
  const recipients = statuses.length;
  const read = statuses.filter((row) => row.read_at).length;
  const acknowledged = statuses.filter((row) => row.acknowledged_at).length;
  return {
    notification_id: id, recipients, delivered: recipients, read, acknowledged,
    read_rate: recipients ? Math.round((read / recipients) * 10000) / 100 : 0,
    acknowledgement_rate: recipients ? Math.round((acknowledged / recipients) * 10000) / 100 : 0,
    recipient_statuses: statuses,
  };
}

export async function isNotificationAuthor(id: number, userId: number) {
  const [rows] = await databasePool.query<CountRow[]>(
    'SELECT COUNT(*)::integer AS total FROM notifications WHERE id = ? AND created_by_user_id = ?',
    [id, userId],
  );
  return Number(rows[0]?.total ?? 0) > 0;
}

export async function deleteNotificationRecord(id: number, actorUserId: number) {
  await databasePool.query(
    `INSERT INTO notification_audit_logs (notification_id, actor_user_id, action)
     SELECT id, ?, 'delete' FROM notifications WHERE id = ?`,
    [actorUserId, id],
  );
  const [result] = await databasePool.query<DatabaseResult>('DELETE FROM notifications WHERE id = ?', [id]);
  return result.affectedRows > 0;
}
