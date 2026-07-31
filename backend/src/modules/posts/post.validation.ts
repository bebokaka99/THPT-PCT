import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  firstQueryValue,
  optionalNullableId,
  optionalNullableString,
  optionalString,
  parsePositiveInteger,
} from '../../validators/common.js';
import type {
  CreatePostInput,
  ListPostsQuery,
  PostImage,
  PostListStatus,
  PostStatus,
  UpdatePostInput,
} from './post.types.js';

const validStatuses = new Set<PostStatus>(['draft', 'published', 'archived']);
const validListStatuses = new Set<PostListStatus>(['draft', 'published', 'archived', 'deleted']);
const maxLimit = 50;
const allowedPostFields = new Set([
  'title',
  'slug',
  'excerpt',
  'content',
  'cover_image_url',
  'category_id',
  'status',
  'post_images',
]);

function optionalContent(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return '';
  }

  if (typeof value !== 'string') {
    throw new HttpError(400, 'content must be a string');
  }

  return value.trim();
}

function optionalStatus(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string' || !validStatuses.has(value as PostStatus)) {
    throw new HttpError(400, `Invalid post status "${String(value)}". Allowed values: draft, published, archived`);
  }

  return value as PostStatus;
}

function requiredImageUrl(value: unknown, field: string) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, `${field} must be a non-empty string`);
  }

  const trimmed = value.trim();

  if (!isAllowedImageUrl(trimmed)) {
    throw new HttpError(400, `${field} must be an http(s) URL or start with /uploads/`);
  }

  return trimmed;
}

function optionalSortOrder(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    throw new HttpError(400, 'post_images.sort_order must be a non-negative integer');
  }

  return numberValue;
}

function validatePostImages(value: unknown): PostImage[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new HttpError(400, 'post_images must be an array');
  }

  return value.map((item, index) => {
    if (typeof item !== 'object' || item === null) {
      throw new HttpError(400, 'Each post_images item must be an object');
    }

    const record = item as Record<string, unknown>;

    return {
      image_url: requiredImageUrl(record.image_url, 'post_images.image_url'),
      alt_text: optionalNullableString(record.alt_text, 'post_images.alt_text') ?? null,
      caption: optionalNullableString(record.caption, 'post_images.caption') ?? null,
      sort_order: optionalSortOrder(record.sort_order, index),
    };
  });
}

function isAllowedImageUrl(url: string) {
  if (url.startsWith('/uploads/')) {
    return true;
  }

  if (
    url.startsWith('file://') ||
    url.startsWith('./') ||
    url.startsWith('../') ||
    /^[a-zA-Z]:[\\/]/.test(url) ||
    url.includes('\\')
  ) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function ensureAllowedPostFields(input: Record<string, unknown>) {
  const unsupportedFields = Object.keys(input).filter((field) => !allowedPostFields.has(field));

  if (unsupportedFields.length > 0) {
    throw new HttpError(400, `Unsupported post field(s): ${unsupportedFields.join(', ')}`);
  }
}

export function validateListPostsQuery(query: Record<string, unknown>): ListPostsQuery {
  const page = parsePositiveInteger(query.page, 1, 'page');
  const limit = Math.min(parsePositiveInteger(query.limit, 10, 'limit'), maxLimit);
  const status = firstQueryValue(query.status) ?? 'published';

  if (status !== 'all' && (typeof status !== 'string' || !validListStatuses.has(status as PostListStatus))) {
    throw new HttpError(400, 'status must be all, draft, published, archived, or deleted');
  }

  const categorySlug = optionalString(firstQueryValue(query.categorySlug), 'categorySlug');
  const q = optionalString(firstQueryValue(query.q), 'q');

  return {
    page,
    limit,
    categorySlug,
    q,
    status: status === 'all' ? undefined : (status as PostListStatus),
  };
}

export function validateCreatePost(body: unknown): CreatePostInput {
  const input = asRecord(body);
  ensureAllowedPostFields(input);
  const title = optionalString(input.title, 'title');
  const content = optionalContent(input.content) ?? '';

  if (!title) {
    throw new HttpError(400, 'title is required');
  }

  return {
    title,
    slug: optionalString(input.slug, 'slug'),
    excerpt: optionalNullableString(input.excerpt, 'excerpt'),
    content,
    cover_image_url: optionalNullableString(input.cover_image_url, 'cover_image_url'),
    category_id: optionalNullableId(input.category_id, 'category_id'),
    status: optionalStatus(input.status),
    post_images: validatePostImages(input.post_images),
  };
}

export function validateUpdatePost(body: unknown): UpdatePostInput {
  const input = asRecord(body);
  ensureAllowedPostFields(input);

  return {
    title: optionalString(input.title, 'title'),
    slug: optionalString(input.slug, 'slug'),
    excerpt: optionalNullableString(input.excerpt, 'excerpt'),
    content: optionalContent(input.content),
    cover_image_url: optionalNullableString(input.cover_image_url, 'cover_image_url'),
    category_id: optionalNullableId(input.category_id, 'category_id'),
    status: optionalStatus(input.status),
    post_images: validatePostImages(input.post_images),
  };
}

export function validatePostId(value: string) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'Invalid post id');
  }

  return id;
}
