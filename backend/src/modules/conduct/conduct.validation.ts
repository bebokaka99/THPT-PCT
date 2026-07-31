import { HttpError } from '../../utils/http-error.js';
import type {
  ConductListQuery,
  ConductRating,
  ConductUpsertInput,
} from './conduct.types.js';

const ratings = new Set<ConductRating>(['good', 'fair', 'pass', 'not_pass']);

function positiveId(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `${field} must be a positive integer`);
  }
  return parsed;
}

export function validateConductId(value: unknown) {
  return positiveId(value, 'id');
}

export function validateStudentId(value: unknown) {
  return positiveId(value, 'studentId');
}

export function validateOptionalSemesterId(value: unknown) {
  if (value === undefined || value === '') return undefined;
  return positiveId(value, 'semester_id');
}

export function validateConductListQuery(
  query: Record<string, unknown>,
): ConductListQuery {
  return {
    classroom_id: positiveId(query.classroom_id, 'classroom_id'),
    semester_id: positiveId(query.semester_id, 'semester_id'),
  };
}

function normalizedComment(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new HttpError(400, 'homeroom_comment must be a string');
  }
  const comment = value.trim();
  if (comment.length > 2000) {
    throw new HttpError(400, 'homeroom_comment must not exceed 2000 characters');
  }
  return comment || null;
}

export function validateConductUpsert(body: unknown): ConductUpsertInput {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, 'Request body is required');
  }
  const input = body as Record<string, unknown>;
  if (!ratings.has(input.rating as ConductRating)) {
    throw new HttpError(
      400,
      'rating must be one of: good, fair, pass, not_pass',
    );
  }
  return {
    semester_id: positiveId(input.semester_id, 'semester_id'),
    rating: input.rating as ConductRating,
    homeroom_comment: normalizedComment(input.homeroom_comment),
  };
}

export function validateOptionalReason(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const value = (body as Record<string, unknown>).reason;
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > 500) {
    throw new HttpError(400, 'reason must be a string up to 500 characters');
  }
  return value.trim();
}

export function validateRequiredReason(body: unknown) {
  const reason = validateOptionalReason(body);
  if (!reason || reason.length < 3) {
    throw new HttpError(400, 'reason must contain at least 3 characters');
  }
  return reason;
}
