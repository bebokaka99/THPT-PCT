import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  firstQueryValue,
  optionalNullableString,
  optionalString,
  parsePositiveInteger,
  positiveIntegerValue,
} from '../../validators/common.js';
import type {
  GradebookCreateInput,
  GradebookListQuery,
  GradebookScoreBatchInput,
  GradebookStatus,
  GradeScoreState,
  StudentGradeQuery,
} from './gradebook.types.js';

const states: GradeScoreState[] = ['scored', 'absent', 'exempt'];
const statuses: GradebookStatus[] = [
  'draft',
  'submitted',
  'approved',
  'locked',
];

function scoreValue(value: unknown, field: string) {
  if (value === undefined || value === null || value === '') return null;
  const raw = typeof value === 'number' ? String(value) : value;
  if (typeof raw !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(raw.trim())) {
    throw new HttpError(400, `${field} must be a non-negative decimal with at most 2 places`);
  }
  return raw.trim();
}

export function validateGradebookId(value: unknown) {
  return positiveIntegerValue(value, 'id', true)!;
}

export function validateGradebookCreate(value: unknown): GradebookCreateInput {
  const body = asRecord(value);
  return {
    teaching_assignment_id: positiveIntegerValue(
      body.teaching_assignment_id,
      'teaching_assignment_id',
      true,
    )!,
  };
}

export function validateGradebookListQuery(
  query: Record<string, unknown>,
): GradebookListQuery {
  const rawStatus = firstQueryValue(query.status);
  if (
    rawStatus !== undefined &&
    (typeof rawStatus !== 'string' ||
      !statuses.includes(rawStatus as GradebookStatus))
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
    semester_id: positiveIntegerValue(
      firstQueryValue(query.semester_id),
      'semester_id',
    ),
    status: rawStatus as GradebookStatus | undefined,
  };
}

export function validateStudentGradeQuery(
  query: Record<string, unknown>,
): StudentGradeQuery {
  return {
    academic_year_id: positiveIntegerValue(
      firstQueryValue(query.academic_year_id),
      'academic_year_id',
    ),
    semester_id: positiveIntegerValue(
      firstQueryValue(query.semester_id),
      'semester_id',
    ),
    subject_id: positiveIntegerValue(
      firstQueryValue(query.subject_id),
      'subject_id',
    ),
  };
}

export function validateOptionalWorkflowReason(value: unknown) {
  const body = asRecord(value);
  return optionalNullableString(body.reason, 'reason')?.slice(0, 500) ?? null;
}

export function validateRequiredWorkflowReason(value: unknown) {
  const reason = validateOptionalWorkflowReason(value);
  if (!reason || reason.trim().length < 3) {
    throw new HttpError(400, 'reason must contain at least 3 characters');
  }
  return reason.trim();
}

export function validateGradebookScoreBatch(
  value: unknown,
): GradebookScoreBatchInput {
  const body = asRecord(value);
  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    throw new HttpError(400, 'entries must be a non-empty array');
  }
  if (body.entries.length > 5000) {
    throw new HttpError(400, 'entries cannot exceed 5000 items per request');
  }
  const seen = new Set<string>();
  const entries = body.entries.map((raw, index) => {
    const item = asRecord(raw);
    if (
      typeof item.state !== 'string' ||
      !states.includes(item.state as GradeScoreState)
    ) {
      throw new HttpError(
        400,
        `entries[${index}].state must be one of: ${states.join(', ')}`,
      );
    }
    const state = item.state as GradeScoreState;
    const score = scoreValue(item.score, `entries[${index}].score`);
    if (state === 'scored' && score === null) {
      throw new HttpError(400, `entries[${index}].score is required when state is scored`);
    }
    if (state !== 'scored' && score !== null) {
      throw new HttpError(400, `entries[${index}].score must be empty when state is ${state}`);
    }
    const studentUserId = positiveIntegerValue(
      item.student_user_id,
      `entries[${index}].student_user_id`,
      true,
    )!;
    const columnId = positiveIntegerValue(
      item.column_id,
      `entries[${index}].column_id`,
      true,
    )!;
    const expectedVersion = Number(item.expected_version);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
      throw new HttpError(
        400,
        `entries[${index}].expected_version must be a non-negative integer`,
      );
    }
    const key = `${studentUserId}:${columnId}`;
    if (seen.has(key)) {
      throw new HttpError(400, `Duplicate score entry for student ${studentUserId} and column ${columnId}`);
    }
    seen.add(key);
    return {
      student_user_id: studentUserId,
      column_id: columnId,
      state,
      score,
      expected_version: expectedVersion,
    };
  });
  return {
    entries,
    reason:
      optionalNullableString(body.reason, 'reason')?.slice(0, 500) ?? null,
  };
}
