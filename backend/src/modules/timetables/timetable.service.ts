import type { AuthUser } from '../auth/auth.types.js';
import { findClassroomById, isClassroomMember } from '../classrooms/classroom.repository.js';
import { HttpError } from '../../utils/http-error.js';
import {
  assertAcademicYearWritable,
  assertSemesterWritable,
} from '../academic-periods/academic-period.service.js';
import { findAcademicYearByName } from '../academic-periods/academic-period.repository.js';
import { resolveTimetableCurriculumSubject } from '../subjects/subject.service.js';
import { findTeachingAssignmentById } from '../teaching-assignments/teaching-assignment.repository.js';
import {
  createTimetableRecord,
  deleteTimetableRecord,
  findActiveTimetableByClassroomId,
  findPersonalTeachingTimetable,
  findTimetableById,
  updateTimetableRecord,
} from './timetable.repository.js';
import type { ResolvedTimetableInput, TimetableInput } from './timetable.types.js';

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

async function ensureAccess(user: AuthUser, classroomId: number) {
  if (isAdmin(user)) return;
  if (!(await isClassroomMember(classroomId, user.id))) throw new HttpError(403, 'Classroom access denied');
}

async function ensureManage(user: AuthUser, classroomId: number) {
  if (isAdmin(user)) return;
  if (!isTeacher(user) || !(await isClassroomMember(classroomId, user.id))) throw new HttpError(403, 'You cannot manage this timetable');
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
    throw new HttpError(
      400,
      'academic_year_id must reference a configured academic year',
    );
  }
  await assertAcademicYearWritable(academicYear.id);

  let semesterId = input.semester_id ?? null;
  let semesterName = input.semester ?? null;
  if (semesterId) {
    const semester = await assertSemesterWritable(semesterId, academicYear.id);
    semesterName = semester.name;
  } else if (semesterName) {
    const normalized = semesterName.trim().toLocaleLowerCase('vi');
    const semester = academicYear.semesters.find(
      (item) =>
        item.name.toLocaleLowerCase('vi') === normalized ||
        item.code.toLocaleLowerCase('vi') === normalized,
    );
    if (semester) {
      await assertSemesterWritable(semester.id, academicYear.id);
      semesterId = semester.id;
      semesterName = semester.name;
    }
  }

  const items = await Promise.all(
    input.items.map(async (item) => {
      if (!item.subject_id) return item;
      if (!gradeLevel) {
        throw new HttpError(
          409,
          'Classroom grade level is required for curriculum subjects',
        );
      }
      const curriculum = await resolveTimetableCurriculumSubject(
        academicYear.id,
        gradeLevel,
        item.subject_id,
      );
      if (item.teaching_assignment_id) {
        if (!semesterId) {
          throw new HttpError(
            400,
            'semester_id is required when teaching_assignment_id is provided',
          );
        }
        const assignment = await findTeachingAssignmentById(
          item.teaching_assignment_id,
        );
        if (
          !assignment ||
          assignment.status !== 'active' ||
          assignment.classroom_id !== classroomId ||
          assignment.subject_id !== curriculum.subject_id ||
          assignment.semester_id !== semesterId
        ) {
          throw new HttpError(
            409,
            'Teaching assignment does not match timetable class, subject, and semester',
          );
        }
        return {
          ...item,
          subject_id: curriculum.subject_id,
          subject_name: curriculum.subject_name,
          teacher_name: assignment.teacher_name,
        };
      }
      return {
        ...item,
        subject_id: curriculum.subject_id,
        subject_name: curriculum.subject_name,
      };
    }),
  );

  return {
    ...input,
    items,
    school_year: academicYear.name,
    academic_year_id: academicYear.id,
    semester_id: semesterId,
    semester: semesterName,
  };
}

export async function getClassroomTimetable(user: AuthUser, classroomId: number) {
  await ensureAccess(user, classroomId);
  return findActiveTimetableByClassroomId(classroomId);
}

export async function createClassroomTimetable(user: AuthUser, classroomId: number, input: TimetableInput) {
  await ensureManage(user, classroomId);
  const classroom = await findClassroomById(classroomId);
  if (!classroom) throw new HttpError(404, 'Classroom not found');
  const timetable = await createTimetableRecord(
    classroomId,
    await resolveTimetablePeriod(input, classroomId, classroom.grade_level),
  );
  if (!timetable) throw new HttpError(500, 'Failed to create timetable');
  return timetable;
}

export async function updateClassroomTimetable(user: AuthUser, classroomId: number, timetableId: number, input: TimetableInput) {
  await ensureManage(user, classroomId);
  const existing = await findTimetableById(timetableId);
  if (!existing || existing.classroom_id !== classroomId) throw new HttpError(404, 'Timetable not found');
  const classroom = await findClassroomById(classroomId);
  if (!classroom) throw new HttpError(404, 'Classroom not found');
  const timetable = await updateTimetableRecord(
    timetableId,
    await resolveTimetablePeriod(input, classroomId, classroom.grade_level),
  );
  if (!timetable) throw new HttpError(404, 'Timetable not found');
  return timetable;
}

export async function deleteClassroomTimetable(user: AuthUser, classroomId: number, timetableId: number) {
  await ensureManage(user, classroomId);
  const existing = await findTimetableById(timetableId);
  if (!existing || existing.classroom_id !== classroomId) throw new HttpError(404, 'Timetable not found');
  if (!(await deleteTimetableRecord(timetableId))) throw new HttpError(404, 'Timetable not found');
}
