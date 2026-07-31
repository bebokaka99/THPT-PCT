import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  firstQueryValue,
  nullableStringValue,
  optionalPositiveId,
  parsePositiveInteger,
  requiredString,
} from '../../validators/common.js';
import type { TeachingPlanInput, TeachingPlanListQuery, TeachingPlanReviewInput, TeachingPlanStatus, TeachingPlanUpdateInput } from './teaching-plan.types.js';

const statuses = new Set<TeachingPlanStatus>(['draft', 'submitted', 'approved', 'rejected', 'archived']);

function optionalWeekNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 53) {
    throw new HttpError(400, 'week_number phải là số nguyên từ 1 đến 53');
  }
  return parsed;
}

function statusValue(value: unknown, field = 'status') {
  const parsed = typeof value === 'string' ? value.trim() : undefined;
  if (parsed && !statuses.has(parsed as TeachingPlanStatus)) throw new HttpError(400, `${field} không hợp lệ`);
  return parsed as TeachingPlanStatus | undefined;
}

export function validatePlanId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'id phải là số nguyên dương');
  return id;
}

export function validateListQuery(query: Record<string, unknown>): TeachingPlanListQuery {
  const status = statusValue(firstQueryValue(query.status));
  return {
    page: parsePositiveInteger(query.page, 1, 'page'),
    limit: Math.min(parsePositiveInteger(query.limit, 20, 'limit'), 50),
    q: typeof firstQueryValue(query.q) === 'string' ? String(firstQueryValue(query.q)).trim() || undefined : undefined,
    status,
    teacher_user_id: optionalPositiveId(firstQueryValue(query.teacher_user_id), 'teacher_user_id'),
    classroom_id: optionalPositiveId(firstQueryValue(query.classroom_id), 'classroom_id'),
    subject_id: optionalPositiveId(firstQueryValue(query.subject_id), 'subject_id'),
    semester_id: optionalPositiveId(firstQueryValue(query.semester_id), 'semester_id'),
  };
}

export function validateCreatePlan(body: unknown): TeachingPlanInput {
  const input = asRecord(body);
  const teachingAssignmentId = optionalPositiveId(input.teaching_assignment_id, 'teaching_assignment_id');
  if (!teachingAssignmentId) throw new HttpError(400, 'teaching_assignment_id là bắt buộc');
  return {
    teaching_assignment_id: teachingAssignmentId,
    title: requiredString(input.title, 'title'),
    objectives: nullableStringValue(input.objectives, 'objectives') ?? null,
    content: nullableStringValue(input.content, 'content') ?? null,
    resources: nullableStringValue(input.resources, 'resources') ?? null,
    week_number: optionalWeekNumber(input.week_number),
    timetable_item_id: optionalPositiveId(input.timetable_item_id, 'timetable_item_id') ?? null,
    assignment_id: optionalPositiveId(input.assignment_id, 'assignment_id') ?? null,
    media_file_id: optionalPositiveId(input.media_file_id, 'media_file_id') ?? null,
  };
}

export function validateUpdatePlan(body: unknown): TeachingPlanUpdateInput {
  const input = asRecord(body);
  const output: TeachingPlanUpdateInput = {};
  if (input.title !== undefined) output.title = requiredString(input.title, 'title');
  if (input.objectives !== undefined) output.objectives = nullableStringValue(input.objectives, 'objectives') ?? null;
  if (input.content !== undefined) output.content = nullableStringValue(input.content, 'content') ?? null;
  if (input.resources !== undefined) output.resources = nullableStringValue(input.resources, 'resources') ?? null;
  if (input.week_number !== undefined) output.week_number = optionalWeekNumber(input.week_number);
  if (input.timetable_item_id !== undefined) output.timetable_item_id = optionalPositiveId(input.timetable_item_id, 'timetable_item_id') ?? null;
  if (input.assignment_id !== undefined) output.assignment_id = optionalPositiveId(input.assignment_id, 'assignment_id') ?? null;
  if (input.media_file_id !== undefined) output.media_file_id = optionalPositiveId(input.media_file_id, 'media_file_id') ?? null;
  return output;
}

export function validateReview(body: unknown): TeachingPlanReviewInput {
  const input = asRecord(body ?? {});
  return { comment: nullableStringValue(input.comment, 'comment') ?? null };
}

export function validateStatus(value: unknown) {
  return statusValue(value, 'status');
}
