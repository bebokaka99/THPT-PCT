import type {
  DatabaseConnection,
  DatabaseResult,
  DatabaseRow,
} from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  GuardianChild,
  GuardianInviteInput,
  GuardianLink,
  GuardianLinkQuery,
  GuardianLinkStatus,
  GuardianPreferences,
  GuardianPreferencesInput,
} from './guardian.types.js';

type Row = DatabaseRow & Record<string, any>;

const linkSelect = `
  SELECT link.*,
    guardian.full_name AS guardian_name,
    guardian.email AS guardian_email,
    student.full_name AS student_name,
    profile.student_code
  FROM student_guardian_links link
  JOIN users guardian ON guardian.id = link.guardian_user_id
  JOIN users student ON student.id = link.student_user_id
  LEFT JOIN student_profiles profile ON profile.user_id = student.id
`;

function mapLink(row: Row): GuardianLink {
  return {
    id: Number(row.id),
    guardian_user_id: Number(row.guardian_user_id),
    guardian_name: String(row.guardian_name),
    guardian_email: row.guardian_email ? String(row.guardian_email) : null,
    student_user_id: Number(row.student_user_id),
    student_name: String(row.student_name),
    student_code: row.student_code ? String(row.student_code) : null,
    relationship: String(row.relationship),
    status: row.status,
    revision: Number(row.revision),
    invited_at: row.invited_at,
    verified_at: row.verified_at,
    revoked_at: row.revoked_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function findGuardianLinks(query: GuardianLinkQuery) {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (query.status) {
    where.push('link.status = ?::guardian_link_status');
    params.push(query.status);
  }
  if (query.q) {
    where.push(`(
      guardian.full_name ILIKE ? OR guardian.email ILIKE ?
      OR student.full_name ILIKE ? OR profile.student_code ILIKE ?
    )`);
    const search = `%${query.q}%`;
    params.push(search, search, search, search);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (query.page - 1) * query.limit;
  const [rows] = await databasePool.query<Row[]>(
    `${linkSelect}
     ${whereSql}
     ORDER BY link.created_at DESC, link.id DESC
     LIMIT ? OFFSET ?`,
    [...params, query.limit, offset],
  );
  const [counts] = await databasePool.query<Array<{ total: number }>>(
    `SELECT COUNT(*) AS total
     FROM student_guardian_links link
     JOIN users guardian ON guardian.id = link.guardian_user_id
     JOIN users student ON student.id = link.student_user_id
     LEFT JOIN student_profiles profile ON profile.user_id = student.id
     ${whereSql}`,
    params,
  );
  return { data: rows.map(mapLink), total: Number(counts[0]?.total ?? 0) };
}

export async function findGuardianLinkById(id: number) {
  const [rows] = await databasePool.query<Row[]>(
    `${linkSelect} WHERE link.id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? mapLink(rows[0]) : null;
}

async function userHasRole(
  connection: DatabaseConnection,
  userId: number,
  role: string,
) {
  const [rows] = await connection.query<Row[]>(
    `SELECT 1
     FROM users user_account
     JOIN user_roles user_role ON user_role.user_id = user_account.id
     JOIN roles role ON role.id = user_role.role_id
     WHERE user_account.id = ? AND user_account.status = 'active'
       AND role.name = ?
     LIMIT 1`,
    [userId, role],
  );
  return Boolean(rows[0]);
}

async function insertLinkAudit(
  connection: DatabaseConnection,
  input: {
    linkId: number;
    actorUserId: number;
    action: 'invite' | 'verify' | 'revoke' | 'reinvite';
    oldStatus: GuardianLinkStatus | null;
    newStatus: GuardianLinkStatus;
    reason?: string | null;
    revision: number;
  },
) {
  await connection.query(
    `INSERT INTO guardian_link_audits (
       link_id, actor_user_id, action, old_status, new_status, reason, revision
     ) VALUES (?, ?, ?, ?::guardian_link_status, ?::guardian_link_status, ?, ?)`,
    [
      input.linkId,
      input.actorUserId,
      input.action,
      input.oldStatus,
      input.newStatus,
      input.reason ?? null,
      input.revision,
    ],
  );
}

export async function inviteGuardianLink(
  input: GuardianInviteInput,
  actorUserId: number,
) {
  const connection = await databasePool.getConnection();
  let linkId = 0;
  try {
    await connection.beginTransaction();
    if (!(await userHasRole(connection, input.guardian_user_id, 'guardian'))) {
      throw new Error('GUARDIAN_ROLE_REQUIRED');
    }
    if (!(await userHasRole(connection, input.student_user_id, 'student'))) {
      throw new Error('STUDENT_ROLE_REQUIRED');
    }
    const [existingRows] = await connection.query<Row[]>(
      `SELECT * FROM student_guardian_links
       WHERE guardian_user_id = ? AND student_user_id = ?
       FOR UPDATE`,
      [input.guardian_user_id, input.student_user_id],
    );
    const existing = existingRows[0];
    if (existing && existing.status !== 'revoked') {
      throw new Error('GUARDIAN_LINK_EXISTS');
    }
    if (existing) {
      linkId = Number(existing.id);
      const revision = Number(existing.revision) + 1;
      await connection.query(
        `UPDATE student_guardian_links
         SET relationship = ?, status = 'pending', revision = ?,
           invited_by_user_id = ?, invited_at = CURRENT_TIMESTAMP,
           verified_by_user_id = NULL, verified_at = NULL,
           revoked_by_user_id = NULL, revoked_at = NULL
         WHERE id = ?`,
        [input.relationship, revision, actorUserId, linkId],
      );
      await insertLinkAudit(connection, {
        linkId,
        actorUserId,
        action: 'reinvite',
        oldStatus: 'revoked',
        newStatus: 'pending',
        revision,
      });
    } else {
      const [created] = await connection.query<DatabaseResult>(
        `INSERT INTO student_guardian_links (
           guardian_user_id, student_user_id, relationship, invited_by_user_id
         ) VALUES (?, ?, ?, ?) RETURNING id`,
        [
          input.guardian_user_id,
          input.student_user_id,
          input.relationship,
          actorUserId,
        ],
      );
      linkId = created.insertId;
      await connection.query(
        `INSERT INTO guardian_profiles (user_id)
         VALUES (?) ON CONFLICT (user_id) DO NOTHING`,
        [input.guardian_user_id],
      );
      await connection.query(
        `INSERT INTO guardian_notification_preferences (guardian_user_id)
         VALUES (?) ON CONFLICT (guardian_user_id) DO NOTHING`,
        [input.guardian_user_id],
      );
      await insertLinkAudit(connection, {
        linkId,
        actorUserId,
        action: 'invite',
        oldStatus: null,
        newStatus: 'pending',
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
  return findGuardianLinkById(linkId);
}

export async function transitionGuardianLink(
  id: number,
  action: 'verify' | 'revoke',
  actorUserId: number,
  reason: string | null,
) {
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<Row[]>(
      'SELECT * FROM student_guardian_links WHERE id = ? FOR UPDATE',
      [id],
    );
    const current = rows[0];
    if (!current) throw new Error('GUARDIAN_LINK_NOT_FOUND');
    if (action === 'verify' && current.status !== 'pending') {
      throw new Error('GUARDIAN_LINK_STATE');
    }
    if (action === 'revoke' && current.status === 'revoked') {
      throw new Error('GUARDIAN_LINK_STATE');
    }
    const nextStatus: GuardianLinkStatus =
      action === 'verify' ? 'verified' : 'revoked';
    const revision = Number(current.revision) + 1;
    if (action === 'verify') {
      await connection.query(
        `UPDATE student_guardian_links
         SET status = 'verified', revision = ?,
           verified_by_user_id = ?, verified_at = CURRENT_TIMESTAMP,
           revoked_by_user_id = NULL, revoked_at = NULL
         WHERE id = ?`,
        [revision, actorUserId, id],
      );
    } else {
      await connection.query(
        `UPDATE student_guardian_links
         SET status = 'revoked', revision = ?,
           revoked_by_user_id = ?, revoked_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [revision, actorUserId, id],
      );
    }
    await insertLinkAudit(connection, {
      linkId: id,
      actorUserId,
      action,
      oldStatus: current.status,
      newStatus: nextStatus,
      reason,
      revision,
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findGuardianLinkById(id);
}

export async function findVerifiedGuardianChildren(
  guardianUserId: number,
): Promise<GuardianChild[]> {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT link.id AS link_id, link.student_user_id, link.relationship,
       student.full_name, profile.student_code,
       current_class.classroom_id, current_class.classroom_name,
       current_class.school_year
     FROM student_guardian_links link
     JOIN users student ON student.id = link.student_user_id
     LEFT JOIN student_profiles profile ON profile.user_id = student.id
     LEFT JOIN LATERAL (
       SELECT classroom.id AS classroom_id, classroom.name AS classroom_name,
         classroom.school_year
       FROM student_enrollments enrollment
       JOIN classrooms classroom ON classroom.id = enrollment.classroom_id
       WHERE enrollment.student_user_id = link.student_user_id
         AND enrollment.status = 'active'
       ORDER BY enrollment.enrolled_at DESC, enrollment.id DESC
       LIMIT 1
     ) current_class ON TRUE
     WHERE link.guardian_user_id = ? AND link.status = 'verified'
       AND student.status = 'active'
     ORDER BY student.full_name`,
    [guardianUserId],
  );
  return rows.map((row) => ({
    link_id: Number(row.link_id),
    student_user_id: Number(row.student_user_id),
    full_name: String(row.full_name),
    student_code: row.student_code ? String(row.student_code) : null,
    relationship: String(row.relationship),
    classroom_id: row.classroom_id === null ? null : Number(row.classroom_id),
    classroom_name: row.classroom_name ? String(row.classroom_name) : null,
    school_year: row.school_year ? String(row.school_year) : null,
  }));
}

export async function findVerifiedGuardianChild(
  guardianUserId: number,
  studentUserId: number,
) {
  const children = await findVerifiedGuardianChildren(guardianUserId);
  return children.find((item) => item.student_user_id === studentUserId) ?? null;
}

function mapPreferences(row: Row): GuardianPreferences {
  return {
    in_app_enabled: Boolean(row.in_app_enabled),
    attendance_enabled: Boolean(row.attendance_enabled),
    grades_enabled: Boolean(row.grades_enabled),
    conduct_enabled: Boolean(row.conduct_enabled),
    updated_at: row.updated_at,
  };
}

export async function findGuardianPreferences(guardianUserId: number) {
  await databasePool.query(
    `INSERT INTO guardian_notification_preferences (guardian_user_id)
     VALUES (?) ON CONFLICT (guardian_user_id) DO NOTHING`,
    [guardianUserId],
  );
  const [rows] = await databasePool.query<Row[]>(
    `SELECT * FROM guardian_notification_preferences
     WHERE guardian_user_id = ? LIMIT 1`,
    [guardianUserId],
  );
  return mapPreferences(rows[0]);
}

export async function updateGuardianPreferencesRecord(
  guardianUserId: number,
  input: GuardianPreferencesInput,
) {
  const current = await findGuardianPreferences(guardianUserId);
  await databasePool.query(
    `UPDATE guardian_notification_preferences
     SET in_app_enabled = ?, attendance_enabled = ?, grades_enabled = ?,
       conduct_enabled = ?, updated_at = CURRENT_TIMESTAMP
     WHERE guardian_user_id = ?`,
    [
      input.in_app_enabled ?? current.in_app_enabled,
      input.attendance_enabled ?? current.attendance_enabled,
      input.grades_enabled ?? current.grades_enabled,
      input.conduct_enabled ?? current.conduct_enabled,
      guardianUserId,
    ],
  );
  return findGuardianPreferences(guardianUserId);
}

export function insertGuardianAccessAudit(
  guardianUserId: number,
  studentUserId: number,
  semesterId?: number,
) {
  return databasePool.query(
    `INSERT INTO guardian_access_audits (
       guardian_user_id, student_user_id, resource, semester_id
     ) VALUES (?, ?, 'summary', ?)`,
    [guardianUserId, studentUserId, semesterId ?? null],
  );
}

export async function findGuardianLinkAudits(linkId: number) {
  const [rows] = await databasePool.query<Row[]>(
    `SELECT audit.*, actor.full_name AS actor_name
     FROM guardian_link_audits audit
     LEFT JOIN users actor ON actor.id = audit.actor_user_id
     WHERE audit.link_id = ?
     ORDER BY audit.created_at DESC, audit.id DESC`,
    [linkId],
  );
  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    link_id: Number(row.link_id),
    actor_user_id:
      row.actor_user_id === null ? null : Number(row.actor_user_id),
    revision: Number(row.revision),
  }));
}
