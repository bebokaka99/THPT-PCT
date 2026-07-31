import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  firstQueryValue,
  optionalNonNegativeInteger as optionalPositiveInteger,
  optionalNullableString,
  optionalString,
  parsePositiveInteger,
} from '../../validators/common.js';
import type {
  CreateDocumentInput,
  DocumentListStatus,
  DocumentStatus,
  ListDocumentsQuery,
  UpdateDocumentInput,
} from './document.types.js';

const validStatuses = new Set<DocumentStatus>(['draft', 'published', 'archived']);
const validListStatuses = new Set<DocumentListStatus>(['draft', 'published', 'archived', 'deleted']);
const maxLimit = 50;

function optionalStatus(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string' || !validStatuses.has(value as DocumentStatus)) {
    throw new HttpError(400, 'status must be draft, published, or archived');
  }

  return value as DocumentStatus;
}

export function validateListDocumentsQuery(query: Record<string, unknown>): ListDocumentsQuery {
  const page = parsePositiveInteger(query.page, 1, 'page');
  const limit = Math.min(parsePositiveInteger(query.limit, 10, 'limit'), maxLimit);
  const status = firstQueryValue(query.status) ?? 'published';

  if (status !== 'all' && (typeof status !== 'string' || !validListStatuses.has(status as DocumentListStatus))) {
    throw new HttpError(400, 'status must be all, draft, published, archived, or deleted');
  }

  return {
    page,
    limit,
    q: optionalString(firstQueryValue(query.q), 'q'),
    category: optionalString(firstQueryValue(query.category), 'category'),
    status: status === 'all' ? undefined : (status as DocumentListStatus),
  };
}

export function validateCreateDocument(body: unknown): CreateDocumentInput {
  const input = asRecord(body);
  const title = optionalString(input.title, 'title');
  const documentUrl = optionalString(input.document_url, 'document_url');

  if (!title) {
    throw new HttpError(400, 'title is required');
  }

  if (!documentUrl) {
    throw new HttpError(400, 'document_url is required');
  }

  return {
    title,
    slug: optionalString(input.slug, 'slug'),
    description: optionalNullableString(input.description, 'description'),
    category: optionalNullableString(input.category, 'category'),
    document_url: documentUrl,
    file_type: optionalNullableString(input.file_type, 'file_type'),
    file_size: optionalPositiveInteger(input.file_size, 'file_size'),
    status: optionalStatus(input.status),
  };
}

export function validateUpdateDocument(body: unknown): UpdateDocumentInput {
  const input = asRecord(body);

  return {
    title: optionalString(input.title, 'title'),
    slug: optionalString(input.slug, 'slug'),
    description: optionalNullableString(input.description, 'description'),
    category: optionalNullableString(input.category, 'category'),
    document_url: optionalString(input.document_url, 'document_url'),
    file_type: optionalNullableString(input.file_type, 'file_type'),
    file_size: optionalPositiveInteger(input.file_size, 'file_size'),
    status: optionalStatus(input.status),
  };
}

export function validateDocumentId(value: string) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'Invalid document id');
  }

  return id;
}
