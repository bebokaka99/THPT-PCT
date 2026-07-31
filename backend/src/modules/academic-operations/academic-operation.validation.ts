import { HttpError } from '../../utils/http-error.js';
import {
  firstQueryValue,
  optionalString,
  positiveIntegerValue,
} from '../../validators/common.js';
import type {
  AcademicImportStatus,
  AcademicImportType,
  ImportJobListQuery,
  ReportFilters,
} from './academic-operation.types.js';

const importTypes = new Set<AcademicImportType>([
  'enrollments',
  'assignments',
  'attendance',
  'grades',
]);
const statuses = new Set<AcademicImportStatus>([
  'preview_ready',
  'committing',
  'completed',
  'failed',
]);

export function validateImportType(value: unknown): AcademicImportType {
  if (typeof value !== 'string' || !importTypes.has(value as AcademicImportType)) {
    throw new HttpError(
      400,
      'type must be enrollments, assignments, attendance, or grades',
    );
  }
  return value as AcademicImportType;
}

export function validateIdempotencyKey(value: unknown) {
  const key = optionalString(value, 'idempotency_key');
  if (!key || key.length < 8 || key.length > 120) {
    throw new HttpError(400, 'idempotency_key must contain 8 to 120 characters');
  }
  return key;
}

export function validateImportJobId(value: unknown) {
  return positiveIntegerValue(value, 'id', true)!;
}

export function validateImportJobList(
  query: Record<string, unknown>,
): ImportJobListQuery {
  const type = firstQueryValue(query.type);
  const status = firstQueryValue(query.status);
  return {
    page: positiveIntegerValue(firstQueryValue(query.page), 'page') ?? 1,
    limit: Math.min(
      positiveIntegerValue(firstQueryValue(query.limit), 'limit') ?? 20,
      100,
    ),
    type: type === undefined ? undefined : validateImportType(type),
    status:
      status === undefined
        ? undefined
        : typeof status === 'string' &&
            statuses.has(status as AcademicImportStatus)
          ? (status as AcademicImportStatus)
          : (() => {
              throw new HttpError(400, 'status is invalid');
            })(),
  };
}

export function validateReportFilters(
  query: Record<string, unknown>,
): ReportFilters {
  return {
    academic_year_id: positiveIntegerValue(
      firstQueryValue(query.academic_year_id),
      'academic_year_id',
    ),
    semester_id: positiveIntegerValue(
      firstQueryValue(query.semester_id),
      'semester_id',
    ),
    classroom_id: positiveIntegerValue(
      firstQueryValue(query.classroom_id),
      'classroom_id',
    ),
    subject_id: positiveIntegerValue(
      firstQueryValue(query.subject_id),
      'subject_id',
    ),
  };
}

export function requiredExportId(
  query: Record<string, unknown>,
  key: string,
) {
  return positiveIntegerValue(firstQueryValue(query[key]), key, true)!;
}

