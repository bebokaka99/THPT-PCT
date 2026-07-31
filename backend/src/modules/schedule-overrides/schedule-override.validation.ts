import { HttpError } from '../../utils/http-error.js';
import { asRecord, nullableStringValue, positiveIntegerValue } from '../../validators/common.js';
import type { ScheduleOverrideInput, ScheduleOverrideQuery, ScheduleOverrideType } from './schedule-override.types.js';

const types = new Set<ScheduleOverrideType>(['substitute', 'reschedule', 'room_change', 'cancelled']);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function dateValue(value: unknown, field = 'date') {
  if (typeof value !== 'string' || !datePattern.test(value)) {
    throw new HttpError(400, `${field} must use YYYY-MM-DD format`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, `${field} is not a valid calendar date`);
  }
  return value;
}

function nullableInt(value: unknown, field: string) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = positiveIntegerValue(value, field);
  return parsed ?? null;
}

export function validateOverrideId(value: string, field = 'id') {
  const parsed = positiveIntegerValue(value, field, true);
  if (!parsed) throw new HttpError(400, `${field} must be a positive integer`);
  return parsed as number;
}

export function validateScheduleOverrideQuery(query: Record<string, unknown>): ScheduleOverrideQuery {
  const result: ScheduleOverrideQuery = {};
  if (query.date) result.date = dateValue(query.date, 'date');
  if (query.status) {
    if (!['draft', 'proposed', 'published', 'archived'].includes(String(query.status))) {
      throw new HttpError(400, 'status is invalid');
    }
    result.status = String(query.status) as ScheduleOverrideQuery['status'];
  }
  return result;
}

export function validateScheduleOverride(body: unknown): ScheduleOverrideInput {
  const input = asRecord(body);
  const type = input.override_type;
  if (typeof type !== 'string' || !types.has(type as ScheduleOverrideType)) {
    throw new HttpError(400, 'override_type must be substitute, reschedule, room_change, or cancelled');
  }
  const reason = nullableStringValue(input.reason, 'reason', true) as string;
  const day = nullableInt(input.new_day_of_week, 'new_day_of_week');
  if (day !== null && (day < 1 || day > 7)) {
    throw new HttpError(400, 'new_day_of_week must be from 1 to 7');
  }
  const status = input.status === undefined ? undefined : String(input.status);
  if (status && !['draft', 'proposed'].includes(status)) {
    throw new HttpError(400, 'status must be draft or proposed; publish through the publish endpoint');
  }
  return {
    timetable_item_id: positiveIntegerValue(input.timetable_item_id, 'timetable_item_id', true) as number,
    override_date: dateValue(input.override_date, 'override_date'),
    override_type: type as ScheduleOverrideType,
    status: status as ScheduleOverrideInput['status'],
    substitute_teacher_user_id: nullableInt(input.substitute_teacher_user_id, 'substitute_teacher_user_id'),
    new_day_of_week: day,
    new_shift_id: nullableInt(input.new_shift_id, 'new_shift_id'),
    new_lesson_index: nullableInt(input.new_lesson_index, 'new_lesson_index'),
    room: nullableStringValue(input.room, 'room') ?? null,
    reason,
  };
}

