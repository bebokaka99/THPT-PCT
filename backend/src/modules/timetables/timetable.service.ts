import type { AuthUser } from '../auth/auth.types.js';
import { findClassroomById, isClassroomMember } from '../classrooms/classroom.repository.js';
import { HttpError } from '../../utils/http-error.js';
import { assertAcademicYearWritable, assertSemesterWritable } from '../academic-periods/academic-period.service.js';
import { findAcademicYearByName } from '../academic-periods/academic-period.repository.js';
import { resolveTimetableCurriculumSubject } from '../subjects/subject.service.js';
import { findTeachingAssignmentById } from '../teaching-assignments/teaching-assignment.repository.js';
import {
  createTimetableRecord,
  deleteTimetableRecord,
  findLatestTimetableByClassroomId,
  findPersonalTeachingTimetable,
  findPublishedTimetableByClassroomId,
  findTimetableById,
  findTimetableConflicts,
  listSchoolShifts,
  publishTimetableRecord,
  saveSchoolShift,
  setTimetableStatus,
  updateTimetableRecord,
} from './timetable.repository.js';
import type {
  ResolvedTimetableInput,
  SchoolShiftInput,
  TimetableConflict,
  TimetableInput,
} from './timetable.types.js';

function isAdmin(user: AuthUser) {
  return user.roles.includes('admin') || user.permissions.includes('classrooms.manage');
}

function isTeacher(user: AuthUser) {
  return user.roles.includes('teacher') || isAdmin(user);
}

export async function getMyTeachingTimetable(user: AuthUser) {
  if (!user.roles.includes('teacher') && !user.roles.includes('admin')) {
    throw new HttpError(403, 'Teacher role is required');
  }
  return findPersonalTeachingTimetable(user.id);
}

export async function getSchoolShifts() {
  return listSchoolShifts();
}

export async function createSchoolShift(user: AuthUser, input: SchoolShiftInput) {
  if (!isAdmin(user)) throw new HttpError(403, 'Only administrators can configure school shifts');
  return saveSchoolShift(input);
}

export async function updateSchoolShift(user: AuthUser, id: number, input: SchoolShiftInput) {
  if (!isAdmin(user)) throw new HttpError(403, 'Only administrators can configure school shifts');
  const shift = await saveSchoolShift(input, id);
  if (!shift) throw new HttpError(404, 'School shift not found');
  return shift;
}

async function ensureAccess(user: AuthUser, classroomId: number) {
  if (isAdmin(user)) return;
  if (!(await isClassroomMember(classroomId, user.id))) {
    throw new HttpError(403, 'Classroom access denied');
  }
}

async function ensureManage(user: AuthUser, classroomId: number) {
  if (isAdmin(user)) return;
  if (!isTeacher(user) || !(await isClassroomMember(classroomId, user.id))) {
    throw new HttpError(403, 'You cannot manage this timetable');
  }
}

async function resolveTimetablePeriod(
  input: TimetableInput,
  classroomId: number,
  gradeLevel: number | null,
): Promise<ResolvedTimetableInput> {
  const academicYear = input.academic_year_id
    ? await assertAcademicYearWritable(input.academic_year_id)
    : input.school_year
      ? await findAcademicYearByName(input.school_year)
      : null;
  if (!academicYear) {
    throw new HttpError(400, 'academic_year_id must reference a configured academic year');
  }
  await assertAcademicYearWritable(academicYear.id);

  let semesterId = input.semester_id ?? null;
  let semesterName = input.semester ?? null;
  if (semesterId) {
    const semester = await assertSemesterWritable(semesterId, academicYear.id);
    semesterName = semester.name;
  } else if (semesterName) {
    const normalized = semesterName.trim().toLocaleLowerCase('vi');
    const semester = academicYear.semesters.find((item) =>
      item.name.toLocaleLowerCase('vi') === normalized
      || item.code.toLocaleLowerCase('vi') === normalized,
    );
    if (semester) {
      await assertSemesterWritable(semester.id, academicYear.id);
      semesterId = semester.id;
      semesterName = semester.name;
    }
  }
  if (!semesterId) throw new HttpError(400, 'semester_id is required for timetable conflict checks');

  const shifts = await listSchoolShifts();
  const shiftMap = new Map(shifts.map((shift) => [shift.id, shift]));
  const occupiedSlots = new Set<string>();
  const defaultShift = shifts.filter((shift) => shift.is_active)
    .sort((left, right) => left.sort_order - right.sort_order)[0];
  const items = await Promise.all(input.items.map(async (rawItem) => {
    const item = rawItem.shift_id
      ? rawItem
      : { ...rawItem, shift_id: defaultShift?.id ?? 0 };
    const shift = shiftMap.get(item.shift_id);
    if (!shift?.is_active) throw new HttpError(400, `shift_id ${item.shift_id} is not active`);
    if (!shift.periods.some((period) => period.period_index === item.lesson_index)) {
      throw new HttpError(400, `${shift.name} does not contain period ${item.lesson_index}`);
    }
    const slot = `${item.day_of_week}:${item.shift_id}:${item.lesson_index}`;
    if (occupiedSlots.has(slot)) {
      throw new HttpError(409, `Classroom has more than one lesson in the same slot (${shift.name}, period ${item.lesson_index})`);
    }
    occupiedSlots.add(slot);

    if (!item.subject_id) return { ...item, teacher_user_id: null };
    if (!gradeLevel) throw new HttpError(409, 'Classroom grade level is required for curriculum subjects');
    const curriculum = await resolveTimetableCurriculumSubject(
      academicYear.id,
      gradeLevel,
      item.subject_id,
    );
    if (!item.teaching_assignment_id) {
      if (input.status === 'published') {
        throw new HttpError(409, `Teaching assignment is required for ${curriculum.subject_name}`);
      }
      return {
        ...item,
        subject_id: curriculum.subject_id,
        subject_name: curriculum.subject_name,
        teacher_user_id: null,
      };
    }
    const assignment = await findTeachingAssignmentById(item.teaching_assignment_id);
    if (!assignment || assignment.status !== 'active'
      || assignment.classroom_id !== classroomId
      || assignment.subject_id !== curriculum.subject_id
      || assignment.semester_id !== semesterId) {
      throw new HttpError(409, 'Teaching assignment does not match timetable class, subject, and semester');
    }
    return {
      ...item,
      subject_id: curriculum.subject_id,
      subject_name: curriculum.subject_name,
      teacher_user_id: assignment.teacher_user_id,
      teacher_name: assignment.teacher_name,
    };
  }));

  return {
    ...input,
    status: input.status ?? 'draft',
    is_active: input.status === 'published',
    items,
    school_year: academicYear.name,
    academic_year_id: academicYear.id,
    semester_id: semesterId,
    semester: semesterName,
  };
}

async function resolveForClassroom(classroomId: number, input: TimetableInput) {
  const classroom = await findClassroomById(classroomId);
  if (!classroom) throw new HttpError(404, 'Classroom not found');
  return resolveTimetablePeriod(input, classroomId, classroom.grade_level);
}

async function collectConflicts(
  classroomId: number,
  input: ResolvedTimetableInput,
  excludeTimetableId?: number,
): Promise<TimetableConflict[]> {
  return findTimetableConflicts(
    classroomId,
    input.semester_id ?? null,
    input.items,
    excludeTimetableId,
  );
}

function assertNoConflicts(conflicts: TimetableConflict[]) {
  if (conflicts.length > 0) {
    throw new HttpError(409, `Timetable conflict: ${conflicts[0].message}`, {
      code: 'TIMETABLE_CONFLICT',
      details: { conflicts },
    });
  }
}

export async function getClassroomTimetable(user: AuthUser, classroomId: number) {
  await ensureAccess(user, classroomId);
  if (isAdmin(user) || user.roles.includes('teacher')) {
    return findLatestTimetableByClassroomId(classroomId);
  }
  return findPublishedTimetableByClassroomId(classroomId);
}

export async function previewClassroomTimetableConflicts(
  user: AuthUser,
  classroomId: number,
  input: TimetableInput,
  excludeTimetableId?: number,
) {
  await ensureManage(user, classroomId);
  const resolved = await resolveForClassroom(classroomId, { ...input, status: 'draft' });
  return collectConflicts(classroomId, resolved, excludeTimetableId);
}

export async function createClassroomTimetable(
  user: AuthUser,
  classroomId: number,
  input: TimetableInput,
) {
  await ensureManage(user, classroomId);
  const resolved = await resolveForClassroom(classroomId, input);
  const currentPublished = resolved.status === 'published'
    ? await findPublishedTimetableByClassroomId(classroomId)
    : null;
  if (resolved.status === 'published') {
    assertNoConflicts(await collectConflicts(
      classroomId,
      resolved,
      currentPublished?.id,
    ));
  }
  const timetable = await createTimetableRecord(
    classroomId,
    resolved,
    user.id,
    currentPublished?.id,
  );
  if (!timetable) throw new HttpError(500, 'Failed to create timetable');
  return timetable;
}

export async function updateClassroomTimetable(
  user: AuthUser,
  classroomId: number,
  timetableId: number,
  input: TimetableInput,
) {
  await ensureManage(user, classroomId);
  const existing = await findTimetableById(timetableId);
  if (!existing || existing.classroom_id !== classroomId) throw new HttpError(404, 'Timetable not found');
  const resolved = await resolveForClassroom(classroomId, input);
  const currentPublished = resolved.status === 'published'
    ? await findPublishedTimetableByClassroomId(classroomId)
    : null;
  const replacementId = currentPublished?.id ?? (
    existing.status === 'published' ? timetableId : undefined
  );
  if (resolved.status === 'published') {
    assertNoConflicts(await collectConflicts(classroomId, resolved, replacementId));
  }
  const timetable = existing.status === 'draft'
    ? await updateTimetableRecord(timetableId, resolved, user.id)
    : await createTimetableRecord(
        classroomId,
        resolved,
        user.id,
        resolved.status === 'published' ? replacementId : undefined,
      );
  if (!timetable) throw new HttpError(404, 'Timetable not found');
  return timetable;
}

export async function publishClassroomTimetable(
  user: AuthUser,
  classroomId: number,
  timetableId: number,
) {
  await ensureManage(user, classroomId);
  const existing = await findTimetableById(timetableId);
  if (!existing || existing.classroom_id !== classroomId) throw new HttpError(404, 'Timetable not found');
  if (existing.items.some((item) => !item.teaching_assignment_id || !item.teacher_user_id)) {
    throw new HttpError(409, 'Every lesson needs a valid teaching assignment before publishing');
  }
  assertNoConflicts(await findTimetableConflicts(
    classroomId,
    existing.semester_id,
    existing.items,
    timetableId,
  ));
  const timetable = await publishTimetableRecord(
    timetableId,
    classroomId,
    existing.semester_id,
    user.id,
  );
  if (!timetable) throw new HttpError(404, 'Timetable not found');
  return timetable;
}

export async function archiveClassroomTimetable(
  user: AuthUser,
  classroomId: number,
  timetableId: number,
) {
  await ensureManage(user, classroomId);
  const existing = await findTimetableById(timetableId);
  if (!existing || existing.classroom_id !== classroomId) throw new HttpError(404, 'Timetable not found');
  const timetable = await setTimetableStatus(timetableId, 'archived', user.id);
  if (!timetable) throw new HttpError(404, 'Timetable not found');
  return timetable;
}

export async function deleteClassroomTimetable(
  user: AuthUser,
  classroomId: number,
  timetableId: number,
) {
  await ensureManage(user, classroomId);
  const existing = await findTimetableById(timetableId);
  if (!existing || existing.classroom_id !== classroomId) throw new HttpError(404, 'Timetable not found');
  if (existing.status === 'published') throw new HttpError(409, 'Archive a published timetable before deleting it');
  if (!(await deleteTimetableRecord(timetableId))) throw new HttpError(404, 'Timetable not found');
}
