import { HttpError } from '../../utils/http-error.js';
import { slugify } from '../../utils/slug.js';
import { sanitizeRichHtml } from '../../utils/sanitize-html.js';
import {
  categoryExists,
  createPost as insertPost,
  deletePost as removePost,
  findPostById,
  findPosts,
  findPublishedPostBySlug,
  findPublishedPosts,
  isPostSlugTaken,
  restorePost as restorePostRecord,
  updatePost as patchPost,
  updatePostStatus,
} from './post.repository.js';
import type { CreatePostInput, ListPostsQuery, PostStatus, UpdatePostInput } from './post.types.js';

export async function listPosts(query: ListPostsQuery) {
  const { posts, total } = query.status === 'published' ? await findPublishedPosts(query) : await findPosts(query);

  return {
    data: posts,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getPostBySlug(slug: string) {
  const post = await findPublishedPostBySlug(slug);

  if (!post) {
    throw new HttpError(404, 'Post not found');
  }

  return post;
}

export async function getAdminPostById(id: number) {
  const post = await findPostById(id);

  if (!post) {
    throw new HttpError(404, 'Post not found');
  }

  return post;
}

async function ensureCategory(categoryId: number | null | undefined) {
  if (categoryId !== undefined && categoryId !== null && !(await categoryExists(categoryId))) {
    throw new HttpError(400, 'category_id does not exist');
  }
}

export async function createPost(input: CreatePostInput, authorId: number) {
  const slug = input.slug ?? slugify(input.title);

  if (!slug) {
    throw new HttpError(400, 'slug is invalid');
  }

  if (await isPostSlugTaken(slug)) {
    throw new HttpError(409, 'Post slug already exists');
  }

  await ensureCategory(input.category_id);

  const post = await insertPost({
    title: input.title,
    slug,
    excerpt: input.excerpt ?? null,
    content: sanitizeRichHtml(input.content),
    cover_image_url: input.cover_image_url ?? null,
    category_id: input.category_id ?? null,
    status: input.status ?? 'draft',
    author_id: authorId,
    post_images: input.post_images ?? [],
  });

  if (!post) {
    throw new HttpError(500, 'Failed to create post');
  }

  return post;
}

export async function updatePost(id: number, input: UpdatePostInput) {
  const existing = await findPostById(id);

  if (!existing) {
    throw new HttpError(404, 'Post not found');
  }

  const slug = input.slug ?? (input.title ? slugify(input.title) : existing.slug);

  if (!slug) {
    throw new HttpError(400, 'slug is invalid');
  }

  if (await isPostSlugTaken(slug, id)) {
    throw new HttpError(409, 'Post slug already exists');
  }

  await ensureCategory(input.category_id);

  const nextStatus = input.status ?? existing.status;
  const publishedAt =
    nextStatus === 'published' && existing.published_at === null ? new Date() : existing.published_at;

  const post = await patchPost(id, {
    title: input.title ?? existing.title,
    slug,
    excerpt: input.excerpt === undefined ? existing.excerpt : input.excerpt,
    content: input.content === undefined ? existing.content : sanitizeRichHtml(input.content),
    cover_image_url:
      input.cover_image_url === undefined ? existing.cover_image_url : input.cover_image_url,
    category_id: input.category_id === undefined ? existing.category_id : input.category_id,
    status: nextStatus,
    published_at: publishedAt,
    post_images: input.post_images,
  });

  if (!post) {
    throw new HttpError(500, 'Failed to update post');
  }

  return post;
}

export async function deletePost(id: number) {
  const deleted = await removePost(id);

  if (!deleted) {
    throw new HttpError(404, 'Post not found');
  }
}

export async function publishPost(id: number) {
  const existing = await findPostById(id);

  if (!existing) {
    throw new HttpError(404, 'Post not found');
  }

  return updatePostStatus(id, 'published');
}

export async function archivePost(id: number) {
  const existing = await findPostById(id);

  if (!existing) {
    throw new HttpError(404, 'Post not found');
  }

  return updatePostStatus(id, 'archived' satisfies PostStatus);
}

export async function restorePost(id: number) {
  const restored = await restorePostRecord(id);

  if (!restored) {
    throw new HttpError(404, 'Deleted post not found');
  }

  return getAdminPostById(id);
}
