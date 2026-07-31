import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  firstQueryValue,
  nullableStringValue,
  optionalString,
  positiveIntegerValue,
} from '../../validators/common.js';
import type {
  ListTeachingAssignmentsQuery,
  TeachingAssignmentInput,
  TeachingAssignmentRole,
  TeachingAssignmentStatus,
  TeachingAssignmentStatusInput,
  TeachingAssignmentUpdateInput,
} from './teaching-assignment.types.js';

const roles = new Set<TeachingAssignmentRole>(['primary', 'assistant']);
const statuses = new Set<TeachingAssignmentStatus>(['active', 'inactive']);

function roleValue(value: unknown, required = false) {
  const parsed = optionalString(value, 'role');
  if (!parsed && required) throw new HttpError(400, 'role is required');
  if (parsed && !roles.has(parsed as TeachingAssignmentRole)) {
    throw new HttpError(400, 'role must be primary or assistant');
  }
  return parsed as TeachingAssignmentRole | undefined;
}

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

export function validateTeachingAssignmentId(value: string, field = 'id') {
  return positiveIntegerValue(value, field, true) as number;
}

export function validateListTeachingAssignmentsQuery(
  query: Record<string, unknown>,
): ListTeachingAssignmentsQuery {
  const rawStatus = optionalString(firstQueryValue(query.status), 'status');
  if (rawStatus && !statuses.has(rawStatus as TeachingAssignmentStatus)) {
    throw new HttpError(400, 'status must be active or inactive');
  }
  return {
    page: positiveIntegerValue(firstQueryValue(query.page), 'page') ?? 1,
    limit: Math.min(
      positiveIntegerValue(firstQueryValue(query.limit), 'limit') ?? 20,
      100,
    ),
    q: optionalString(firstQueryValue(query.q), 'q'),
    teacher_user_id: positiveIntegerValue(
      firstQueryValue(query.teacher_user_id),
      'teacher_user_id',
    ),
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
    status: rawStatus as TeachingAssignmentStatus | undefined,
  };
}

export function validateTeachingAssignment(
  body: unknown,
): TeachingAssignmentInput {
  const input = asRecord(body);
  return {
    teacher_user_id: positiveIntegerValue(
      input.teacher_user_id,
      'teacher_user_id',
      true,
    ) as number,
    classroom_id: positiveIntegerValue(
      input.classroom_id,
      'classroom_id',
      true,
    ) as number,
    subject_id: positiveIntegerValue(
      input.subject_id,
      'subject_id',
      true,
    ) as number,
    semester_id: positiveIntegerValue(
      input.semester_id,
      'semester_id',
      true,
    ) as number,
    role: roleValue(input.role, true) as TeachingAssignmentRole,
    assigned_at: dateValue(input.assigned_at, 'assigned_at'),
    note: noteValue(input.note),
  };
}

export function validateTeachingAssignmentBulk(body: unknown) {
  const input = asRecord(body);
  if (!Array.isArray(input.assignments) || input.assignments.length === 0) {
    throw new HttpError(400, 'assignments must be a non-empty array');
  }
  if (input.assignments.length > 200) {
    throw new HttpError(400, 'bulk assignment is limited to 200 items');
  }
  return input.assignments.map(validateTeachingAssignment);
}

export function validateTeachingAssignmentUpdate(
  body: unknown,
): TeachingAssignmentUpdateInput {
  const input = asRecord(body);
  return {
    role: roleValue(input.role),
    note: noteValue(input.note),
  };
}

export function validateTeachingAssignmentStatus(
  body: unknown,
): TeachingAssignmentStatusInput {
  const input = asRecord(body);
  if (
    typeof input.status !== 'string' ||
    !statuses.has(input.status as TeachingAssignmentStatus)
  ) {
    throw new HttpError(400, 'status must be active or inactive');
  }
  return {
    status: input.status as TeachingAssignmentStatus,
    effective_date: dateValue(input.effective_date, 'effective_date'),
  };
}
