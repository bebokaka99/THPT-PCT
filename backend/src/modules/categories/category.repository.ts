import type { DatabaseResult, DatabaseRow } from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type { Category, CreateCategoryInput, UpdateCategoryInput } from './category.types.js';

type CategoryRow = DatabaseRow & {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: number;
  created_at: Date;
  updated_at: Date;
};

function mapCategory(row: CategoryRow): Category {
  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    description: row.description,
    sort_order: Number(row.sort_order),
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function findCategories() {
  const [rows] = await databasePool.query<CategoryRow[]>(
    `
      SELECT id, name, slug, description, sort_order, is_active, created_at, updated_at
      FROM categories
      WHERE is_active = TRUE
      ORDER BY sort_order ASC, name ASC
    `,
  );

  return rows.map(mapCategory);
}

export async function findAllCategories() {
  const [rows] = await databasePool.query<CategoryRow[]>(
    `
      SELECT id, name, slug, description, sort_order, is_active, created_at, updated_at
      FROM categories
      ORDER BY sort_order ASC, created_at DESC
    `,
  );

  return rows.map(mapCategory);
}

export async function findCategoryBySlug(slug: string) {
  const [rows] = await databasePool.query<CategoryRow[]>(
    `
      SELECT id, name, slug, description, sort_order, is_active, created_at, updated_at
      FROM categories
      WHERE slug = ? AND is_active = TRUE
      LIMIT 1
    `,
    [slug],
  );

  return rows[0] ? mapCategory(rows[0]) : null;
}

export async function findCategoryById(id: number) {
  const [rows] = await databasePool.query<CategoryRow[]>(
    `
      SELECT id, name, slug, description, sort_order, is_active, created_at, updated_at
      FROM categories
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  return rows[0] ? mapCategory(rows[0]) : null;
}

export async function isCategorySlugTaken(slug: string, excludeId?: number) {
  const params: Array<string | number> = [slug];
  let query = 'SELECT id FROM categories WHERE slug = ?';

  if (excludeId) {
    query += ' AND id <> ?';
    params.push(excludeId);
  }

  query += ' LIMIT 1';

  const [rows] = await databasePool.query<DatabaseRow[]>(query, params);
  return rows.length > 0;
}

export async function createCategory(input: Required<CreateCategoryInput>) {
  const [result] = await databasePool.query<DatabaseResult>(
    `
      INSERT INTO categories (name, slug, description, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?)
      RETURNING id
    `,
    [
      input.name,
      input.slug,
      input.description,
      input.sort_order,
      input.is_active ? 1 : 0,
    ],
  );

  return findCategoryById(result.insertId);
}

export async function updateCategory(id: number, input: Required<UpdateCategoryInput>) {
  await databasePool.query(
    `
      UPDATE categories
      SET name = ?, slug = ?, description = ?, sort_order = ?, is_active = ?
      WHERE id = ?
    `,
    [
      input.name,
      input.slug,
      input.description,
      input.sort_order,
      input.is_active ? 1 : 0,
      id,
    ],
  );

  return findCategoryById(id);
}

export async function deleteCategory(id: number) {
  const [result] = await databasePool.query<DatabaseResult>(
    'DELETE FROM categories WHERE id = ?',
    [id],
  );

  return result.affectedRows > 0;
}


