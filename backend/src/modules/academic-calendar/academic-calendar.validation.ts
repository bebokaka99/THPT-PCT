import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  firstQueryValue,
  flexibleBoolean,
  optionalNullableString,
  optionalString,
  positiveIntegerValue,
  requiredString,
} from '../../validators/common.js';
import type {
  AcademicCalendarEntryStatus,
  AcademicCalendarEntryType,
  AcademicCalendarInput,
  AcademicCalendarListQuery,
  AcademicCalendarUpdateInput,
} from './academic-calendar.types.js';

const entryTypes = new Set<AcademicCalendarEntryType>([
  'test', 'exam', 'make_up', 'no_school', 'deadline',
]);
const statuses = new Set<AcademicCalendarEntryStatus>([
  'draft', 'proposed', 'published', 'archived',
]);
const zonedTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function entryTypeValue(value: unknown, required = true) {
  const parsed = optionalString(value, 'entry_type');
  if (!parsed && !required) return undefined;
  if (!parsed || !entryTypes.has(parsed as AcademicCalendarEntryType)) {
    throw new HttpError(400, 'entry_type must be test, exam, make_up, no_school, or deadline');
  }
  return parsed as AcademicCalendarEntryType;
}

function timestampValue(value: unknown, field: string, required = true) {
  const parsed = optionalString(value, field);
  if (!parsed && !required) return undefined;
  if (!parsed || !zonedTimestamp.test(parsed) || Number.isNaN(Date.parse(parsed))) {
    throw new HttpError(400, `${field} must be an ISO timestamp with timezone`);
  }
  return parsed;
}

function dateQueryValue(value: unknown, field: string) {
  const parsed = optionalString(firstQueryValue(value), field);
  if (!parsed) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed) || Number.isNaN(Date.parse(`${parsed}T00:00:00Z`))) {
    throw new HttpError(400, `${field} must use YYYY-MM-DD`);
  }
  return parsed;
}

function commonInput(body: Record<string, unknown>, partial: boolean) {
  const result: AcademicCalendarUpdateInput = {
    academic_year_id: positiveIntegerValue(body.academic_year_id, 'academic_year_id'),
    semester_id: body.semester_id === null ? null : positiveIntegerValue(body.semester_id, 'semester_id'),
    teaching_assignment_id: body.teaching_assignment_id === null ? null : positiveIntegerValue(body.teaching_assignment_id, 'teaching_assignment_id'),
    entry_type: entryTypeValue(body.entry_type, !partial),
    title: partial ? optionalString(body.title, 'title') : requiredString(body.title, 'title'),
    description: optionalNullableString(body.description, 'description'),
    starts_at: timestampValue(body.starts_at, 'starts_at', !partial),
    ends_at: timestampValue(body.ends_at, 'ends_at', !partial),
    all_day: flexibleBoolean(body.all_day, 'all_day') ?? (partial ? undefined : false),
    room: optionalNullableString(body.room, 'room'),
  };
  if (result.title && result.title.length > 255) throw new HttpError(400, 'title must not exceed 255 characters');
  if (result.room && result.room.length > 100) throw new HttpError(400, 'room must not exceed 100 characters');
  if (result.starts_at && result.ends_at && Date.parse(result.ends_at) <= Date.parse(result.starts_at)) {
    throw new HttpError(400, 'ends_at must be after starts_at');
  }
  return result;
}

export function validateAcademicCalendarId(value: string, field = 'id') {
  return positiveIntegerValue(value, field, true) as number;
}

export function validateAcademicCalendarCreate(body: unknown): AcademicCalendarInput {
  return commonInput(asRecord(body), false) as AcademicCalendarInput;
}

export function validateAcademicCalendarUpdate(body: unknown): AcademicCalendarUpdateInput {
  return commonInput(asRecord(body), true);
}

export function validateAcademicCalendarListQuery(query: Record<string, unknown>): AcademicCalendarListQuery {
  const rawType = optionalString(firstQueryValue(query.entry_type), 'entry_type');
  const rawStatus = optionalString(firstQueryValue(query.status), 'status');
  if (rawType && !entryTypes.has(rawType as AcademicCalendarEntryType)) throw new HttpError(400, 'Invalid entry_type');
  if (rawStatus && !statuses.has(rawStatus as AcademicCalendarEntryStatus)) throw new HttpError(400, 'Invalid status');
  return {
    page: positiveIntegerValue(firstQueryValue(query.page), 'page') ?? 1,
    limit: Math.min(positiveIntegerValue(firstQueryValue(query.limit), 'limit') ?? 20, 100),
    q: optionalString(firstQueryValue(query.q), 'q'),
    entry_type: rawType as AcademicCalendarEntryType | undefined,
    status: rawStatus as AcademicCalendarEntryStatus | undefined,
    classroom_id: positiveIntegerValue(firstQueryValue(query.classroom_id), 'classroom_id'),
    subject_id: positiveIntegerValue(firstQueryValue(query.subject_id), 'subject_id'),
    academic_year_id: positiveIntegerValue(firstQueryValue(query.academic_year_id), 'academic_year_id'),
    semester_id: positiveIntegerValue(firstQueryValue(query.semester_id), 'semester_id'),
    student_id: positiveIntegerValue(firstQueryValue(query.student_id), 'student_id'),
    from: dateQueryValue(query.from, 'from'),
    to: dateQueryValue(query.to, 'to'),
  };
}
