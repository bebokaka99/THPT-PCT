import type { AuthUser } from '../auth/auth.types.js';
import { createAcademicCalendarNotifications } from '../notifications/notification.service.js';
import { HttpError } from '../../utils/http-error.js';
import {
  academicPeriodScopeExists,
  deleteAcademicCalendarEntryRecord,
  findAcademicCalendarAudits,
  findAcademicCalendarConflicts,
  findAcademicCalendarEntries,
  findAcademicCalendarEntryById,
  findAcademicCalendarTeachingScope,
  guardianCanViewStudent,
  insertAcademicCalendarEntry,
  setAcademicCalendarEntryStatus,
  studentCanViewAcademicCalendarEntry,
  updateAcademicCalendarEntryRecord,
} from './academic-calendar.repository.js';
import type {
  AcademicCalendarEntry,
  AcademicCalendarInput,
  AcademicCalendarListQuery,
  AcademicCalendarResolvedInput,
  AcademicCalendarScope,
  AcademicCalendarUpdateInput,
} from './academic-calendar.types.js';

function isAdmin(user: AuthUser) {
  return user.roles.includes('admin') || user.permissions.includes('academic_calendar.manage');
}

function isTeacher(user: AuthUser) {
  return user.roles.includes('teacher') && user.permissions.includes('academic_calendar.propose');
}

function ensureAdmin(user: AuthUser) {
  if (!isAdmin(user)) throw new HttpError(403, 'Academic calendar management permission required');
}

function academicConflictError(error: unknown) {
  return error instanceof Error && error.message.includes('ACADEMIC_CALENDAR_CONFLICT');
}

async function entryOrThrow(id: number) {
  const entry = await findAcademicCalendarEntryById(id);
  if (!entry) throw new HttpError(404, 'Academic calendar entry not found');
  return entry;
}

function localDate(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value));
}

async function resolveInput(
  user: AuthUser,
  input: AcademicCalendarInput,
): Promise<AcademicCalendarResolvedInput> {
  const resourceType = ['test', 'exam', 'make_up'].includes(input.entry_type);
  if (input.teaching_assignment_id) {
    const assignment = await findAcademicCalendarTeachingScope(input.teaching_assignment_id);
    if (!assignment) throw new HttpError(404, 'Teaching assignment not found');
    if (assignment.status !== 'active') throw new HttpError(409, 'Teaching assignment is inactive');
    if (!isAdmin(user) && (!isTeacher(user) || assignment.teacher_user_id !== user.id)) {
      throw new HttpError(403, 'Teacher cannot propose a schedule outside assigned class and subject');
    }
    if (!isAdmin(user) && !resourceType) {
      throw new HttpError(403, 'Teachers may only propose tests, exams, or make-up lessons');
    }
    const startDate = localDate(input.starts_at);
    const endDate = localDate(input.ends_at);
    if (startDate < assignment.start_date || endDate > assignment.end_date) {
      throw new HttpError(400, 'Schedule must be inside the assigned semester');
    }
    return {
      ...input,
      academic_year_id: assignment.academic_year_id,
      semester_id: assignment.semester_id,
      classroom_id: assignment.classroom_id,
      subject_id: assignment.subject_id,
      teaching_assignment_id: assignment.id,
      teacher_user_id: assignment.teacher_user_id,
    };
  }
  if (resourceType) {
    throw new HttpError(400, 'teaching_assignment_id is required for tests, exams, and make-up lessons');
  }
  ensureAdmin(user);
  if (!input.academic_year_id) throw new HttpError(400, 'academic_year_id is required');
  const semesterId = input.semester_id ?? null;
  if (!(await academicPeriodScopeExists(input.academic_year_id, semesterId))) {
    throw new HttpError(400, 'Academic year and semester scope is invalid');
  }
  return {
    ...input,
    academic_year_id: input.academic_year_id,
    semester_id: semesterId,
    classroom_id: null,
    subject_id: null,
    teaching_assignment_id: null,
    teacher_user_id: null,
    room: null,
  };
}

function mergeInput(current: AcademicCalendarEntry, update: AcademicCalendarUpdateInput): AcademicCalendarInput {
  return {
    academic_year_id: update.academic_year_id ?? current.academic_year_id,
    semester_id: update.semester_id === undefined ? current.semester_id : update.semester_id,
    teaching_assignment_id: update.teaching_assignment_id === undefined ? current.teaching_assignment_id : update.teaching_assignment_id,
    entry_type: update.entry_type ?? current.entry_type,
    title: update.title ?? current.title,
    description: update.description === undefined ? current.description : update.description,
    starts_at: update.starts_at ?? current.starts_at,
    ends_at: update.ends_at ?? current.ends_at,
    all_day: update.all_day ?? current.all_day,
    room: update.room === undefined ? current.room : update.room,
  };
}

function scopeFor(user: AuthUser, studentId?: number): AcademicCalendarScope {
  if (isAdmin(user)) return { role: 'admin' };
  if (user.roles.includes('teacher')) return { role: 'teacher', userId: user.id };
  if (user.roles.includes('student')) return { role: 'student', userId: user.id };
  if (user.roles.includes('guardian') && studentId) return { role: 'guardian', userId: user.id, studentId };
  throw new HttpError(403, 'Academic calendar access denied');
}

export async function listAcademicCalendarEntries(user: AuthUser, query: AcademicCalendarListQuery) {
  let studentId = query.student_id;
  if (user.roles.includes('guardian')) {
    if (!studentId) throw new HttpError(400, 'student_id is required for guardian calendar');
    if (!(await guardianCanViewStudent(user.id, studentId))) throw new HttpError(403, 'Guardian access denied');
  } else {
    studentId = undefined;
  }
  const safeQuery = isAdmin(user) || user.roles.includes('teacher')
    ? query
    : { ...query, status: undefined };
  const result = await findAcademicCalendarEntries(safeQuery, scopeFor(user, studentId));
  return { data: result.data, meta: { page: query.page, limit: query.limit, total: result.total, totalPages: Math.ceil(result.total / query.limit) } };
}

export async function getAcademicCalendarEntry(user: AuthUser, id: number, studentId?: number) {
  const entry = await entryOrThrow(id);
  if (isAdmin(user)) return entry;
  if (user.roles.includes('teacher')) {
    if ((entry.teacher_user_id === user.id && ['proposed', 'published'].includes(entry.status)) || (!entry.classroom_id && entry.status === 'published')) return entry;
    throw new HttpError(403, 'Academic calendar access denied');
  }
  const targetStudentId = user.roles.includes('student') ? user.id : studentId;
  if (!targetStudentId) throw new HttpError(403, 'Academic calendar access denied');
  if (user.roles.includes('guardian') && !(await guardianCanViewStudent(user.id, targetStudentId))) throw new HttpError(403, 'Guardian access denied');
  if (!(await studentCanViewAcademicCalendarEntry(id, targetStudentId))) throw new HttpError(403, 'Academic calendar access denied');
  return entry;
}

export async function createAcademicCalendarEntry(user: AuthUser, input: AcademicCalendarInput) {
  if (!isAdmin(user) && !isTeacher(user)) throw new HttpError(403, 'Academic calendar proposal permission required');
  const resolved = await resolveInput(user, input);
  return insertAcademicCalendarEntry(resolved, isAdmin(user) ? 'draft' : 'proposed', user.id);
}

export async function previewAcademicCalendarConflicts(user: AuthUser, input: AcademicCalendarInput, excludeId?: number) {
  if (!isAdmin(user) && !isTeacher(user)) throw new HttpError(403, 'Academic calendar proposal permission required');
  return findAcademicCalendarConflicts(await resolveInput(user, input), excludeId);
}

async function sendNotifications(entry: AcademicCalendarEntry, actorUserId: number, isUpdate: boolean) {
  const when = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: entry.all_day ? undefined : 'short',
  }).format(new Date(entry.starts_at));
  await createAcademicCalendarNotifications({
    classroomId: entry.classroom_id,
    teacherUserId: entry.teacher_user_id,
    createdByUserId: actorUserId,
    entryId: entry.id,
    title: entry.title,
    message: `${entry.classroom_name ?? 'Toàn trường'}${entry.subject_name ? ` - ${entry.subject_name}` : ''} - ${when}`,
    effectiveAt: new Date(entry.starts_at),
    isUpdate,
  });
}

export async function updateAcademicCalendarEntry(user: AuthUser, id: number, input: AcademicCalendarUpdateInput) {
  const current = await entryOrThrow(id);
  if (!isAdmin(user)) {
    if (!isTeacher(user) || current.teacher_user_id !== user.id || current.created_by_user_id !== user.id || current.status !== 'proposed') {
      throw new HttpError(403, 'Only the proposing teacher can edit this proposal');
    }
  }
  if (current.status === 'archived') throw new HttpError(409, 'Archived schedules are read-only');
  const resolved = await resolveInput(user, mergeInput(current, input));
  if (current.status === 'published') {
    const conflicts = await findAcademicCalendarConflicts(resolved, id);
    if (conflicts.length) throw new HttpError(409, 'Schedule conflicts with an existing published schedule', { code: 'ACADEMIC_CALENDAR_CONFLICT', details: conflicts });
  }
  let updated;
  try {
    updated = await updateAcademicCalendarEntryRecord(id, resolved, user.id);
  } catch (error) {
    if (academicConflictError(error)) {
      throw new HttpError(409, 'Schedule conflicts with an existing published schedule', { code: 'ACADEMIC_CALENDAR_CONFLICT' });
    }
    throw error;
  }
  if (!updated) throw new HttpError(404, 'Academic calendar entry not found');
  if (updated.status === 'published') await sendNotifications(updated, user.id, true);
  return updated;
}

export async function publishAcademicCalendarEntry(user: AuthUser, id: number) {
  ensureAdmin(user);
  const current = await entryOrThrow(id);
  if (!['draft', 'proposed'].includes(current.status)) throw new HttpError(409, 'Only draft or proposed schedules can be published');
  const resolved = await resolveInput(user, mergeInput(current, {}));
  const conflicts = await findAcademicCalendarConflicts(resolved, id);
  if (conflicts.length) throw new HttpError(409, 'Schedule conflicts with an existing published schedule', { code: 'ACADEMIC_CALENDAR_CONFLICT', details: conflicts });
  let published;
  try {
    published = await setAcademicCalendarEntryStatus(id, 'published', user.id);
  } catch (error) {
    if (academicConflictError(error)) {
      throw new HttpError(409, 'Schedule conflicts with an existing published schedule', { code: 'ACADEMIC_CALENDAR_CONFLICT' });
    }
    throw error;
  }
  if (!published) throw new HttpError(404, 'Academic calendar entry not found');
  await sendNotifications(published, user.id, false);
  return published;
}

export async function archiveAcademicCalendarEntry(user: AuthUser, id: number) {
  ensureAdmin(user);
  const current = await entryOrThrow(id);
  if (current.status !== 'published') throw new HttpError(409, 'Only published schedules can be archived');
  return setAcademicCalendarEntryStatus(id, 'archived', user.id);
}

export async function removeAcademicCalendarEntry(user: AuthUser, id: number) {
  const current = await entryOrThrow(id);
  if (!isAdmin(user) && (!isTeacher(user) || current.created_by_user_id !== user.id || current.status !== 'proposed')) {
    throw new HttpError(403, 'Academic calendar delete permission denied');
  }
  if (!(await deleteAcademicCalendarEntryRecord(id))) throw new HttpError(409, 'Only draft or proposed schedules can be deleted');
}

export async function listAcademicCalendarAudits(user: AuthUser, id: number) {
  ensureAdmin(user);
  await entryOrThrow(id);
  return findAcademicCalendarAudits(id);
}
