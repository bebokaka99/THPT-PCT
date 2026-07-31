import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  firstQueryValue,
  optionalPositiveId,
  optionalQueryString as optionalString,
  parsePositiveInteger,
} from '../../validators/common.js';
import type {
  ConvertImportedContentInput,
  ImportedContentListQuery,
  ImportStatus,
  UpdateImportedContentStatusInput,
} from './importer.types.js';

const maxLimit = 50;
const importStatuses = new Set<ImportStatus>(['pending', 'imported', 'converted', 'skipped', 'error']);
const updateStatuses = new Set<UpdateImportedContentStatusInput['status']>([
  'pending',
  'imported',
  'converted',
  'skipped',
]);

export function validateListImportedContentsQuery(query: Record<string, unknown>): ImportedContentListQuery {
  const page = parsePositiveInteger(query.page, 1, 'page');
  const limit = Math.min(parsePositiveInteger(query.limit, 10, 'limit'), maxLimit);
  const status = optionalString(query.status, 'status');

  if (status && !importStatuses.has(status as ImportStatus)) {
    throw new HttpError(400, 'status must be pending, imported, converted, skipped, or error');
  }

  return {
    page,
    limit,
    q: optionalString(query.q, 'q'),
    category: optionalString(query.category, 'category'),
    status: status as ImportStatus | undefined,
  };
}

export function validateImportedContentId(value: string) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'Invalid imported content id');
  }

  return id;
}

export function validateUpdateImportedContentStatus(body: unknown): UpdateImportedContentStatusInput {
  const input = asRecord(body);

  if (typeof input.status !== 'string' || !updateStatuses.has(input.status as UpdateImportedContentStatusInput['status'])) {
    throw new HttpError(400, 'status must be pending, imported, converted, or skipped');
  }

  return {
    status: input.status as UpdateImportedContentStatusInput['status'],
  };
}

export function validateConvertImportedContent(body: unknown): ConvertImportedContentInput {
  const input = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const status = input.status ?? 'draft';

  if (status !== 'draft' && status !== 'published') {
    throw new HttpError(400, 'status must be draft or published');
  }

  return {
    category_id: optionalPositiveId(input.category_id, 'category_id'),
    status,
  };
}
