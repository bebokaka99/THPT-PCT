import type { DatabaseResult, DatabaseRow } from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  ImportedContentDetail,
  ImportedContentListItem,
  ImportedContentListQuery,
  ImportStatus,
} from './importer.types.js';

type ImportedContentRow = DatabaseRow & ImportedContentDetail;
type CountRow = DatabaseRow & { total: number };

function jsonValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'string' ? value : JSON.stringify(value);
}

function mapImportedContent(row: ImportedContentRow): ImportedContentDetail {
  return {
    id: Number(row.id),
    source_site: row.source_site,
    source_url: row.source_url,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content_html: row.content_html,
    content_text: row.content_text,
    category_name: row.category_name,
    detected_published_at: row.detected_published_at,
    images_json: jsonValue(row.images_json),
    attachments_json: jsonValue(row.attachments_json),
    import_status: row.import_status,
    status: row.import_status,
    imported_post_id: row.imported_post_id === null ? null : Number(row.imported_post_id),
    error_message: row.error_message,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapImportedContentListItem(row: ImportedContentRow): ImportedContentListItem {
  const detail = mapImportedContent(row);
  const { content_html: _contentHtml, content_text: _contentText, ...listItem } = detail;
  return listItem;
}

function buildWhere(query: ImportedContentListQuery) {
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (query.status) {
    where.push('import_status = ?');
    params.push(query.status);
  }

  if (query.category) {
    where.push('category_name = ?');
    params.push(query.category);
  }

  if (query.q) {
    where.push('(title ILIKE ? OR excerpt ILIKE ? OR source_url ILIKE ?)');
    const keyword = `%${query.q}%`;
    params.push(keyword, keyword, keyword);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

export async function findImportedContents(query: ImportedContentListQuery) {
  const { whereSql, params } = buildWhere(query);
  const offset = (query.page - 1) * query.limit;

  const [rows] = await databasePool.query<ImportedContentRow[]>(
    `
      SELECT
        id,
        source_site,
        source_url,
        title,
        slug,
        excerpt,
        NULL AS content_html,
        NULL AS content_text,
        category_name,
        detected_published_at,
        images_json,
        attachments_json,
        import_status,
        imported_post_id,
        error_message,
        created_at,
        updated_at
      FROM imported_contents
      ${whereSql}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, query.limit, offset],
  );

  const [countRows] = await databasePool.query<CountRow[]>(
    `
      SELECT COUNT(*) AS total
      FROM imported_contents
      ${whereSql}
    `,
    params,
  );

  return {
    items: rows.map(mapImportedContentListItem),
    total: Number(countRows[0]?.total ?? 0),
  };
}

export async function findImportedContentById(id: number) {
  const [rows] = await databasePool.query<ImportedContentRow[]>(
    `
      SELECT
        id,
        source_site,
        source_url,
        title,
        slug,
        excerpt,
        content_html,
        content_text,
        category_name,
        detected_published_at,
        images_json,
        attachments_json,
        import_status,
        imported_post_id,
        error_message,
        created_at,
        updated_at
      FROM imported_contents
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  return rows[0] ? mapImportedContent(rows[0]) : null;
}

export async function updateImportedContentStatus(id: number, status: ImportStatus) {
  const [result] = await databasePool.query<DatabaseResult>(
    `
      UPDATE imported_contents
      SET import_status = ?
      WHERE id = ?
    `,
    [status, id],
  );

  return result.affectedRows > 0;
}

export async function markImportedContentConverted(id: number, postId: number) {
  await databasePool.query(
    `
      UPDATE imported_contents
      SET import_status = 'converted', imported_post_id = ?, error_message = NULL
      WHERE id = ?
    `,
    [postId, id],
  );

  return findImportedContentById(id);
}


