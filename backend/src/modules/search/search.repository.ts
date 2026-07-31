import type { DatabaseRow } from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type { SearchDocumentResult, SearchPostResult } from './search.types.js';

type CountRow = DatabaseRow & {
  total: number;
};

type SearchPostRow = DatabaseRow & SearchPostResult;
type SearchDocumentRow = DatabaseRow & SearchDocumentResult;

function escapeLikeTerm(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
}

function searchPattern(q: string) {
  return `%${escapeLikeTerm(q)}%`;
}

export async function searchPublishedPosts(q: string, page: number, limit: number) {
  const isFullText = q.trim().length >= 3;
  const keyword = searchPattern(q);
  const params = isFullText ? [q.trim()] : [keyword, keyword, keyword];
  const searchCondition = isFullText
    ? `to_tsvector('simple', coalesce(p.title, '') || ' ' || coalesce(p.excerpt, '') || ' ' || coalesce(p.content, '')) @@ plainto_tsquery('simple', ?)`
    : '(p.title ILIKE ? OR p.excerpt ILIKE ? OR p.content ILIKE ?)';
  const offset = (page - 1) * limit;

  const [rows] = await databasePool.query<SearchPostRow[]>(
    `
      SELECT
        p.id,
        p.title,
        p.slug,
        p.excerpt,
        p.cover_image_url,
        p.published_at,
        p.created_at,
        p.category_id
      FROM posts p
      WHERE p.status = 'published'
        AND p.deleted_at IS NULL
        AND ${searchCondition}
      ORDER BY p.published_at DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset],
  );

  const [countRows] = await databasePool.query<CountRow[]>(
    `
      SELECT COUNT(*) AS total
      FROM posts p
      WHERE p.status = 'published'
        AND p.deleted_at IS NULL
        AND ${searchCondition}
    `,
    params,
  );

  return {
    data: rows.map((row) => ({
      id: Number(row.id),
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      cover_image_url: row.cover_image_url,
      published_at: row.published_at,
      created_at: row.created_at,
      category_id: row.category_id === null ? null : Number(row.category_id),
    })),
    total: Number(countRows[0]?.total ?? 0),
  };
}

export async function searchPublishedDocuments(q: string, page: number, limit: number) {
  const isFullText = q.trim().length >= 3;
  const keyword = searchPattern(q);
  const params = isFullText ? [q.trim()] : [keyword, keyword, keyword];
  const searchCondition = isFullText
    ? `to_tsvector('simple', coalesce(d.title, '') || ' ' || coalesce(d.description, '') || ' ' || coalesce(d.category, '')) @@ plainto_tsquery('simple', ?)`
    : '(d.title ILIKE ? OR d.description ILIKE ? OR d.category ILIKE ?)';
  const offset = (page - 1) * limit;

  const [rows] = await databasePool.query<SearchDocumentRow[]>(
    `
      SELECT
        d.id,
        d.title,
        d.slug,
        d.description,
        d.document_url,
        d.category,
        d.published_at,
        d.created_at
      FROM documents d
      WHERE d.status = 'published'
        AND d.deleted_at IS NULL
        AND ${searchCondition}
      ORDER BY d.published_at DESC, d.created_at DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset],
  );

  const [countRows] = await databasePool.query<CountRow[]>(
    `
      SELECT COUNT(*) AS total
      FROM documents d
      WHERE d.status = 'published'
        AND d.deleted_at IS NULL
        AND ${searchCondition}
    `,
    params,
  );

  return {
    data: rows.map((row) => ({
      id: Number(row.id),
      title: row.title,
      slug: row.slug,
      description: row.description,
      document_url: row.document_url,
      category: row.category,
      published_at: row.published_at,
      created_at: row.created_at,
    })),
    total: Number(countRows[0]?.total ?? 0),
  };
}


