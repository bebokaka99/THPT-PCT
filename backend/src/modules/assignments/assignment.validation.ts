import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  firstQueryValue,
  flexibleBoolean,
  optionalNullableString,
  optionalString,
  parsePositiveInteger,
  positiveIntegerValue,
  requiredString,
} from '../../validators/common.js';
import type {
  AssignmentAttachmentInput,
  AssignmentInput,
  AssignmentListQuery,
  AssignmentStatus,
  AssignmentUpdateInput,
  SubmissionInput,
} from './assignment.types.js';

const statuses: AssignmentStatus[] = ['draft', 'published', 'closed'];

function timestampValue(value: unknown, field: string) {
  const raw = requiredString(value, field);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, `${field} must be a valid ISO timestamp`);
  }
  return parsed.toISOString();
}

function fileUrl(value: unknown, field: string) {
  const raw = requiredString(value, field);
  if (!/^https?:\/\//i.test(raw) && !raw.startsWith('/uploads/')) {
    throw new HttpError(
      400,
      `${field} must be an http(s) URL or an /uploads/ path`,
    );
  }
  return raw;
}

function attachmentsValue(value: unknown): AssignmentAttachmentInput[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'attachments must be an array');
  }
  return value.map((raw, index) => {
    const item = asRecord(raw);
    const size =
      item.size === undefined || item.size === null ? null : Number(item.size);
    if (size !== null && (!Number.isInteger(size) || size < 0)) {
      throw new HttpError(400, `attachments[${index}].size must be non-negative`);
    }
    return {
      media_file_id:
        item.media_file_id === null
          ? null
          : positiveIntegerValue(
              item.media_file_id,
              `attachments[${index}].media_file_id`,
            ),
      file_url: fileUrl(item.file_url, `attachments[${index}].file_url`),
      original_name:
        optionalNullableString(
          item.original_name,
          `attachments[${index}].original_name`,
        ) ?? null,
      mime_type:
        optionalNullableString(
          item.mime_type,
          `attachments[${index}].mime_type`,
        ) ?? null,
      size,
      sort_order: index,
    };
  });
}

export function validateAssignmentId(value: unknown) {
  return positiveIntegerValue(value, 'id', true)!;
}

export function validateAssignmentCreate(value: unknown): AssignmentInput {
  const body = asRecord(value);
  return {
    teaching_assignment_id: positiveIntegerValue(
      body.teaching_assignment_id,
      'teaching_assignment_id',
      true,
    )!,
    title: requiredString(body.title, 'title'),
    description: optionalNullableString(body.description, 'description') ?? null,
    due_at: timestampValue(body.due_at, 'due_at'),
    allow_late: flexibleBoolean(body.allow_late, 'allow_late') ?? false,
    attachments: attachmentsValue(body.attachments),
  };
}

export function validateAssignmentUpdate(
  value: unknown,
): AssignmentUpdateInput {
  const body = asRecord(value);
  const result: AssignmentUpdateInput = {};
  if (body.title !== undefined) result.title = requiredString(body.title, 'title');
  if (body.description !== undefined) {
    result.description =
      optionalNullableString(body.description, 'description') ?? null;
  }
  if (body.due_at !== undefined) {
    result.due_at = timestampValue(body.due_at, 'due_at');
  }
  if (body.allow_late !== undefined) {
    result.allow_late = flexibleBoolean(body.allow_late, 'allow_late')!;
  }
  result.attachments = attachmentsValue(body.attachments);
  if (Object.keys(result).length === 0) {
    throw new HttpError(400, 'At least one assignment field is required');
  }
  return result;
}

export function validateAssignmentListQuery(
  query: Record<string, unknown>,
): AssignmentListQuery {
  const rawStatus = firstQueryValue(query.status);
  if (
    rawStatus !== undefined &&
    (typeof rawStatus !== 'string' ||
      !statuses.includes(rawStatus as AssignmentStatus))
  ) {
    throw new HttpError(400, `status must be one of: ${statuses.join(', ')}`);
  }
  return {
    page: parsePositiveInteger(query.page, 1, 'page'),
    limit: Math.min(parsePositiveInteger(query.limit, 20, 'limit'), 100),
    q: optionalString(firstQueryValue(query.q), 'q'),
    classroom_id: positiveIntegerValue(
      firstQueryValue(query.classroom_id),
      'classroom_id',
    ),
    subject_id: positiveIntegerValue(
      firstQueryValue(query.subject_id),
      'subject_id',
    ),
    semester_id: positiveIntegerValue(
      firstQueryValue(query.semester_id),
      'semester_id',
    ),
    status: rawStatus as AssignmentStatus | undefined,
  };
}

export function validateSubmission(value: unknown): SubmissionInput {
  if (value === undefined || value === null || value === '') return {};
  const body = asRecord(value);
  return {
    note: optionalNullableString(body.note, 'note') ?? null,
  };
}
