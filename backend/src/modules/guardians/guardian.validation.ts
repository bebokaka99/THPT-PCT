import { HttpError } from '../../utils/http-error.js';
import type {
  GuardianInviteInput,
  GuardianLinkQuery,
  GuardianLinkStatus,
  GuardianPreferencesInput,
} from './guardian.types.js';

const statuses = new Set<GuardianLinkStatus>([
  'pending',
  'verified',
  'revoked',
]);

function positiveId(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `${field} must be a positive integer`);
  }
  return parsed;
}

export function validateGuardianLinkId(value: unknown) {
  return positiveId(value, 'id');
}

export function validateGuardianStudentId(value: unknown) {
  return positiveId(value, 'studentId');
}

export function validateGuardianSemesterId(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  return positiveId(value, 'semester_id');
}

export function validateGuardianLinkQuery(
  query: Record<string, unknown>,
): GuardianLinkQuery {
  const page = query.page === undefined ? 1 : positiveId(query.page, 'page');
  const limit = Math.min(
    query.limit === undefined ? 20 : positiveId(query.limit, 'limit'),
    50,
  );
  const q =
    typeof query.q === 'string' && query.q.trim()
      ? query.q.trim().slice(0, 200)
      : undefined;
  const status =
    typeof query.status === 'string' && query.status
      ? (query.status as GuardianLinkStatus)
      : undefined;
  if (status && !statuses.has(status)) {
    throw new HttpError(400, 'status must be pending, verified, or revoked');
  }
  return { page, limit, q, status };
}

export function validateGuardianInvite(body: unknown): GuardianInviteInput {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, 'Request body is required');
  }
  const input = body as Record<string, unknown>;
  if (typeof input.relationship !== 'string' || !input.relationship.trim()) {
    throw new HttpError(400, 'relationship is required');
  }
  const relationship = input.relationship.trim();
  if (relationship.length > 80) {
    throw new HttpError(400, 'relationship must not exceed 80 characters');
  }
  return {
    guardian_user_id: positiveId(input.guardian_user_id, 'guardian_user_id'),
    student_user_id: positiveId(input.student_user_id, 'student_user_id'),
    relationship,
  };
}

export function validateGuardianReason(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const reason = (body as Record<string, unknown>).reason;
  if (reason === undefined || reason === null || reason === '') return null;
  if (typeof reason !== 'string' || reason.trim().length > 500) {
    throw new HttpError(400, 'reason must be a string up to 500 characters');
  }
  return reason.trim() || null;
}

export function validateGuardianPreferences(
  body: unknown,
): GuardianPreferencesInput {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, 'Request body is required');
  }
  const source = body as Record<string, unknown>;
  const fields = [
    'in_app_enabled',
    'attendance_enabled',
    'grades_enabled',
    'conduct_enabled',
  ] as const;
  const result: GuardianPreferencesInput = {};
  for (const field of fields) {
    if (source[field] === undefined) continue;
    if (typeof source[field] !== 'boolean') {
      throw new HttpError(400, `${field} must be a boolean`);
    }
    result[field] = source[field];
  }
  if (Object.keys(result).length === 0) {
    throw new HttpError(400, 'At least one preference is required');
  }
  return result;
}
