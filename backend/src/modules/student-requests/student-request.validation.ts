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
  StudentRequestCreateInput,
  StudentRequestListQuery,
  StudentRequestReviewerScope,
  StudentRequestStatus,
  StudentRequestTypeInput,
} from './student-request.types.js';

const statuses: StudentRequestStatus[] = [
  'draft',
  'pending',
  'in_review',
  'approved',
  'rejected',
  'cancelled',
];
const scopes: StudentRequestReviewerScope[] = ['homeroom', 'admin'];

export function validateStudentRequestId(value: unknown) {
  return positiveIntegerValue(value, 'id', true)!;
}

export function validateStudentRequestListQuery(
  query: Record<string, unknown>,
): StudentRequestListQuery {
  const rawStatus = firstQueryValue(query.status);
  if (
    rawStatus !== undefined &&
    (typeof rawStatus !== 'string' ||
      !statuses.includes(rawStatus as StudentRequestStatus))
  ) {
    throw new HttpError(400, `status must be one of: ${statuses.join(', ')}`);
  }
  return {
    page: parsePositiveInteger(query.page, 1, 'page'),
    limit: Math.min(parsePositiveInteger(query.limit, 20, 'limit'), 100),
    q: optionalString(firstQueryValue(query.q), 'q'),
    status: rawStatus as StudentRequestStatus | undefined,
    type_id: positiveIntegerValue(
      firstQueryValue(query.type_id),
      'type_id',
    ),
  };
}

export function validateStudentRequestCreate(
  value: unknown,
): StudentRequestCreateInput {
  const body = asRecord(value);
  if (
    body.form_data !== undefined &&
    (typeof body.form_data !== 'object' ||
      body.form_data === null ||
      Array.isArray(body.form_data))
  ) {
    throw new HttpError(400, 'form_data must be an object');
  }
  return {
    request_type_id: positiveIntegerValue(
      body.request_type_id,
      'request_type_id',
      true,
    )!,
    title: requiredString(body.title, 'title'),
    content: optionalNullableString(body.content, 'content') ?? '',
    form_data: (body.form_data as Record<string, unknown>) ?? {},
  };
}

export function validateStudentRequestType(
  value: unknown,
): StudentRequestTypeInput {
  const body = asRecord(value);
  const scope = requiredString(body.reviewer_scope, 'reviewer_scope');
  if (!scopes.includes(scope as StudentRequestReviewerScope)) {
    throw new HttpError(
      400,
      `reviewer_scope must be one of: ${scopes.join(', ')}`,
    );
  }
  const slaDays = Number(body.sla_days ?? 5);
  if (!Number.isInteger(slaDays) || slaDays < 1 || slaDays > 90) {
    throw new HttpError(400, 'sla_days must be an integer between 1 and 90');
  }
  if (
    body.form_schema !== undefined &&
    (typeof body.form_schema !== 'object' ||
      body.form_schema === null ||
      Array.isArray(body.form_schema))
  ) {
    throw new HttpError(400, 'form_schema must be an object');
  }
  return {
    code: requiredString(body.code, 'code').toUpperCase(),
    name: requiredString(body.name, 'name'),
    description:
      optionalNullableString(body.description, 'description') ?? null,
    instructions:
      optionalNullableString(body.instructions, 'instructions') ?? null,
    reviewer_scope: scope as StudentRequestReviewerScope,
    requires_attachment:
      flexibleBoolean(body.requires_attachment, 'requires_attachment') ?? false,
    sla_days: slaDays,
    form_schema: (body.form_schema as Record<string, unknown>) ?? {},
    is_active: flexibleBoolean(body.is_active, 'is_active') ?? true,
  };
}

export function validateDecisionReason(value: unknown) {
  const reason = requiredString(asRecord(value).reason, 'reason');
  if (reason.length < 3) {
    throw new HttpError(400, 'reason must contain at least 3 characters');
  }
  return reason;
}
