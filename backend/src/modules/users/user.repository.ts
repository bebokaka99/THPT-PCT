import type { DatabaseConnection, DatabaseResult, DatabaseRow } from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  AdminUser,
  BulkCreateStudentsInput,
  GeneratedStudentCredential,
  ListUsersQuery,
  UserStatus,
} from './user.types.js';

type UserRow = DatabaseRow & {
  id: number;
  username: string | null;
  email: string | null;
  full_name: string;
  status: UserStatus;
  roles: string | null;
  created_at: Date;
  updated_at: Date;
};

type CountRow = DatabaseRow & {
  total: number;
};

type RoleIdRow = DatabaseRow & {
  id: number;
  name: string;
};

type ActiveAdminCountRow = DatabaseRow & {
  total: number;
};

function splitList(value: string | null) {
  return value ? value.split(',').filter(Boolean) : [];
}

function mapUser(row: UserRow): AdminUser {
  return {
    id: Number(row.id),
    username: row.username,
    email: row.email,
    full_name: row.full_name,
    status: row.status,
    roles: splitList(row.roles),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const userSelect = `
  SELECT
    u.id,
    u.username,
    u.email,
    u.full_name,
    u.status,
    u.created_at,
    u.updated_at,
    STRING_AGG(DISTINCT r.name, ',' ORDER BY r.name) AS roles
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN roles r ON r.id = ur.role_id
`;

export async function findUsers(query: ListUsersQuery) {
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (query.status) {
    where.push('u.status = ?');
    params.push(query.status);
  }

  if (query.q) {
    where.push('(u.username ILIKE ? OR u.email ILIKE ? OR u.full_name ILIKE ?)');
    const keyword = `%${query.q}%`;
    params.push(keyword, keyword, keyword);
  }

  if (query.role) {
    where.push(
      'EXISTS (SELECT 1 FROM user_roles role_filter_ur JOIN roles role_filter_r ON role_filter_r.id = role_filter_ur.role_id WHERE role_filter_ur.user_id = u.id AND role_filter_r.name = ?)',
    );
    params.push(query.role);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (query.page - 1) * query.limit;

  const [rows] = await databasePool.query<UserRow[]>(
    `
      ${userSelect}
      ${whereSql}
      GROUP BY u.id, u.username, u.email, u.full_name, u.status, u.created_at, u.updated_at
      ORDER BY u.created_at DESC, u.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, query.limit, offset],
  );

  const [countRows] = await databasePool.query<CountRow[]>(
    `
      SELECT COUNT(*) AS total
      FROM users u
      ${whereSql}
    `,
    params,
  );

  return {
    users: rows.map(mapUser),
    total: Number(countRows[0]?.total ?? 0),
  };
}

export async function findUserById(id: number) {
  const [rows] = await databasePool.query<UserRow[]>(
    `
      ${userSelect}
      WHERE u.id = ?
      GROUP BY u.id, u.username, u.email, u.full_name, u.status, u.created_at, u.updated_at
      LIMIT 1
    `,
    [id],
  );

  return rows[0] ? mapUser(rows[0]) : null;
}

export async function isEmailTaken(email: string, excludeId?: number) {
  const params: Array<string | number> = [email];
  let query = 'SELECT id FROM users WHERE email = ?';

  if (excludeId) {
    query += ' AND id <> ?';
    params.push(excludeId);
  }

  query += ' LIMIT 1';

  const [rows] = await databasePool.query<DatabaseRow[]>(query, params);
  return rows.length > 0;
}

export async function isUsernameTaken(username: string, connection = databasePool) {
  const [rows] = await connection.query<DatabaseRow[]>(
    'SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1',
    [username],
  );
  return rows.length > 0;
}

export async function countActiveAdmins() {
  const [rows] = await databasePool.query<ActiveAdminCountRow[]>(
    `
      SELECT COUNT(DISTINCT u.id) AS total
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE u.status = 'active' AND r.name = 'admin'
    `,
  );

  return Number(rows[0]?.total ?? 0);
}

export async function findRoleIdsByNames(roleNames: string[], connection: DatabaseConnection = databasePool as unknown as DatabaseConnection) {
  if (roleNames.length === 0) {
    return [];
  }

  const [rows] = await connection.query<RoleIdRow[]>(
    `SELECT id, name FROM roles WHERE name IN (${roleNames.map(() => '?').join(', ')})`,
    roleNames,
  );

  return rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
  }));
}

async function replaceUserRoles(userId: number, roleNames: string[], connection: DatabaseConnection) {
  await connection.query('DELETE FROM user_roles WHERE user_id = ?', [userId]);

  if (roleNames.length === 0) {
    return;
  }

  const roles = await findRoleIdsByNames(roleNames, connection);

  const values = roles.map((role) => [userId, role.id]);
  await connection.query('INSERT INTO user_roles (user_id, role_id) VALUES ?', [values]);
}

export async function createUserRecord(input: {
  email: string;
  full_name: string;
  password_hash: string;
  status: UserStatus;
  roles: string[];
}) {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();
    const [result] = await connection.query<DatabaseResult>(
      `
      INSERT INTO users (email, full_name, password_hash, status)
        VALUES (?, ?, ?, ?)
        RETURNING id
      `,
      [input.email, input.full_name, input.password_hash, input.status],
    );

    await replaceUserRoles(result.insertId, input.roles, connection);
    await connection.commit();
    return findUserById(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateUserRecord(
  id: number,
  input: {
    email: string | null;
    full_name: string;
    status: UserStatus;
    password_hash?: string;
    roles?: string[];
  },
) {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    if (input.password_hash) {
      await connection.query(
        `
          UPDATE users
          SET email = ?, full_name = ?, status = ?, password_hash = ?
          WHERE id = ?
        `,
        [input.email, input.full_name, input.status, input.password_hash, id],
      );
    } else {
      await connection.query(
        `
          UPDATE users
          SET email = ?, full_name = ?, status = ?
          WHERE id = ?
        `,
        [input.email, input.full_name, input.status, id],
      );
    }

    if (input.roles) {
      await replaceUserRoles(id, input.roles, connection);
    }

    await connection.commit();
    return findUserById(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateUserStatusRecord(id: number, status: UserStatus) {
  await databasePool.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
  return findUserById(id);
}

export async function updateUserRolesRecord(id: number, roles: string[]) {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();
    await replaceUserRoles(id, roles, connection);
    await connection.commit();
    return findUserById(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function createBulkStudentAccountsRecord(input: {
  students: Array<{
    username: string;
    email: string | null;
    password_hash: string;
    full_name: string;
    date_of_birth: string;
    class_name: string | null;
    student_code: string | null;
    phone: string | null;
    parent_phone: string | null;
  }>;
  classroom_id?: number;
  created_by_user_id?: number;
  enrolled_at?: string;
}) {
  const connection = await databasePool.getConnection();
  const credentials: GeneratedStudentCredential[] = [];

  try {
    await connection.beginTransaction();
    const roleRows = await findRoleIdsByNames(['student'], connection);
    const studentRoleId = roleRows[0]?.id;
    if (!studentRoleId) {
      throw new Error('Student role is not configured');
    }

    for (const student of input.students) {
      const [userResult] = await connection.query<DatabaseResult>(
        `
          INSERT INTO users (username, email, full_name, password_hash, status)
          VALUES (?, ?, ?, ?, 'active')
          RETURNING id
        `,
        [student.username, student.email, student.full_name, student.password_hash],
      );
      const userId = userResult.insertId;

      await connection.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?) ON CONFLICT (user_id, role_id) DO NOTHING',
        [userId, studentRoleId],
      );
      await connection.query(
        `
          INSERT INTO student_profiles
            (user_id, student_code, full_name, class_name, date_of_birth, phone, parent_phone, avatar_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
          ON CONFLICT (user_id) DO UPDATE SET
            student_code = EXCLUDED.student_code,
            full_name = EXCLUDED.full_name,
            class_name = EXCLUDED.class_name,
            date_of_birth = EXCLUDED.date_of_birth,
            phone = EXCLUDED.phone,
            parent_phone = EXCLUDED.parent_phone
        `,
        [
          userId,
          student.student_code,
          student.full_name,
          student.class_name,
          student.date_of_birth,
          student.phone,
          student.parent_phone,
        ],
      );

      if (input.classroom_id) {
        await connection.query(
          `
            INSERT INTO student_enrollments (
              student_user_id, classroom_id, academic_year_id, status,
              enrolled_at, note, created_by_user_id
            )
            SELECT ?, classroom.id, classroom.academic_year_id, 'active',
              ?, 'Created by bulk student account provisioning', ?
            FROM classrooms classroom
            WHERE classroom.id = ? AND classroom.academic_year_id IS NOT NULL
          `,
          [
            userId,
            input.enrolled_at,
            input.created_by_user_id ?? null,
            input.classroom_id,
          ],
        );
      }

      credentials.push({
        user_id: userId,
        username: student.username,
        password: '',
        full_name: student.full_name,
        date_of_birth: student.date_of_birth,
        class_name: student.class_name,
        student_code: student.student_code,
      });
    }

    await connection.commit();
    return credentials;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}


