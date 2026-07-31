import type { DatabaseRow } from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type { Role } from './role.types.js';

type RoleRow = DatabaseRow & Role;

function mapRole(row: RoleRow): Role {
  return {
    id: Number(row.id),
    name: row.name,
    display_name: row.display_name,
    description: row.description,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function findRoles() {
  const [rows] = await databasePool.query<RoleRow[]>(
    `
      SELECT id, name, display_name, description, created_at, updated_at
      FROM roles
      ORDER BY CASE name
        WHEN 'admin' THEN 1
        WHEN 'teacher' THEN 2
        WHEN 'student' THEN 3
        ELSE 4
      END, name
    `,
  );

  return rows.map(mapRole);
}


