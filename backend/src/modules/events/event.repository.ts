import type { DatabaseResult, DatabaseRow } from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type {
  EventInput,
  EventStatus,
  ListEventsQuery,
  SchoolEvent,
} from './event.types.js';

type EventRow = DatabaseRow & SchoolEvent;
type CountRow = DatabaseRow & { total: number };

const eventSelect = `
  SELECT e.*, u.full_name AS creator_name
  FROM events e
  LEFT JOIN users u ON u.id = e.created_by
`;

function mapEvent(row: EventRow): SchoolEvent {
  return {
    ...row,
    id: Number(row.id),
    created_by: row.created_by === null ? null : Number(row.created_by),
    all_day: Boolean(row.all_day),
    is_public: Boolean(row.is_public),
  };
}

export async function findEvents(
  query: ListEventsQuery,
  publicOnly: boolean,
) {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (publicOnly) where.push('e.is_public = TRUE');
  if (query.status) {
    where.push('e.status = ?');
    params.push(query.status);
  }
  if (query.scope === 'upcoming') {
    where.push('COALESCE(e.end_time, e.start_time) >= NOW()');
  } else if (query.scope === 'past') {
    where.push('COALESCE(e.end_time, e.start_time) < NOW()');
  }
  if (query.q) {
    where.push('(e.title ILIKE ? OR e.description ILIKE ? OR e.location ILIKE ?)');
    const keyword = `%${query.q}%`;
    params.push(keyword, keyword, keyword);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql =
    query.scope === 'past'
      ? 'ORDER BY e.start_time DESC, e.id DESC'
      : 'ORDER BY e.start_time ASC, e.id ASC';
  const offset = (query.page - 1) * query.limit;
  const [rows] = await databasePool.query<EventRow[]>(
    `${eventSelect} ${whereSql} ${orderSql} LIMIT ? OFFSET ?`,
    [...params, query.limit, offset],
  );
  const [countRows] = await databasePool.query<CountRow[]>(
    `SELECT COUNT(*) AS total FROM events e ${whereSql}`,
    params,
  );
  return {
    data: rows.map(mapEvent),
    total: Number(countRows[0]?.total ?? 0),
  };
}

export async function findEventById(id: number) {
  const [rows] = await databasePool.query<EventRow[]>(
    `${eventSelect} WHERE e.id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? mapEvent(rows[0]) : null;
}

export async function findPublicEventBySlug(slug: string) {
  const [rows] = await databasePool.query<EventRow[]>(
    `${eventSelect} WHERE e.slug = ? AND e.is_public = TRUE LIMIT 1`,
    [slug],
  );
  return rows[0] ? mapEvent(rows[0]) : null;
}

export async function isEventSlugTaken(slug: string, excludeId?: number) {
  const params: Array<string | number> = [slug];
  let sql = 'SELECT id FROM events WHERE slug = ?';
  if (excludeId) {
    sql += ' AND id <> ?';
    params.push(excludeId);
  }
  const [rows] = await databasePool.query<DatabaseRow[]>(`${sql} LIMIT 1`, params);
  return rows.length > 0;
}

export async function insertEvent(input: EventInput & { slug: string; created_by: number }) {
  const [result] = await databasePool.query<DatabaseResult>(
    `
      INSERT INTO events (
        title, slug, description, category, location, cover_image_url,
        start_time, end_time, all_day, status, is_public, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
    [
      input.title,
      input.slug,
      input.description ?? null,
      input.category ?? null,
      input.location ?? null,
      input.cover_image_url ?? null,
      input.start_time,
      input.end_time ?? null,
      input.all_day ?? false,
      input.status ?? 'scheduled',
      input.is_public ?? false,
      input.created_by,
    ],
  );
  return findEventById(result.insertId);
}

export async function updateEventRecord(id: number, input: EventInput & { slug: string }) {
  const [result] = await databasePool.query<DatabaseResult>(
    `
      UPDATE events
      SET title = ?, slug = ?, description = ?, category = ?, location = ?,
          cover_image_url = ?, start_time = ?, end_time = ?, all_day = ?,
          status = ?, is_public = ?
      WHERE id = ?
    `,
    [
      input.title,
      input.slug,
      input.description ?? null,
      input.category ?? null,
      input.location ?? null,
      input.cover_image_url ?? null,
      input.start_time,
      input.end_time ?? null,
      input.all_day ?? false,
      input.status ?? 'scheduled',
      input.is_public ?? false,
      id,
    ],
  );
  return result.affectedRows > 0 ? findEventById(id) : null;
}

export async function updateEventState(
  id: number,
  input: { status?: EventStatus; isPublic?: boolean },
) {
  const fields: string[] = [];
  const params: Array<string | number | boolean> = [];
  if (input.status !== undefined) {
    fields.push('status = ?');
    params.push(input.status);
  }
  if (input.isPublic !== undefined) {
    fields.push('is_public = ?');
    params.push(input.isPublic);
  }
  if (fields.length === 0) return findEventById(id);
  params.push(id);
  const [result] = await databasePool.query<DatabaseResult>(
    `UPDATE events SET ${fields.join(', ')} WHERE id = ?`,
    params,
  );
  return result.affectedRows > 0 ? findEventById(id) : null;
}

export async function deleteEventRecord(id: number) {
  const [result] = await databasePool.query<DatabaseResult>(
    'DELETE FROM events WHERE id = ?',
    [id],
  );
  return result.affectedRows > 0;
}
