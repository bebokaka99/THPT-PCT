import type { DatabaseResult, DatabaseRow } from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  CreateMediaInput,
  ListMediaQuery,
  MediaFile,
  MediaVariants,
} from './media.types.js';

type MediaRow = DatabaseRow & {
  id: number;
  original_name: string;
  file_name: string;
  mime_type: string;
  size: number;
  type: MediaFile['type'];
  url: string;
  storage_path: string;
  uploaded_by: number | null;
  width: number | null;
  height: number | null;
  optimized_size: number | null;
  variants: MediaVariants | null;
  created_at: Date;
};

type CountRow = DatabaseRow & {
  total: number;
};

function mapMedia(row: MediaRow): MediaFile {
  return {
    id: Number(row.id),
    original_name: row.original_name,
    file_name: row.file_name,
    mime_type: row.mime_type,
    size: Number(row.size),
    type: row.type,
    url: row.url,
    storage_path: row.storage_path,
    uploaded_by: row.uploaded_by === null ? null : Number(row.uploaded_by),
    width: row.width === null ? null : Number(row.width),
    height: row.height === null ? null : Number(row.height),
    optimized_size:
      row.optimized_size === null ? null : Number(row.optimized_size),
    variants: row.variants ?? {},
    created_at: row.created_at,
  };
}

export async function createMedia(input: CreateMediaInput) {
  const [result] = await databasePool.query<DatabaseResult>(
    `
      INSERT INTO media_files (
        original_name,
        file_name,
        file_path,
        storage_path,
        mime_type,
        file_size,
        size,
        type,
        url,
        uploaded_by,
        width,
        height,
        optimized_size,
        variants
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
    [
      input.original_name,
      input.file_name,
      input.storage_path,
      input.storage_path,
      input.mime_type,
      input.size,
      input.size,
      input.type,
      input.url,
      input.uploaded_by,
      input.width ?? null,
      input.height ?? null,
      input.optimized_size ?? null,
      JSON.stringify(input.variants ?? {}),
    ],
  );

  return findMediaById(result.insertId);
}

export async function findMediaById(id: number) {
  const [rows] = await databasePool.query<MediaRow[]>(
    `
      SELECT id, original_name, file_name, mime_type, size, type, url,
        storage_path, uploaded_by, width, height, optimized_size, variants, created_at
      FROM media_files
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  return rows[0] ? mapMedia(rows[0]) : null;
}

export async function findMediaFiles(query: ListMediaQuery) {
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (query.type) {
    where.push('type = ?');
    params.push(query.type);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (query.page - 1) * query.limit;

  const [rows] = await databasePool.query<MediaRow[]>(
    `
      SELECT id, original_name, file_name, mime_type, size, type, url,
        storage_path, uploaded_by, width, height, optimized_size, variants, created_at
      FROM media_files
      ${whereSql}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, query.limit, offset],
  );

  const [countRows] = await databasePool.query<CountRow[]>(
    `
      SELECT COUNT(*) AS total
      FROM media_files
      ${whereSql}
    `,
    params,
  );

  return {
    data: rows.map(mapMedia),
    total: Number(countRows[0]?.total ?? 0),
  };
}

export async function deleteMediaRecord(id: number) {
  const [result] = await databasePool.query<DatabaseResult>('DELETE FROM media_files WHERE id = ?', [id]);
  return result.affectedRows > 0;
}



