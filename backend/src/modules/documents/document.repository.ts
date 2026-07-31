import type { DatabaseResult, DatabaseRow } from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  CreateDocumentInput,
  DocumentStatus,
  ListDocumentsQuery,
  SchoolDocument,
  UpdateDocumentInput,
} from './document.types.js';

type DocumentRow = DatabaseRow & SchoolDocument;

type CountRow = DatabaseRow & {
  total: number;
};

function mapDocument(row: DocumentRow): SchoolDocument {
  return {
    id: Number(row.id),
    title: row.title,
    slug: row.slug,
    description: row.description,
    category: row.category,
    document_url: row.document_url,
    file_type: row.file_type,
    file_size: Number(row.file_size),
    uploaded_by: row.uploaded_by === null ? null : Number(row.uploaded_by),
    status: row.status,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at ?? null,
  };
}

const documentSelect = `
  SELECT
    d.id,
    d.title,
    d.slug,
    d.description,
    d.category,
    d.document_url,
    d.file_type,
    d.file_size,
    d.uploaded_by,
    d.status,
    d.published_at,
    d.created_at,
    d.updated_at,
    d.deleted_at
  FROM documents d
`;

export async function findDocuments(query: ListDocumentsQuery) {
  const where: string[] = [
    query.status === 'deleted' ? 'd.deleted_at IS NOT NULL' : 'd.deleted_at IS NULL',
  ];
  const params: Array<string | number> = [];

  if (query.status && query.status !== 'deleted') {
    where.push('d.status = ?');
    params.push(query.status);
  }

  if (query.category) {
    where.push('d.category = ?');
    params.push(query.category);
  }

  if (query.q) {
    if (query.q.trim().length >= 3) {
      where.push(
        `to_tsvector('simple', coalesce(d.title, '') || ' ' || coalesce(d.description, '') || ' ' || coalesce(d.category, '')) @@ plainto_tsquery('simple', ?)`,
      );
      params.push(query.q.trim());
    } else {
      where.push('(d.title ILIKE ? OR d.description ILIKE ? OR d.category ILIKE ?)');
      const keyword = `%${query.q}%`;
      params.push(keyword, keyword, keyword);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (query.page - 1) * query.limit;

  const [rows] = await databasePool.query<DocumentRow[]>(
    `
      ${documentSelect}
      ${whereSql}
      ORDER BY d.published_at DESC, d.created_at DESC
      LIMIT ? OFFSET ?
    `,
    [...params, query.limit, offset],
  );

  const [countRows] = await databasePool.query<CountRow[]>(
    `
      SELECT COUNT(*) AS total
      FROM documents d
      ${whereSql}
    `,
    params,
  );

  return {
    documents: rows.map(mapDocument),
    total: Number(countRows[0]?.total ?? 0),
  };
}

export async function findPublishedDocuments(query: ListDocumentsQuery) {
  return findDocuments({
    ...query,
    status: 'published',
  });
}

export async function findPublishedDocumentBySlug(slug: string) {
  const [rows] = await databasePool.query<DocumentRow[]>(
    `
      ${documentSelect}
      WHERE d.slug = ? AND d.status = 'published' AND d.deleted_at IS NULL
      LIMIT 1
    `,
    [slug],
  );

  return rows[0] ? mapDocument(rows[0]) : null;
}

export async function findDocumentById(id: number) {
  const [rows] = await databasePool.query<DocumentRow[]>(
    `
      ${documentSelect}
      WHERE d.id = ?
      LIMIT 1
    `,
    [id],
  );

  return rows[0] ? mapDocument(rows[0]) : null;
}

export async function isDocumentSlugTaken(slug: string, excludeId?: number) {
  const params: Array<string | number> = [slug];
  let query = 'SELECT id FROM documents WHERE slug = ?';

  if (excludeId) {
    query += ' AND id <> ?';
    params.push(excludeId);
  }

  query += ' LIMIT 1';

  const [rows] = await databasePool.query<DatabaseRow[]>(query, params);
  return rows.length > 0;
}

export async function createDocument(input: Required<CreateDocumentInput> & { uploaded_by: number }) {
  const publishedAt = input.status === 'published' ? new Date() : null;

  const [result] = await databasePool.query<DatabaseResult>(
    `
      INSERT INTO documents (
        title,
        slug,
        description,
        category,
        document_url,
        file_type,
        file_size,
        uploaded_by,
        status,
        published_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
    [
      input.title,
      input.slug,
      input.description,
      input.category,
      input.document_url,
      input.file_type,
      input.file_size,
      input.uploaded_by,
      input.status,
      publishedAt,
    ],
  );

  return findDocumentById(result.insertId);
}

type UpdateDocumentRecord = Required<UpdateDocumentInput> & {
  published_at: Date | null;
};

export async function updateDocument(id: number, input: UpdateDocumentRecord) {
  await databasePool.query(
    `
      UPDATE documents
      SET
        title = ?,
        slug = ?,
        description = ?,
        category = ?,
        document_url = ?,
        file_type = ?,
        file_size = ?,
        status = ?,
        published_at = ?
      WHERE id = ?
    `,
    [
      input.title,
      input.slug,
      input.description,
      input.category,
      input.document_url,
      input.file_type,
      input.file_size,
      input.status,
      input.published_at,
      id,
    ],
  );

  return findDocumentById(id);
}

export async function deleteDocument(id: number) {
  const [result] = await databasePool.query<DatabaseResult>(
    'UPDATE documents SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  return result.affectedRows > 0;
}

export async function restoreDocument(id: number) {
  const [result] = await databasePool.query<DatabaseResult>(
    'UPDATE documents SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL',
    [id],
  );
  return result.affectedRows > 0;
}

export async function updateDocumentStatus(id: number, status: DocumentStatus) {
  if (status === 'published') {
    await databasePool.query(
      `
        UPDATE documents
        SET status = ?, published_at = COALESCE(published_at, NOW())
        WHERE id = ?
      `,
      [status, id],
    );
  } else {
    await databasePool.query(
      `
        UPDATE documents
        SET status = ?, published_at = published_at
        WHERE id = ?
      `,
      [status, id],
    );
  }

  return findDocumentById(id);
}


