import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  firstQueryValue,
  nullableStringValue,
  optionalString,
  positiveIntegerValue,
} from '../../validators/common.js';
import type {
  CreateEnrollmentInput,
  EndEnrollmentInput,
  EnrollmentStatus,
  ListEnrollmentsQuery,
  TransferEnrollmentInput,
} from './enrollment.types.js';

const statuses = new Set<EnrollmentStatus>([
  'active',
  'transferred',
  'reserved',
  'withdrawn',
  'graduated',
]);
const endStatuses = new Set<EndEnrollmentInput['status']>([
  'reserved',
  'withdrawn',
  'graduated',
]);

function dateValue(value: unknown, field: string) {
  const parsed = optionalString(value, field);
  if (!parsed || !/^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
    throw new HttpError(400, `${field} must use YYYY-MM-DD`);
  }
  const date = new Date(`${parsed}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== parsed) {
    throw new HttpError(400, `${field} must be a valid date`);
  }
  return parsed;
}

function noteValue(value: unknown) {
  const note = nullableStringValue(value, 'note');
  if (note && note.length > 1000) {
    throw new HttpError(400, 'note must not exceed 1000 characters');
  }
  return note;
}

export function validateEnrollmentId(value: string, field = 'id') {
  return positiveIntegerValue(value, field, true) as number;
}

export function validateListEnrollmentsQuery(
  query: Record<string, unknown>,
): ListEnrollmentsQuery {
  const rawStatus = optionalString(firstQueryValue(query.status), 'status');
  if (rawStatus && !statuses.has(rawStatus as EnrollmentStatus)) {
    throw new HttpError(400, 'status is invalid');
  }
  return {
    page: positiveIntegerValue(firstQueryValue(query.page), 'page') ?? 1,
    limit: Math.min(
      positiveIntegerValue(firstQueryValue(query.limit), 'limit') ?? 20,
      100,
    ),
    q: optionalString(firstQueryValue(query.q), 'q'),
    academic_year_id: positiveIntegerValue(
      firstQueryValue(query.academic_year_id),
      'academic_year_id',
    ),
    classroom_id: positiveIntegerValue(
      firstQueryValue(query.classroom_id),
      'classroom_id',
    ),
    status: rawStatus as EnrollmentStatus | undefined,
  };
}

export function validateCreateEnrollment(body: unknown): CreateEnrollmentInput {
  const input = asRecord(body);
  return {
    student_user_id: positiveIntegerValue(
      input.student_user_id,
      'student_user_id',
      true,
    ) as number,
    classroom_id: positiveIntegerValue(
      input.classroom_id,
      'classroom_id',
      true,
    ) as number,
    enrolled_at: dateValue(input.enrolled_at, 'enrolled_at'),
    note: noteValue(input.note),
  };
}

export function validateTransferEnrollment(
  body: unknown,
): TransferEnrollmentInput {
  const input = asRecord(body);
  return {
    target_classroom_id: positiveIntegerValue(
      input.target_classroom_id,
      'target_classroom_id',
      true,
    ) as number,
    effective_date: dateValue(input.effective_date, 'effective_date'),
    note: noteValue(input.note),
  };
}

export function validateEndEnrollment(body: unknown): EndEnrollmentInput {
  const input = asRecord(body);
  if (
    typeof input.status !== 'string' ||
    !endStatuses.has(input.status as EndEnrollmentInput['status'])
  ) {
    throw new HttpError(
      400,
      'status must be reserved, withdrawn, or graduated',
    );
  }
  return {
    status: input.status as EndEnrollmentInput['status'],
    effective_date: dateValue(input.effective_date, 'effective_date'),
    note: noteValue(input.note),
  };
}
