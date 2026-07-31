import { databasePool } from '../../database/postgres.js';
import type { DashboardOverview } from './dashboard.types.js';

type OverviewRow = {
  users: DashboardOverview['users'];
  classrooms: DashboardOverview['classrooms'];
  posts: DashboardOverview['posts'];
  documents: DashboardOverview['documents'];
  importer: DashboardOverview['importer'];
  media: DashboardOverview['media'];
  events: DashboardOverview['events'];
};

type ActivityRow = {
  id: number;
  type: 'post' | 'document' | 'event';
  title: string;
  status: string;
  created_at: string;
  href: string;
};

function asNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function mapOverview(row: OverviewRow, activity: ActivityRow[]): DashboardOverview {
  return {
    generated_at: new Date().toISOString(),
    users: {
      total: asNumber(row.users.total),
      active: asNumber(row.users.active),
      inactive: asNumber(row.users.inactive),
      locked: asNumber(row.users.locked),
      by_role: {
        admin: asNumber(row.users.by_role.admin),
        teacher: asNumber(row.users.by_role.teacher),
        student: asNumber(row.users.by_role.student),
      },
    },
    classrooms: {
      total: asNumber(row.classrooms.total),
      active: asNumber(row.classrooms.active),
      inactive: asNumber(row.classrooms.inactive),
    },
    posts: {
      total: asNumber(row.posts.total),
      draft: asNumber(row.posts.draft),
      published: asNumber(row.posts.published),
      archived: asNumber(row.posts.archived),
    },
    documents: {
      total: asNumber(row.documents.total),
      draft: asNumber(row.documents.draft),
      published: asNumber(row.documents.published),
      archived: asNumber(row.documents.archived),
    },
    importer: {
      total: asNumber(row.importer.total),
      pending: asNumber(row.importer.pending),
      converted: asNumber(row.importer.converted),
      error: asNumber(row.importer.error),
      skipped: asNumber(row.importer.skipped),
    },
    media: {
      total: asNumber(row.media.total),
      images: asNumber(row.media.images),
      documents: asNumber(row.media.documents),
      original_size: asNumber(row.media.original_size),
      optimized_size: asNumber(row.media.optimized_size),
    },
    events: {
      total: asNumber(row.events.total),
      upcoming: asNumber(row.events.upcoming),
    },
    recent_activity: activity.map((item) => ({
      ...item,
      id: Number(item.id),
      created_at: new Date(item.created_at).toISOString(),
    })),
  };
}

export async function loadDashboardOverview() {
  const [overviewRows, activityRows] = await Promise.all([
    databasePool.query<OverviewRow[]>(`
      SELECT
        (
          SELECT json_build_object(
            'total', COUNT(*),
            'active', COUNT(*) FILTER (WHERE status = 'active'),
            'inactive', COUNT(*) FILTER (WHERE status = 'inactive'),
            'locked', COUNT(*) FILTER (WHERE status = 'locked'),
            'by_role', json_build_object(
              'admin', (SELECT COUNT(DISTINCT ur.user_id) FROM user_roles ur JOIN roles r ON r.id = ur.role_id JOIN users ru ON ru.id = ur.user_id WHERE r.name = 'admin' AND ru.status = 'active'),
              'teacher', (SELECT COUNT(DISTINCT ur.user_id) FROM user_roles ur JOIN roles r ON r.id = ur.role_id JOIN users ru ON ru.id = ur.user_id WHERE r.name = 'teacher' AND ru.status = 'active'),
              'student', (SELECT COUNT(DISTINCT ur.user_id) FROM user_roles ur JOIN roles r ON r.id = ur.role_id JOIN users ru ON ru.id = ur.user_id WHERE r.name = 'student' AND ru.status = 'active')
            )
          )
          FROM users
        ) AS users,
        (
          SELECT json_build_object(
            'total', COUNT(*),
            'active', COUNT(*) FILTER (WHERE is_active = TRUE),
            'inactive', COUNT(*) FILTER (WHERE is_active = FALSE)
          )
          FROM classrooms
        ) AS classrooms,
        (
          SELECT json_build_object(
            'total', COUNT(*),
            'draft', COUNT(*) FILTER (WHERE status = 'draft'),
            'published', COUNT(*) FILTER (WHERE status = 'published'),
            'archived', COUNT(*) FILTER (WHERE status = 'archived')
          )
          FROM posts
          WHERE deleted_at IS NULL
        ) AS posts,
        (
          SELECT json_build_object(
            'total', COUNT(*),
            'draft', COUNT(*) FILTER (WHERE status = 'draft'),
            'published', COUNT(*) FILTER (WHERE status = 'published'),
            'archived', COUNT(*) FILTER (WHERE status = 'archived')
          )
          FROM documents
          WHERE deleted_at IS NULL
        ) AS documents,
        (
          SELECT json_build_object(
            'total', COUNT(*),
            'pending', COUNT(*) FILTER (WHERE import_status = 'pending'),
            'converted', COUNT(*) FILTER (WHERE import_status = 'converted'),
            'error', COUNT(*) FILTER (WHERE import_status = 'error'),
            'skipped', COUNT(*) FILTER (WHERE import_status = 'skipped')
          )
          FROM imported_contents
        ) AS importer,
        (
          SELECT json_build_object(
            'total', COUNT(*),
            'images', COUNT(*) FILTER (WHERE type = 'image'),
            'documents', COUNT(*) FILTER (WHERE type = 'document'),
            'original_size', COALESCE(SUM(size), 0),
            'optimized_size', COALESCE(SUM(optimized_size), 0)
          )
          FROM media_files
        ) AS media,
        (
          SELECT json_build_object(
            'total', COUNT(*),
            'upcoming', COUNT(*) FILTER (
              WHERE status = 'scheduled'
                AND COALESCE(end_time, start_time) >= NOW()
            )
          )
          FROM events
        ) AS events
    `),
    databasePool.query<ActivityRow[]>(`
      SELECT id, type, title, status, created_at, href
      FROM (
        SELECT id, 'post'::text AS type, title, status::text AS status,
          created_at, '/admin/posts' AS href
        FROM posts
        WHERE deleted_at IS NULL
        UNION ALL
        SELECT id, 'document'::text AS type, title, status::text AS status,
          created_at, '/admin/documents' AS href
        FROM documents
        WHERE deleted_at IS NULL
        UNION ALL
        SELECT id, 'event'::text AS type, title, status::text AS status,
          created_at, '/admin/events' AS href
        FROM events
      ) activity
      ORDER BY created_at DESC, id DESC
      LIMIT 8
    `),
  ]);

  return mapOverview(overviewRows[0][0], activityRows[0]);
}
