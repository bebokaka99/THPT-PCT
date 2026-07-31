import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  firstQueryValue,
  optionalString,
  parsePositiveInteger,
  positiveIntegerValue,
  requiredString,
} from '../../validators/common.js';
import type {
  AttendanceBulkInput,
  AttendanceListQuery,
  AttendanceSessionInput,
  AttendanceStatus,
} from './attendance.types.js';

const statuses: AttendanceStatus[] = [
  'present',
  'excused',
  'unexcused',
  'late',
];

function dateValue(value: unknown, field: string) {
  const parsed = requiredString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed) || Number.isNaN(Date.parse(parsed))) {
    throw new HttpError(400, `${field} must use YYYY-MM-DD`);
  }
  return parsed;
}

function statusValue(value: unknown, field: string) {
  if (typeof value !== 'string' || !statuses.includes(value as AttendanceStatus)) {
    throw new HttpError(400, `${field} must be one of: ${statuses.join(', ')}`);
  }
  return value as AttendanceStatus;
}

export function validateAttendanceId(value: unknown) {
  return positiveIntegerValue(value, 'id', true)!;
}

export function validateAttendanceSession(
  value: unknown,
): AttendanceSessionInput {
  const body = asRecord(value);
  const lessonIndex = Number(body.lesson_index ?? 0);
  if (!Number.isInteger(lessonIndex) || lessonIndex < 0 || lessonIndex > 20) {
    throw new HttpError(400, 'lesson_index must be an integer between 0 and 20');
  }
  return {
    classroom_id: positiveIntegerValue(
      body.classroom_id,
      'classroom_id',
      true,
    )!,
    semester_id: positiveIntegerValue(body.semester_id, 'semester_id', true)!,
    subject_id: positiveIntegerValue(body.subject_id, 'subject_id'),
    teaching_assignment_id: positiveIntegerValue(
      body.teaching_assignment_id,
      'teaching_assignment_id',
    ),
    session_date: dateValue(body.session_date, 'session_date'),
    lesson_index: lessonIndex,
    title: optionalString(body.title, 'title'),
  };
}

export function validateAttendanceBulk(value: unknown): AttendanceBulkInput {
  const body = asRecord(value);
  if (!Array.isArray(body.records) || body.records.length === 0) {
    throw new HttpError(400, 'records must be a non-empty array');
  }
  const records = body.records.map((raw, index) => {
    const record = asRecord(raw);
    return {
      student_user_id: positiveIntegerValue(
        record.student_user_id,
        `records[${index}].student_user_id`,
        true,
      )!,
      status: statusValue(record.status, `records[${index}].status`),
      note: optionalString(record.note, `records[${index}].note`),
    };
  });
  const ids = new Set(records.map((record) => record.student_user_id));
  if (ids.size !== records.length) {
    throw new HttpError(400, 'records must not contain duplicate students');
  }
  return {
    records,
    correction_reason: optionalString(
      body.correction_reason,
      'correction_reason',
    ),
  };
}

export function validateAttendanceListQuery(
  query: Record<string, unknown>,
): AttendanceListQuery {
  const page = parsePositiveInteger(query.page, 1, 'page');
  const limit = Math.min(parsePositiveInteger(query.limit, 20, 'limit'), 100);
  const fromValue = firstQueryValue(query.from);
  const toValue = firstQueryValue(query.to);
  return {
    page,
    limit,
    classroom_id: positiveIntegerValue(
      firstQueryValue(query.classroom_id),
      'classroom_id',
    ),
    semester_id: positiveIntegerValue(
      firstQueryValue(query.semester_id),
      'semester_id',
    ),
    from: fromValue ? dateValue(fromValue, 'from') : undefined,
    to: toValue ? dateValue(toValue, 'to') : undefined,
  };
}

