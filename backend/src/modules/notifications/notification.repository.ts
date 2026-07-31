import type { DatabaseConnection, DatabaseResult, DatabaseRow } from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type { CreateNotificationInput, ListMyNotificationsQuery, ListNotificationsQuery, Notification, UserNotification } from './notification.types.js';

type NotificationRow = DatabaseRow & Notification;
type UserNotificationRow = DatabaseRow & UserNotification;
type CountRow = DatabaseRow & { total: number };
type UserIdRow = DatabaseRow & { id: number };

function mapNotification(row: NotificationRow): Notification {
  return {
    ...row,
    id: Number(row.id),
    classroom_id: row.classroom_id === null ? null : Number(row.classroom_id),
    created_by_user_id: row.created_by_user_id === null ? null : Number(row.created_by_user_id),
  };
}

function mapUserNotification(row: UserNotificationRow): UserNotification {
  return {
    ...mapNotification(row),
    user_notification_id: Number(row.user_notification_id),
    read_at: row.read_at,
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

export async function findClassroomStudentUserIds(classroomId: number) {
  const [rows] = await databasePool.query<UserIdRow[]>(
    `
      SELECT DISTINCT u.id
      FROM student_enrollments enrollment
      JOIN users u ON u.id = enrollment.student_user_id
      WHERE enrollment.classroom_id = ?
        AND enrollment.status = 'active'
        AND u.status = 'active'
    `,
    [classroomId],
  );
  return rows.map((row) => Number(row.id));
}

export async function findClassroomStudentUserIdsAtDate(
  classroomId: number,
  effectiveDate: Date,
) {
  const [rows] = await databasePool.query<UserIdRow[]>(
    `
      SELECT DISTINCT u.id
      FROM student_enrollments enrollment
      JOIN users u ON u.id = enrollment.student_user_id
      WHERE enrollment.classroom_id = ?
        AND enrollment.enrolled_at <= ?::date
        AND (enrollment.ended_at IS NULL OR enrollment.ended_at >= ?::date)
        AND u.status = 'active'
    `,
    [classroomId, effectiveDate, effectiveDate],
  );
  return rows.map((row) => Number(row.id));
}

export async function findClassroomGuardianUserIdsAtDate(
  classroomId: number,
  effectiveDate: Date,
) {
  const [rows] = await databasePool.query<UserIdRow[]>(
    `SELECT DISTINCT guardian.id
     FROM student_enrollments enrollment
     JOIN student_guardian_links link
       ON link.student_user_id = enrollment.student_user_id
      AND link.status = 'verified'
     JOIN users guardian ON guardian.id = link.guardian_user_id
     LEFT JOIN guardian_notification_preferences preference
       ON preference.guardian_user_id = guardian.id
     WHERE enrollment.classroom_id = ?
       AND enrollment.enrolled_at <= ?::date
       AND (enrollment.ended_at IS NULL OR enrollment.ended_at >= ?::date)
       AND guardian.status = 'active'
       AND COALESCE(preference.in_app_enabled, TRUE) = TRUE`,
    [classroomId, effectiveDate, effectiveDate],
  );
  return rows.map((row) => Number(row.id));
}

export async function createNotificationRecord(input: CreateNotificationInput, createdByUserId: number | null, recipientUserIds: number[]) {
  const connection: DatabaseConnection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();
    const [result] = await connection.query<DatabaseResult>(
      `
        INSERT INTO notifications (title, message, type, target_role, classroom_id, created_by_user_id, related_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `,
      [input.title, input.message, input.type, input.target_role, input.classroom_id ?? null, createdByUserId, input.related_url ?? null],
    );
    const notificationId = result.insertId;

    if (recipientUserIds.length > 0) {
      await connection.query(
        `
          INSERT INTO user_notifications (notification_id, user_id)
          VALUES ${recipientUserIds.map(() => '(?, ?)').join(', ')}
          ON CONFLICT (notification_id, user_id) DO NOTHING
        `,
        recipientUserIds.flatMap((userId) => [notificationId, userId]),
      );
    }

    await connection.commit();
    return findNotificationById(notificationId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function findNotificationById(id: number) {
  const [rows] = await databasePool.query<NotificationRow[]>('SELECT * FROM notifications WHERE id = ? LIMIT 1', [id]);
  return rows[0] ? mapNotification(rows[0]) : null;
}

export async function findMyNotifications(userId: number, query: ListMyNotificationsQuery) {
  const where = ['un.user_id = ?'];
  const params: Array<number | string> = [userId];
  if (query.unread) where.push('un.read_at IS NULL');
  const offset = (query.page - 1) * query.limit;
  const whereSql = where.join(' AND ');
  const [rows] = await databasePool.query<UserNotificationRow[]>(
    `
      SELECT n.*, un.id AS user_notification_id, un.read_at
      FROM user_notifications un
      JOIN notifications n ON n.id = un.notification_id
      WHERE ${whereSql}
      ORDER BY un.created_at DESC, un.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, query.limit, offset],
  );
  const [countRows] = await databasePool.query<CountRow[]>(
    `SELECT COUNT(*) AS total FROM user_notifications un WHERE ${whereSql}`,
    params,
  );
  return { data: rows.map(mapUserNotification), total: Number(countRows[0]?.total ?? 0) };
}

export async function countUnreadNotifications(userId: number) {
  const [rows] = await databasePool.query<CountRow[]>(
    'SELECT COUNT(*) AS total FROM user_notifications WHERE user_id = ? AND read_at IS NULL',
    [userId],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function markUserNotificationRead(userId: number, notificationId: number) {
  const [result] = await databasePool.query<DatabaseResult>(
    'UPDATE user_notifications SET read_at = COALESCE(read_at, NOW()) WHERE user_id = ? AND notification_id = ?',
    [userId, notificationId],
  );
  return result.affectedRows > 0;
}

export async function markAllUserNotificationsRead(userId: number) {
  await databasePool.query(
    'UPDATE user_notifications SET read_at = COALESCE(read_at, NOW()) WHERE user_id = ? AND read_at IS NULL',
    [userId],
  );
}

export async function findNotifications(query: ListNotificationsQuery) {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (query.q) {
    where.push('(title ILIKE ? OR message ILIKE ?)');
    params.push(`%${query.q}%`, `%${query.q}%`);
  }
  if (query.type) {
    where.push('type = ?');
    params.push(query.type);
  }
  if (query.target_role) {
    where.push('target_role = ?');
    params.push(query.target_role);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (query.page - 1) * query.limit;
  const [rows] = await databasePool.query<NotificationRow[]>(
    `SELECT * FROM notifications ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, query.limit, offset],
  );
  const [countRows] = await databasePool.query<CountRow[]>(`SELECT COUNT(*) AS total FROM notifications ${whereSql}`, params);
  return { data: rows.map(mapNotification), total: Number(countRows[0]?.total ?? 0) };
}

export async function deleteNotificationRecord(id: number) {
  const [result] = await databasePool.query<DatabaseResult>('DELETE FROM notifications WHERE id = ?', [id]);
  return result.affectedRows > 0;
}


