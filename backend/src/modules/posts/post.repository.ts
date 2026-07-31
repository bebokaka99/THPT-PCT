import type { DatabaseConnection, DatabaseResult, DatabaseRow } from '../../database/postgres.js';
import { databasePool } from '../../database/postgres.js';
import type { CreatePostInput, ListPostsQuery, Post, PostImage, PostStatus, UpdatePostInput } from './post.types.js';

type PostRow = DatabaseRow & Post;
type PostImageRow = DatabaseRow & Required<PostImage>;

type CountRow = DatabaseRow & {
  total: number;
};

function mapPost(row: PostRow): Post {
  return {
    id: Number(row.id),
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
    cover_image_url: row.cover_image_url,
    category_id: row.category_id === null ? null : Number(row.category_id),
    author_id: row.author_id === null ? null : Number(row.author_id),
    status: row.status,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at ?? null,
  };
}

function mapPostImage(row: PostImageRow): PostImage {
  return {
    id: Number(row.id),
    post_id: Number(row.post_id),
    image_url: row.image_url,
    alt_text: row.alt_text,
    caption: row.caption,
    sort_order: Number(row.sort_order),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const postSelect = `
  SELECT
    p.id,
    p.title,
    p.slug,
    p.excerpt,
    p.content,
    p.cover_image_url,
    p.category_id,
    p.author_id,
    p.status,
    p.published_at,
    p.created_at,
    p.updated_at,
    p.deleted_at
  FROM posts p
`;

export async function findPosts(query: ListPostsQuery) {
  const where: string[] = [
    query.status === 'deleted' ? 'p.deleted_at IS NOT NULL' : 'p.deleted_at IS NULL',
  ];
  const params: Array<string | number> = [];

  if (query.status && query.status !== 'deleted') {
    where.push('p.status = ?');
    params.push(query.status);
  }

  if (query.categorySlug) {
    where.push('c.slug = ?');
    params.push(query.categorySlug);
  }

  if (query.q) {
    if (query.q.trim().length >= 3) {
      where.push(
        `to_tsvector('simple', coalesce(p.title, '') || ' ' || coalesce(p.excerpt, '') || ' ' || coalesce(p.content, '')) @@ plainto_tsquery('simple', ?)`,
      );
      params.push(query.q.trim());
    } else {
      where.push('(p.title ILIKE ? OR p.excerpt ILIKE ? OR p.content ILIKE ?)');
      const keyword = `%${query.q}%`;
      params.push(keyword, keyword, keyword);
    }
  }

  const joins = query.categorySlug ? 'LEFT JOIN categories c ON c.id = p.category_id' : '';
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (query.page - 1) * query.limit;

  const [rows] = await databasePool.query<PostRow[]>(
    `
      ${postSelect}
      ${joins}
      ${whereSql}
      ORDER BY p.published_at DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `,
    [...params, query.limit, offset],
  );

  const [countRows] = await databasePool.query<CountRow[]>(
    `
      SELECT COUNT(*) AS total
      FROM posts p
      ${joins}
      ${whereSql}
    `,
    params,
  );

  const total = Number(countRows[0]?.total ?? 0);

  return {
    posts: rows.map(mapPost),
    total,
  };
}

export async function findPublishedPosts(query: ListPostsQuery) {
  return findPosts({
    ...query,
    status: 'published',
  });
}

export async function findPublishedPostBySlug(slug: string) {
  const [rows] = await databasePool.query<PostRow[]>(
    `
      ${postSelect}
      WHERE p.slug = ? AND p.status = 'published' AND p.deleted_at IS NULL
      LIMIT 1
    `,
    [slug],
  );

  return rows[0] ? withPostImages(mapPost(rows[0])) : null;
}

export async function findPostById(id: number) {
  const [rows] = await databasePool.query<PostRow[]>(
    `
      ${postSelect}
      WHERE p.id = ?
      LIMIT 1
    `,
    [id],
  );

  return rows[0] ? withPostImages(mapPost(rows[0])) : null;
}

async function findPostImages(postId: number) {
  const [rows] = await databasePool.query<PostImageRow[]>(
    `
      SELECT id, post_id, image_url, alt_text, caption, sort_order, created_at, updated_at
      FROM post_images
      WHERE post_id = ?
      ORDER BY sort_order ASC, id ASC
    `,
    [postId],
  );

  return rows.map(mapPostImage);
}

async function withPostImages(post: Post) {
  return {
    ...post,
    post_images: await findPostImages(post.id),
  };
}

export async function isPostSlugTaken(slug: string, excludeId?: number) {
  const params: Array<string | number> = [slug];
  let query = 'SELECT id FROM posts WHERE slug = ?';

  if (excludeId) {
    query += ' AND id <> ?';
    params.push(excludeId);
  }

  query += ' LIMIT 1';

  const [rows] = await databasePool.query<DatabaseRow[]>(query, params);
  return rows.length > 0;
}

export async function categoryExists(categoryId: number) {
  const [rows] = await databasePool.query<DatabaseRow[]>(
    'SELECT id FROM categories WHERE id = ? LIMIT 1',
    [categoryId],
  );

  return rows.length > 0;
}

async function replacePostImages(
  connection: DatabaseConnection,
  postId: number,
  postImages: PostImage[] | undefined,
) {
  if (postImages === undefined) {
    return;
  }

  await connection.query('DELETE FROM post_images WHERE post_id = ?', [postId]);

  if (postImages.length === 0) {
    return;
  }

  await connection.query(
    `
      INSERT INTO post_images (post_id, image_url, alt_text, caption, sort_order)
      VALUES ?
    `,
    [
      postImages.map((image, index) => [
        postId,
        image.image_url,
        image.alt_text ?? null,
        image.caption ?? null,
        image.sort_order ?? index,
      ]),
    ],
  );
}

export async function createPost(input: Required<CreatePostInput> & { author_id: number }) {
  const connection = await databasePool.getConnection();
  const publishedAt = input.status === 'published' ? new Date() : null;

  try {
    await connection.beginTransaction();

    const [result] = await connection.query<DatabaseResult>(
      `
      INSERT INTO posts (
          title,
          slug,
          excerpt,
          content,
          cover_image_url,
          category_id,
          author_id,
          status,
          published_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `,
      [
        input.title,
        input.slug,
        input.excerpt,
        input.content,
        input.cover_image_url,
        input.category_id,
        input.author_id,
        input.status,
        publishedAt,
      ],
    );

    await replacePostImages(connection, result.insertId, input.post_images);
    await connection.commit();

    return findPostById(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

type UpdatePostRecord = Omit<Required<UpdatePostInput>, 'post_images'> & {
  published_at: Date | null;
  post_images?: PostImage[];
};

export async function updatePost(id: number, input: UpdatePostRecord) {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE posts
        SET
          title = ?,
          slug = ?,
          excerpt = ?,
          content = ?,
          cover_image_url = ?,
          category_id = ?,
          status = ?,
          published_at = ?
        WHERE id = ?
      `,
      [
        input.title,
        input.slug,
        input.excerpt,
        input.content,
        input.cover_image_url,
        input.category_id,
        input.status,
        input.published_at,
        id,
      ],
    );

    await replacePostImages(connection, id, input.post_images);
    await connection.commit();

    return findPostById(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deletePost(id: number) {
  const [result] = await databasePool.query<DatabaseResult>(
    'UPDATE posts SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  return result.affectedRows > 0;
}

export async function restorePost(id: number) {
  const [result] = await databasePool.query<DatabaseResult>(
    'UPDATE posts SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL',
    [id],
  );
  return result.affectedRows > 0;
}

export async function updatePostStatus(id: number, status: PostStatus) {
  if (status === 'published') {
    await databasePool.query(
      `
        UPDATE posts
        SET status = ?, published_at = COALESCE(published_at, NOW())
        WHERE id = ?
      `,
      [status, id],
    );
  } else {
    await databasePool.query(
      `
        UPDATE posts
        SET status = ?, published_at = published_at
        WHERE id = ?
      `,
      [status, id],
    );
  }

  return findPostById(id);
}


