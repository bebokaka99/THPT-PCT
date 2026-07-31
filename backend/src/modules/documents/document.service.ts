import path from 'node:path';
import { HttpError } from '../../utils/http-error.js';
import { slugify } from '../../utils/slug.js';
import {
  createDocument as insertDocument,
  deleteDocument as removeDocument,
  findDocumentById,
  findDocuments,
  findPublishedDocumentBySlug,
  findPublishedDocuments,
  isDocumentSlugTaken,
  restoreDocument as restoreDocumentRecord,
  updateDocument as patchDocument,
  updateDocumentStatus,
} from './document.repository.js';
import type {
  CreateDocumentInput,
  DocumentStatus,
  ListDocumentsQuery,
  UpdateDocumentInput,
} from './document.types.js';

export async function listDocuments(query: ListDocumentsQuery) {
  const { documents, total } =
    query.status === 'published' ? await findPublishedDocuments(query) : await findDocuments(query);

  return {
    data: documents,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getDocumentBySlug(slug: string) {
  const document = await findPublishedDocumentBySlug(slug);

  if (!document) {
    throw new HttpError(404, 'Document not found');
  }

  return document;
}

export async function getAdminDocumentById(id: number) {
  const document = await findDocumentById(id);

  if (!document) {
    throw new HttpError(404, 'Document not found');
  }

  return document;
}

function inferFileType(documentUrl: string, fileType?: string | null) {
  if (fileType) {
    return fileType;
  }

  const extension = path.extname(documentUrl.split('?')[0] ?? '').replace('.', '').toLowerCase();
  return extension || null;
}

export async function createDocument(input: CreateDocumentInput, uploadedBy: number) {
  const slug = input.slug ?? slugify(input.title);

  if (!slug) {
    throw new HttpError(400, 'slug is invalid');
  }

  if (await isDocumentSlugTaken(slug)) {
    throw new HttpError(409, 'Document slug already exists');
  }

  const document = await insertDocument({
    title: input.title,
    slug,
    description: input.description ?? null,
    category: input.category ?? null,
    document_url: input.document_url,
    file_type: inferFileType(input.document_url, input.file_type),
    file_size: input.file_size ?? 0,
    status: input.status ?? 'draft',
    uploaded_by: uploadedBy,
  });

  if (!document) {
    throw new HttpError(500, 'Failed to create document');
  }

  return document;
}

export async function updateDocument(id: number, input: UpdateDocumentInput) {
  const existing = await findDocumentById(id);

  if (!existing) {
    throw new HttpError(404, 'Document not found');
  }

  const slug = input.slug ?? (input.title ? slugify(input.title) : existing.slug);

  if (!slug) {
    throw new HttpError(400, 'slug is invalid');
  }

  if (await isDocumentSlugTaken(slug, id)) {
    throw new HttpError(409, 'Document slug already exists');
  }

  const nextStatus = input.status ?? existing.status;
  const publishedAt =
    nextStatus === 'published' && existing.published_at === null ? new Date() : existing.published_at;
  const documentUrl = input.document_url ?? existing.document_url;

  const document = await patchDocument(id, {
    title: input.title ?? existing.title,
    slug,
    description: input.description === undefined ? existing.description : input.description,
    category: input.category === undefined ? existing.category : input.category,
    document_url: documentUrl,
    file_type: input.file_type === undefined ? existing.file_type : inferFileType(documentUrl, input.file_type),
    file_size: input.file_size === undefined ? existing.file_size : input.file_size,
    status: nextStatus,
    published_at: publishedAt,
  });

  if (!document) {
    throw new HttpError(500, 'Failed to update document');
  }

  return document;
}

export async function deleteDocument(id: number) {
  const deleted = await removeDocument(id);

  if (!deleted) {
    throw new HttpError(404, 'Document not found');
  }
}

export async function publishDocument(id: number) {
  const existing = await findDocumentById(id);

  if (!existing) {
    throw new HttpError(404, 'Document not found');
  }

  return updateDocumentStatus(id, 'published' satisfies DocumentStatus);
}

export async function archiveDocument(id: number) {
  const existing = await findDocumentById(id);

  if (!existing) {
    throw new HttpError(404, 'Document not found');
  }

  return updateDocumentStatus(id, 'archived' satisfies DocumentStatus);
}

export async function restoreDocument(id: number) {
  const restored = await restoreDocumentRecord(id);

  if (!restored) {
    throw new HttpError(404, 'Deleted document not found');
  }

  return getAdminDocumentById(id);
}
