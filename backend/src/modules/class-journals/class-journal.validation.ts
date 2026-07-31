import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  firstQueryValue,
  nullableStringValue,
  optionalPositiveId,
  parsePositiveInteger,
  positiveIntegerValue,
  requiredString,
} from '../../validators/common.js';
import type { ClassJournalInput, ClassJournalListQuery, ClassJournalStatus } from './class-journal.types.js';

const statuses: ClassJournalStatus[] = ['draft', 'completed', 'cancelled'];

function dateValue(value: unknown, field: string) {
  const parsed = requiredString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed) || Number.isNaN(Date.parse(parsed))) {
    throw new HttpError(400, `${field} must use YYYY-MM-DD`);
  }
  return parsed;
}

function statusValue(value: unknown, field = 'status'): ClassJournalStatus {
  if (typeof value !== 'string' || !statuses.includes(value as ClassJournalStatus)) {
    throw new HttpError(400, `${field} must be one of: ${statuses.join(', ')}`);
  }
  return value as ClassJournalStatus;
}

export function validateJournalId(value: unknown) {
  return positiveIntegerValue(value, 'id', true)!;
}

export function validateJournalInput(value: unknown): ClassJournalInput {
  const body = asRecord(value);
  return {
    timetable_item_id: positiveIntegerValue(body.timetable_item_id, 'timetable_item_id', true)!,
    journal_date: dateValue(body.journal_date, 'journal_date'),
    attendance_session_id: optionalPositiveId(body.attendance_session_id, 'attendance_session_id') ?? null,
    lesson_content: nullableStringValue(body.lesson_content, 'lesson_content') ?? null,
    class_comment: nullableStringValue(body.class_comment, 'class_comment') ?? null,
    progress_note: nullableStringValue(body.progress_note, 'progress_note') ?? null,
    homework: nullableStringValue(body.homework, 'homework') ?? null,
    status: statusValue(body.status ?? 'draft'),
    correction_reason: nullableStringValue(body.correction_reason, 'correction_reason') ?? null,
  };
}

export function validateJournalListQuery(query: Record<string, unknown>): ClassJournalListQuery {
  const from = firstQueryValue(query.from);
  const to = firstQueryValue(query.to);
  return {
    page: parsePositiveInteger(query.page, 1, 'page'),
    limit: Math.min(parsePositiveInteger(query.limit, 20, 'limit'), 100),
    classroom_id: optionalPositiveId(firstQueryValue(query.classroom_id), 'classroom_id'),
    semester_id: optionalPositiveId(firstQueryValue(query.semester_id), 'semester_id'),
    from: from ? dateValue(from, 'from') : undefined,
    to: to ? dateValue(to, 'to') : undefined,
    status: query.status === undefined || query.status === '' ? undefined : statusValue(firstQueryValue(query.status)),
  };
}

export function validateJournalDate(value: unknown) {
  return dateValue(value, 'date');
}
