import { HttpError } from '../../utils/http-error.js';
import { slugify } from '../../utils/slug.js';
import { sanitizeRichHtml } from '../../utils/sanitize-html.js';
import { createPost } from '../posts/post.service.js';
import {
  findImportedContentById,
  findImportedContents,
  markImportedContentConverted,
  updateImportedContentStatus as updateStatusRecord,
} from './importer.repository.js';
import type {
  ConvertImportedContentInput,
  ImportedContentListQuery,
  UpdateImportedContentStatusInput,
} from './importer.types.js';

export async function listImportedContents(query: ImportedContentListQuery) {
  const { items, total } = await findImportedContents(query);

  return {
    data: items,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getImportedContent(id: number) {
  const item = await findImportedContentById(id);

  if (!item) {
    throw new HttpError(404, 'Imported content not found');
  }

  return item;
}

export async function updateImportedContentStatus(id: number, input: UpdateImportedContentStatusInput) {
  const existing = await getImportedContent(id);

  if (existing.import_status === 'converted' && input.status !== 'converted') {
    throw new HttpError(400, 'Converted content cannot be moved back to another status');
  }

  const updated = await updateStatusRecord(id, input.status);

  if (!updated) {
    throw new HttpError(404, 'Imported content not found');
  }

  return getImportedContent(id);
}

export async function convertImportedContentToPost(
  id: number,
  input: ConvertImportedContentInput,
  authorId: number,
) {
  const item = await getImportedContent(id);

  if (item.imported_post_id || item.import_status === 'converted') {
    throw new HttpError(409, 'Imported content is already converted to a post');
  }

  const content = sanitizeImportedContentHtml(item.content_html || item.content_text || '', item.source_url);
  const postImages = pickPostImages(item.images_json);

  const post = await createPost(
    {
      title: item.title,
      slug: `${slugify(item.slug || item.title)}-import-${item.id}`,
      excerpt: item.excerpt,
      content,
      cover_image_url: pickCoverImage(item.images_json),
      category_id: input.category_id ?? null,
      status: input.status ?? 'draft',
      post_images: postImages,
    },
    authorId,
  );

  const updated = await markImportedContentConverted(id, post.id);

  return {
    importedContent: updated,
    post,
  };
}

function pickCoverImage(imagesJson: string | null) {
  if (!imagesJson) {
    return null;
  }

  try {
    const images = JSON.parse(imagesJson) as unknown;
    if (!Array.isArray(images)) {
      return null;
    }

    const firstValidImage = images.find((image): image is string => typeof image === 'string' && isValidPostImageUrl(image));
    return firstValidImage ?? null;
  } catch {
    return null;
  }
}

function pickPostImages(imagesJson: string | null) {
  if (!imagesJson) {
    return [];
  }

  try {
    const images = JSON.parse(imagesJson) as unknown;
    if (!Array.isArray(images)) {
      return [];
    }

    return images
      .filter((image): image is string => typeof image === 'string' && isValidPostImageUrl(image))
      .map((imageUrl, index) => ({
        image_url: imageUrl,
        alt_text: null,
        caption: null,
        sort_order: index,
      }));
  } catch {
    return [];
  }
}

export function isValidHttpUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function sanitizeImportedContentHtml(contentHtml: string, sourceUrl: string) {
  return sanitizeRichHtml(contentHtml.replace(/<img\b[^>]*>/gi, (imageTag) => {
    const srcMatch = imageTag.match(/\ssrc=(["'])(.*?)\1/i) ?? imageTag.match(/\ssrc=([^\s>]+)/i);
    if (!srcMatch) {
      return imageTag;
    }

    const rawSrc = srcMatch[2] ?? srcMatch[1];

    if (!rawSrc) {
      return imageTag;
    }

    const nextSrc = normalizeImportedImageSrc(rawSrc, sourceUrl);

    if (!nextSrc) {
      return imageTag.replace(/\ssrc=(["']).*?\1/i, '').replace(/\ssrc=[^\s>]+/i, '');
    }

    if (srcMatch?.[2]) {
      return imageTag.replace(srcMatch[0], ` src="${nextSrc}"`);
    }

    return imageTag.replace(srcMatch[0], ` src="${nextSrc}"`);
  }));
}

function normalizeImportedImageSrc(rawSrc: string, sourceUrl: string) {
  const trimmedSrc = rawSrc.trim();

  if (!trimmedSrc || isLocalOrChromeSavedImagePath(trimmedSrc)) {
    return null;
  }

  if (isValidHttpUrl(trimmedSrc)) {
    return trimmedSrc;
  }

  try {
    const absoluteUrl = new URL(trimmedSrc, sourceUrl).toString();
    return isLocalOrChromeSavedImagePath(absoluteUrl) || !isValidHttpUrl(absoluteUrl) ? null : absoluteUrl;
  } catch {
    return null;
  }
}

function isValidPostImageUrl(url: string) {
  return (isValidHttpUrl(url) || url.startsWith('/uploads/')) && !isLocalOrChromeSavedImagePath(url);
}

function isLocalOrChromeSavedImagePath(url: string) {
  const normalizedUrl = url.trim().toLowerCase();

  return (
    normalizedUrl.startsWith('file:') ||
    normalizedUrl.startsWith('data:') ||
    normalizedUrl.includes('\\') ||
    normalizedUrl.includes('_files/') ||
    normalizedUrl.includes('_files%2f') ||
    normalizedUrl.startsWith('./') ||
    normalizedUrl.startsWith('../')
  );
}
