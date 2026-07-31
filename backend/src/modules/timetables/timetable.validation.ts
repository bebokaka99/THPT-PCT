import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  flexibleBoolean,
  nullableStringValue as stringValue,
  positiveIntegerValue as intValue,
} from '../../validators/common.js';
import type { TimetableInput, TimetableItem } from './timetable.types.js';

export function validateId(value: string, field = 'id') {
  return intValue(value, field, true) as number;
}

function validateItem(raw: unknown): TimetableItem {
  const item = asRecord(raw);
  const dayOfWeek = intValue(item.day_of_week, 'day_of_week', true) as number;
  const lessonIndex = intValue(item.lesson_index, 'lesson_index', true) as number;
  if (dayOfWeek < 1 || dayOfWeek > 7) throw new HttpError(400, 'day_of_week must be from 1 to 7');
  if (lessonIndex < 1 || lessonIndex > 20) throw new HttpError(400, 'lesson_index must be from 1 to 20');
  return {
    day_of_week: dayOfWeek,
    lesson_index: lessonIndex,
    subject_id:
      item.subject_id === null
        ? null
        : intValue(item.subject_id, 'subject_id') ?? null,
    teaching_assignment_id:
      item.teaching_assignment_id === null
        ? null
        : intValue(
            item.teaching_assignment_id,
            'teaching_assignment_id',
          ) ?? null,
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
  return {
    school_year: schoolYear as string | undefined,
    semester: stringValue(input.semester, 'semester') ?? null,
    academic_year_id: academicYearId,
    semester_id:
      input.semester_id === null
        ? null
        : intValue(input.semester_id, 'semester_id') ?? undefined,
    title: stringValue(input.title, 'title', true) as string,
    is_active: flexibleBoolean(input.is_active, 'is_active') ?? true,
    items: rawItems.map(validateItem),
  };
}
