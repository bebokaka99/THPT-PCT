import type { AuthUser } from '../auth/auth.types.js';
import { findClassroomById, isClassroomMember } from '../classrooms/classroom.repository.js';
import { HttpError } from '../../utils/http-error.js';
import { createScheduleOverrideNotifications } from '../notifications/notification.service.js';
import {
  createOverrideRecord,
  deleteOverrideRecord,
  findClassroomDailySchedule,
  findClassroomOverrides,
  findAllOverrides,
  findDailyScheduleForTeacher,
  findOverrideAudit,
  findOverrideById,
  findPublishedOverrideConflicts,
  findPublishedTimetableItemContext,
  setOverrideStatus,
  updateOverrideRecord,
} from './schedule-override.repository.js';
import type { ScheduleOverrideInput, ScheduleOverrideQuery } from './schedule-override.types.js';

function isAdmin(user: AuthUser) {
  return user.roles.includes('admin')
    || user.permissions.includes('classrooms.manage')
    || user.permissions.includes('timetable_overrides.manage');
}

function isTeacher(user: AuthUser) {
  return user.roles.includes('teacher') || isAdmin(user);
}

function currentVietnamDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

async function ensureClassroomAccess(user: AuthUser, classroomId: number) {
  if (isAdmin(user)) return;
  if (!(await isClassroomMember(classroomId, user.id))) {
    throw new HttpError(403, 'Classroom access denied');
  }
}

async function ensureManage(user: AuthUser, classroomId: number) {
  if (isAdmin(user)) return;
  if (!isTeacher(user) || !user.permissions.includes('timetable_overrides.propose')) {
    throw new HttpError(403, 'Schedule override proposal permission required');
  }
  if (!(await isClassroomMember(classroomId, user.id))) {
    throw new HttpError(403, 'Teacher is not assigned to this classroom');
  }
}

function mapRepositoryError(error: unknown): never {
  if (!(error instanceof Error)) throw error;
  const message = error.message;
  if (message.includes('DAILY_OVERRIDE_SUBSTITUTE_NOT_TEACHER')) {
    throw new HttpError(400, 'Giáo viên thay thế phải là tài khoản giáo viên đang hoạt động');
  }
  if (message.includes('DAILY_OVERRIDE_SUBSTITUTE_ASSIGNMENT_REQUIRED')) {
    throw new HttpError(409, 'Giáo viên thay thế chưa được phân công môn này trong lớp và học kỳ');
  }
  if (message.includes('DAILY_OVERRIDE_TIMETABLE_NOT_PUBLISHED')) {
    throw new HttpError(409, 'Chỉ được tạo đổi lịch từ thời khóa biểu đã công bố');
  }
  if (message.includes('DAILY_OVERRIDE_INVALID_TIMETABLE_ITEM')) {
    throw new HttpError(400, 'Tiết thời khóa biểu không thuộc lớp đã chọn');
  }
  if (message.includes('duplicate key value')) {
    throw new HttpError(409, 'Tiết này đã có một đề xuất thay đổi đang hoạt động trong ngày');
  }
  throw error;
}

function targetSlot(input: ScheduleOverrideInput, context: Awaited<ReturnType<typeof findPublishedTimetableItemContext>>) {
  if (!context) throw new HttpError(404, 'Published timetable item not found');
  return {
    dayOfWeek: input.override_type === 'reschedule' ? input.new_day_of_week ?? context.day_of_week : context.day_of_week,
    shiftId: input.override_type === 'reschedule' ? input.new_shift_id ?? context.shift_id : context.shift_id,
    lessonIndex: input.override_type === 'reschedule' ? input.new_lesson_index ?? context.lesson_index : context.lesson_index,
    teacherUserId: input.override_type === 'substitute'
      ? input.substitute_teacher_user_id ?? context.teacher_user_id
      : context.teacher_user_id,
    room: input.override_type === 'room_change' ? input.room ?? null : context.room,
  };
}

async function assertNoConflicts(input: ScheduleOverrideInput, context: NonNullable<Awaited<ReturnType<typeof findPublishedTimetableItemContext>>>, overrideId?: number) {
  if (input.override_type === 'cancelled') return;
  const slot = targetSlot(input, context);
  const conflicts = await findPublishedOverrideConflicts({
    classroomId: context.classroom_id,
    timetableId: context.timetable_id,
    timetableItemId: context.id,
    semesterId: context.semester_id,
    date: input.override_date,
    dayOfWeek: slot.dayOfWeek,
    shiftId: slot.shiftId,
    lessonIndex: slot.lessonIndex,
    teacherUserId: slot.teacherUserId,
    room: slot.room,
  });
  const filtered = overrideId ? conflicts : conflicts;
  if (filtered.length > 0) {
    throw new HttpError(409, `Daily schedule conflict: ${filtered[0].type} in ${filtered[0].classroom_name}`, {
      code: 'DAILY_SCHEDULE_CONFLICT',
      details: { conflicts: filtered },
    });
  }
}

export async function listClassroomOverrides(user: AuthUser, classroomId: number, query: ScheduleOverrideQuery) {
  await ensureClassroomAccess(user, classroomId);
  const data = await findClassroomOverrides(classroomId, {
    ...query,
    status: user.roles.includes('student') && !isAdmin(user) ? 'published' : query.status,
  });
  return { data };
}

export async function listAllOverrides(user: AuthUser, query: ScheduleOverrideQuery) {
  if (!isAdmin(user)) throw new HttpError(403, 'Only administrators can list all schedule overrides');
  return { data: await findAllOverrides(query) };
}

export async function getClassroomDailySchedule(user: AuthUser, classroomId: number, date = currentVietnamDate()) {
  await ensureClassroomAccess(user, classroomId);
  const classroom = await findClassroomById(classroomId);
  if (!classroom) throw new HttpError(404, 'Classroom not found');
  return { date, classroom, data: await findClassroomDailySchedule(classroomId, date) };
}

export async function getMyDailySchedule(user: AuthUser, date = currentVietnamDate()) {
  if (!user.roles.includes('teacher') && !isAdmin(user)) {
    throw new HttpError(403, 'Teacher role is required');
  }
  return { date, data: await findDailyScheduleForTeacher(user.id, date) };
}

export async function createScheduleOverride(user: AuthUser, classroomId: number, input: ScheduleOverrideInput) {
  await ensureManage(user, classroomId);
  const context = await findPublishedTimetableItemContext(input.timetable_item_id);
  if (!context || context.classroom_id !== classroomId) throw new HttpError(404, 'Published timetable item not found');
  if (!isAdmin(user) && context.teacher_user_id !== user.id) {
    throw new HttpError(403, 'Teacher can only propose a change for their own lesson');
  }
  const status = isAdmin(user) ? (input.status ?? 'draft') : 'proposed';
  try {
    const created = await createOverrideRecord(classroomId, input, user.id, status);
    if (!created) throw new HttpError(500, 'Failed to create schedule override');
    return created;
  } catch (error) { return mapRepositoryError(error); }
}

export async function updateScheduleOverride(user: AuthUser, id: number, input: ScheduleOverrideInput) {
  const existing = await findOverrideById(id);
  if (!existing) throw new HttpError(404, 'Schedule override not found');
  if (existing.status === 'published' || existing.status === 'archived') {
    throw new HttpError(409, 'Published or archived override cannot be edited');
  }
  if (!isAdmin(user) && (existing.created_by_user_id !== user.id || !user.permissions.includes('timetable_overrides.propose'))) {
    throw new HttpError(403, 'Only the proposal author or admin can edit this override');
  }
  if (input.timetable_item_id !== existing.timetable_item_id || input.override_date !== existing.override_date) {
    throw new HttpError(400, 'timetable_item_id and override_date cannot change after creation');
  }
  const context = await findPublishedTimetableItemContext(existing.timetable_item_id);
  if (!context) throw new HttpError(404, 'Published timetable item not found');
  try {
    return await updateOverrideRecord(id, { ...input, status: isAdmin(user) ? (input.status ?? 'draft') : 'proposed' }, user.id);
  } catch (error) { return mapRepositoryError(error); }
}

export async function publishScheduleOverride(user: AuthUser, id: number) {
  if (!isAdmin(user)) throw new HttpError(403, 'Only administrators can publish schedule overrides');
  const existing = await findOverrideById(id);
  if (!existing) throw new HttpError(404, 'Schedule override not found');
  if (existing.status === 'published') return existing;
  if (existing.status === 'archived') throw new HttpError(409, 'Archived override cannot be published');
  const context = await findPublishedTimetableItemContext(existing.timetable_item_id);
  if (!context) throw new HttpError(404, 'Published timetable item not found');
  const input: ScheduleOverrideInput = {
    timetable_item_id: existing.timetable_item_id,
    override_date: existing.override_date,
    override_type: existing.override_type,
    substitute_teacher_user_id: existing.substitute_teacher_user_id,
    new_day_of_week: existing.new_day_of_week,
    new_shift_id: existing.new_shift_id,
    new_lesson_index: existing.new_lesson_index,
    room: existing.room,
    reason: existing.reason,
  };
  await assertNoConflicts(input, context, id);
  try {
    const published = await setOverrideStatus(id, 'published', user.id);
    if (!published) throw new HttpError(404, 'Schedule override not found');
    await createScheduleOverrideNotifications({
      classroomId: published.classroom_id,
      overrideId: published.id,
      date: published.override_date,
      createdByUserId: user.id,
      title: `Thay đổi lịch: ${published.subject_name}`,
      message: `${published.reason} (${published.override_date})`,
    });
    return published;
  } catch (error) { return mapRepositoryError(error); }
}

export async function archiveScheduleOverride(user: AuthUser, id: number) {
  if (!isAdmin(user)) throw new HttpError(403, 'Only administrators can archive schedule overrides');
  if (!(await findOverrideById(id))) throw new HttpError(404, 'Schedule override not found');
  return setOverrideStatus(id, 'archived', user.id);
}

export async function deleteScheduleOverride(user: AuthUser, id: number) {
  const existing = await findOverrideById(id);
  if (!existing) throw new HttpError(404, 'Schedule override not found');
  if (existing.status === 'published') throw new HttpError(409, 'Archive a published override before deleting it');
  if (!isAdmin(user) && existing.created_by_user_id !== user.id) throw new HttpError(403, 'Only author or admin can delete this proposal');
  try {
    if (!(await deleteOverrideRecord(id, user.id))) throw new HttpError(404, 'Schedule override not found');
  } catch (error) { return mapRepositoryError(error); }
}

export async function getScheduleOverrideAudit(user: AuthUser, id: number) {
  if (!isAdmin(user)) throw new HttpError(403, 'Only administrators can view schedule override audit');
  if (!(await findOverrideById(id))) throw new HttpError(404, 'Schedule override not found');
  return { data: await findOverrideAudit(id) };
}
