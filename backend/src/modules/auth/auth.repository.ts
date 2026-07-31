import type {
  DatabaseResult,
  DatabaseRow,
} from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  AuthUserRecord,
  RefreshSessionRecord,
} from './auth.types.js';

type AuthUserRow = DatabaseRow & {
  id: number;
  username: string | null;
  email: string | null;
  fullName: string;
  passwordHash: string;
  status: string;
  roles: string | null;
  permissions: string | null;
};

function splitList(value: string | null) {
  return value ? value.split(',').filter(Boolean) : [];
}

function mapAuthUser(row: AuthUserRow): AuthUserRecord {
  return {
    id: Number(row.id),
    username: row.username,
    email: row.email,
    fullName: row.fullName,
    passwordHash: row.passwordHash,
    status: row.status,
    roles: splitList(row.roles),
    permissions: splitList(row.permissions),
  };
}

const authUserSelect = `
  SELECT
    u.id,
    u.username,
    u.email,
    u.full_name AS "fullName",
    u.password_hash AS "passwordHash",
    u.status,
    STRING_AGG(DISTINCT r.name, ',' ORDER BY r.name) AS roles,
    STRING_AGG(DISTINCT p.name, ',' ORDER BY p.name) AS permissions
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN roles r ON r.id = ur.role_id
  LEFT JOIN role_permissions rp ON rp.role_id = r.id
  LEFT JOIN permissions p ON p.id = rp.permission_id
`;

async function findAuthUserByWhere(whereSql: string, value: number | string) {
  const [rows] = await databasePool.query<AuthUserRow[]>(
    `
      ${authUserSelect}
      WHERE ${whereSql}
      GROUP BY u.id, u.username, u.email, u.full_name, u.password_hash, u.status
      LIMIT 1
    `,
    [value],
  );

  const row = rows[0];
  return row ? mapAuthUser(row) : null;
}

export function findAuthUserByEmail(email: string) {
  return findAuthUserByWhere('u.email = ?', email);
}

export function findAuthUserByUsername(username: string) {
  return findAuthUserByWhere('u.username = ?', username);
}

export async function findAuthUserByIdentifier(identifier: string) {
  return (
    (await findAuthUserByEmail(identifier.toLowerCase())) ??
    (await findAuthUserByUsername(identifier.toLowerCase()))
  );
}

export function findAuthUserById(id: number) {
  return findAuthUserByWhere('u.id = ?', id);
}

export async function createRefreshSession(
  userId: number,
  tokenHash: string,
  expiresAt: Date,
) {
  await databasePool.query(
    `
      INSERT INTO auth_refresh_sessions (user_id, token_hash, expires_at)
      VALUES (?, ?, ?)
    `,
    [userId, tokenHash, expiresAt],
  );
}

export async function findActiveRefreshSession(tokenHash: string) {
  const [rows] = await databasePool.query<
    Array<DatabaseRow & { userId: number }>
  >(
    `
      SELECT user_id AS "userId"
      FROM auth_refresh_sessions
      WHERE token_hash = ?
        AND revoked_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP
      LIMIT 1
    `,
    [tokenHash],
  );

  const row = rows[0];
  return row
    ? ({ userId: Number(row.userId) } satisfies RefreshSessionRecord)
    : null;
}

export async function rotateRefreshSession(input: {
  userId: number;
  currentTokenHash: string;
  nextTokenHash: string;
  nextExpiresAt: Date;
}) {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();
    const [result] = await connection.query<DatabaseResult>(
      `
        UPDATE auth_refresh_sessions
        SET revoked_at = CURRENT_TIMESTAMP,
            last_used_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
          AND token_hash = ?
          AND revoked_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
      `,
      [input.userId, input.currentTokenHash],
    );

    if (result.affectedRows !== 1) {
      await connection.rollback();
      return false;
    }

    await connection.query(
      `
        INSERT INTO auth_refresh_sessions (user_id, token_hash, expires_at)
        VALUES (?, ?, ?)
      `,
      [input.userId, input.nextTokenHash, input.nextExpiresAt],
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function revokeRefreshSession(tokenHash: string) {
  await databasePool.query(
    `
      UPDATE auth_refresh_sessions
      SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
      WHERE token_hash = ?
    `,
    [tokenHash],
  );
}

export async function revokeRefreshSessionsForUser(userId: number) {
  await databasePool.query(
    `
      UPDATE auth_refresh_sessions
      SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
      WHERE user_id = ?
        AND revoked_at IS NULL
    `,
    [userId],
  );
}

