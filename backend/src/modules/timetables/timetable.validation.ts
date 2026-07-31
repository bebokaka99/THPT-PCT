import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  flexibleBoolean,
  nullableStringValue as stringValue,
  positiveIntegerValue as intValue,
} from '../../validators/common.js';
import type {
  BellPeriod,
  SchoolShiftInput,
  TimetableInput,
  TimetableItem,
  TimetableStatus,
} from './timetable.types.js';

const statuses = new Set<TimetableStatus>(['draft', 'published', 'archived']);

export function validateId(value: string, field = 'id') {
  return intValue(value, field, true) as number;
}

function validateStatus(value: unknown, fallback: TimetableStatus) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string' || !statuses.has(value as TimetableStatus)) {
    throw new HttpError(400, 'status must be draft, published, or archived');
  }
  return value as TimetableStatus;
}

function validateItem(raw: unknown): TimetableItem {
  const item = asRecord(raw);
  const dayOfWeek = intValue(item.day_of_week, 'day_of_week', true) as number;
  const lessonIndex = intValue(item.lesson_index, 'lesson_index', true) as number;
  // Legacy clients created before shift support are assigned to the first
  // configured active shift by the service.
  const shiftId = intValue(item.shift_id, 'shift_id') ?? 0;
  if (dayOfWeek < 1 || dayOfWeek > 7) {
    throw new HttpError(400, 'day_of_week must be from 1 to 7');
  }
  if (lessonIndex < 1 || lessonIndex > 20) {
    throw new HttpError(400, 'lesson_index must be from 1 to 20');
  }
  return {
    day_of_week: dayOfWeek,
    lesson_index: lessonIndex,
    shift_id: shiftId,
    subject_id: item.subject_id === null
      ? null
      : intValue(item.subject_id, 'subject_id') ?? null,
    teaching_assignment_id: item.teaching_assignment_id === null
      ? null
      : intValue(item.teaching_assignment_id, 'teaching_assignment_id') ?? null,
    subject_name: stringValue(item.subject_name, 'subject_name', true) as string,
    teacher_name: stringValue(item.teacher_name, 'teacher_name') ?? null,
    room: stringValue(item.room, 'room') ?? null,
    note: stringValue(item.note, 'note') ?? null,
  };
}

export function validateTimetable(body: unknown): TimetableInput {
  const input = asRecord(body);
  const rawItems = Array.isArray(input.items) ? input.items : [];
  const academicYearId = intValue(input.academic_year_id, 'academic_year_id');
  const schoolYear = stringValue(input.school_year, 'school_year') ?? undefined;
  if (!academicYearId && !schoolYear) {
    throw new HttpError(400, 'academic_year_id is required');
  }
  const legacyActive = flexibleBoolean(input.is_active, 'is_active');
  return {
    school_year: schoolYear as string | undefined,
    semester: stringValue(input.semester, 'semester') ?? null,
    academic_year_id: academicYearId,
    semester_id: input.semester_id === null
      ? null
      : intValue(input.semester_id, 'semester_id') ?? undefined,
    title: stringValue(input.title, 'title', true) as string,
    status: validateStatus(input.status, legacyActive === true ? 'published' : 'draft'),
    is_active: legacyActive,
    items: rawItems.map(validateItem),
  };
}

function validatePeriod(raw: unknown): BellPeriod {
  const period = asRecord(raw);
  const periodIndex = intValue(period.period_index, 'period_index', true) as number;
  if (periodIndex > 20) throw new HttpError(400, 'period_index must not exceed 20');
  const startsAt = stringValue(period.starts_at, 'starts_at', true) as string;
  const endsAt = stringValue(period.ends_at, 'ends_at', true) as string;
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(startsAt) || !/^\d{2}:\d{2}(:\d{2})?$/.test(endsAt)) {
    throw new HttpError(400, 'starts_at and ends_at must use HH:mm format');
  }
  return {
    period_index: periodIndex,
    starts_at: startsAt,
    ends_at: endsAt,
    sort_order: intValue(period.sort_order, 'sort_order') ?? periodIndex,
  };
}

export function validateShift(body: unknown): SchoolShiftInput {
  const input = asRecord(body);
  const periods = Array.isArray(input.periods) ? input.periods.map(validatePeriod) : [];
  if (periods.length === 0) throw new HttpError(400, 'At least one bell period is required');
  return {
    code: (stringValue(input.code, 'code', true) as string).toLowerCase(),
    name: stringValue(input.name, 'name', true) as string,
    sort_order: intValue(input.sort_order, 'sort_order') ?? 0,
    is_active: flexibleBoolean(input.is_active, 'is_active') ?? true,
    periods,
  };
}
