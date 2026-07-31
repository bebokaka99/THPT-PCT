import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  firstQueryValue,
  flexibleBoolean,
  optionalString,
  positiveIntegerValue,
  requiredString,
} from '../../validators/common.js';
import type {
  AcademicPeriodStatus,
  AcademicYearInput,
  ListAcademicPeriodsQuery,
  SemesterInput,
  UpdateAcademicYearInput,
  UpdateSemesterInput,
} from './academic-period.types.js';

const statuses = new Set<AcademicPeriodStatus>(['planned', 'active', 'closed']);

function dateValue(value: unknown, field: string, required: true): string;
function dateValue(
  value: unknown,
  field: string,
  required?: false,
): string | undefined;
function dateValue(value: unknown, field: string, required = false) {
  const parsed = optionalString(value, field);
  if (!parsed) {
    if (required) throw new HttpError(400, `${field} is required`);
    return undefined;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
    throw new HttpError(400, `${field} must use YYYY-MM-DD format`);
  }
  const [year, month, day] = parsed.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new HttpError(400, `${field} must be a valid date`);
  }
  return parsed;
}

function codeValue(value: unknown, required = false) {
  const parsed = optionalString(value, 'code');
  if (!parsed && required) throw new HttpError(400, 'code is required');
  if (parsed && parsed.length > 50) {
    throw new HttpError(400, 'code must not exceed 50 characters');
  }
  return parsed?.toUpperCase();
}

export function validateAcademicPeriodId(value: string, field = 'id') {
  return positiveIntegerValue(value, field, true) as number;
}

export function validateListAcademicPeriodsQuery(
  query: Record<string, unknown>,
): ListAcademicPeriodsQuery {
  const rawStatus = optionalString(firstQueryValue(query.status), 'status');
  if (rawStatus && !statuses.has(rawStatus as AcademicPeriodStatus)) {
    throw new HttpError(400, 'status must be planned, active, or closed');
  }
  return { status: rawStatus as AcademicPeriodStatus | undefined };
}

export function validateAcademicYear(body: unknown): AcademicYearInput {
  const input = asRecord(body);
  const name = requiredString(input.name, 'name');
  if (name.length > 20) {
    throw new HttpError(400, 'name must not exceed 20 characters');
  }
  return {
    name,
    start_date: dateValue(input.start_date, 'start_date', true),
    end_date: dateValue(input.end_date, 'end_date', true),
  };
}

export function validateAcademicYearUpdate(
  body: unknown,
): UpdateAcademicYearInput {
  const input = asRecord(body);
  const name = optionalString(input.name, 'name');
  if (name && name.length > 20) {
    throw new HttpError(400, 'name must not exceed 20 characters');
  }
  return {
    name,
    start_date: dateValue(input.start_date, 'start_date'),
    end_date: dateValue(input.end_date, 'end_date'),
  };
}

export function validateSemester(body: unknown): SemesterInput {
  const input = asRecord(body);
  return {
    name: requiredString(input.name, 'name'),
    code: codeValue(input.code, true) as string,
    start_date: dateValue(input.start_date, 'start_date', true),
    end_date: dateValue(input.end_date, 'end_date', true),
  };
}

export function validateSemesterUpdate(body: unknown): UpdateSemesterInput {
  const input = asRecord(body);
  return {
    name: optionalString(input.name, 'name'),
    code: codeValue(input.code),
    start_date: dateValue(input.start_date, 'start_date'),
    end_date: dateValue(input.end_date, 'end_date'),
  };
}

export function validateLockInput(body: unknown) {
  const input = asRecord(body);
  const isLocked = flexibleBoolean(input.is_locked, 'is_locked');
  if (isLocked === undefined) {
    throw new HttpError(400, 'is_locked is required');
  }
  return isLocked;
}

