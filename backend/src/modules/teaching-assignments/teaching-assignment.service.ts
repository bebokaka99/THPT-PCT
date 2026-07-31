import type { AuthUser } from '../auth/auth.types.js';
import { HttpError } from '../../utils/http-error.js';
import { assertSemesterWritable } from '../academic-periods/academic-period.service.js';
import { findSemesterById } from '../academic-periods/academic-period.repository.js';
import { findClassroomById } from '../classrooms/classroom.repository.js';
import { findActiveCurriculumSubject } from '../subjects/subject.repository.js';
import { findUserById } from '../users/user.repository.js';
import {
  activeTeachingAssignmentExists,
  canTeachAssignment,
  findTeachingAssignmentById,
  findTeachingAssignments,
  insertTeachingAssignment,
  insertTeachingAssignments,
  updateTeachingAssignmentRecord,
  updateTeachingAssignmentStatusRecord,
} from './teaching-assignment.repository.js';
import type {
  ListTeachingAssignmentsQuery,
  TeachingAssignmentInput,
  TeachingAssignmentStatusInput,
  TeachingAssignmentUpdateInput,
} from './teaching-assignment.types.js';

function isAdmin(user: AuthUser) {
  return (
    user.roles.includes('admin') ||
    user.permissions.includes('teaching_assignments.manage')
  );
}

function ensureAdmin(user: AuthUser) {
  if (!isAdmin(user)) throw new HttpError(403, 'Permission denied');
}

function isDatabaseConflict(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

async function getAssignmentOrThrow(id: number) {
  const assignment = await findTeachingAssignmentById(id);
  if (!assignment) throw new HttpError(404, 'Teaching assignment not found');
  return assignment;
}

function ensureDateInSemester(date: string, startDate: string, endDate: string) {
  if (date < startDate || date > endDate) {
    throw new HttpError(400, 'Assignment date must be inside the semester');
  }
}

async function validateAssignmentReferences(input: TeachingAssignmentInput) {
  const teacher = await findUserById(input.teacher_user_id);
  if (
    !teacher ||
    teacher.status !== 'active' ||
    !teacher.roles.includes('teacher')
  ) {
    throw new HttpError(400, 'teacher_user_id must be an active teacher');
  }
  const classroom = await findClassroomById(input.classroom_id);
  if (!classroom) throw new HttpError(404, 'Classroom not found');
  if (!classroom.is_active) {
    throw new HttpError(409, 'Inactive classroom cannot receive assignments');
  }
  if (!classroom.academic_year_id || !classroom.grade_level) {
    throw new HttpError(
      409,
      'Classroom must have academic year and grade level',
    );
  }
  const semester = await assertSemesterWritable(
    input.semester_id,
    classroom.academic_year_id,
  );
  ensureDateInSemester(input.assigned_at, semester.start_date, semester.end_date);
  const curriculum = await findActiveCurriculumSubject(
    classroom.academic_year_id,
    classroom.grade_level,
    input.subject_id,
  );
  if (!curriculum) {
    throw new HttpError(
      409,
      'Subject is not active in the classroom curriculum',
    );
  }
  return { teacher, classroom, semester, curriculum };
}

export async function listTeachingAssignmentsForAdmin(
  user: AuthUser,
  query: ListTeachingAssignmentsQuery,
) {
  ensureAdmin(user);
  const result = await findTeachingAssignments(query);
  return {
    data: result.data,
    meta: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / query.limit),
    },
  };
}

export async function listMyTeachingAssignments(
  user: AuthUser,
  query: ListTeachingAssignmentsQuery,
) {
  if (!user.roles.includes('teacher') && !user.roles.includes('admin')) {
    throw new HttpError(403, 'Teacher role required');
  }
  const result = await findTeachingAssignments(query, user.id);
  return {
    data: result.data,
    meta: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / query.limit),
    },
  };
}

export async function getTeachingAssignmentForUser(
  user: AuthUser,
  id: number,
) {
  const assignment = await getAssignmentOrThrow(id);
  if (!isAdmin(user) && assignment.teacher_user_id !== user.id) {
    throw new HttpError(403, 'Teaching assignment access denied');
  }
  return assignment;
}

export async function createTeachingAssignment(
  user: AuthUser,
  input: TeachingAssignmentInput,
) {
  ensureAdmin(user);
  await validateAssignmentReferences(input);
  if (await activeTeachingAssignmentExists(input)) {
    throw new HttpError(409, 'Active teaching assignment already exists');
  }
  try {
    const assignment = await insertTeachingAssignment(input, user.id);
    if (!assignment) {
      throw new HttpError(500, 'Failed to create teaching assignment');
    }
    return assignment;
  } catch (error) {
    if (isDatabaseConflict(error)) {
      throw new HttpError(409, 'Active teaching assignment already exists');
    }
    throw error;
  }
}

export async function createTeachingAssignmentsBulk(
  user: AuthUser,
  inputs: TeachingAssignmentInput[],
) {
  ensureAdmin(user);
  const keys = new Set<string>();
  for (const input of inputs) {
    await validateAssignmentReferences(input);
    const key = [
      input.teacher_user_id,
      input.classroom_id,
      input.subject_id,
      input.semester_id,
    ].join(':');
    if (keys.has(key) || (await activeTeachingAssignmentExists(input))) {
      throw new HttpError(
        409,
        'Bulk request contains a duplicate or existing active assignment',
      );
    }
    keys.add(key);
  }
  try {
    const assignments = await insertTeachingAssignments(inputs, user.id);
    return assignments.filter(Boolean);
  } catch (error) {
    if (isDatabaseConflict(error)) {
      throw new HttpError(
        409,
        'Bulk request conflicts with an active assignment',
      );
    }
    throw error;
  }
}

export async function updateTeachingAssignment(
  user: AuthUser,
  id: number,
  input: TeachingAssignmentUpdateInput,
) {
  ensureAdmin(user);
  const current = await getAssignmentOrThrow(id);
  if (current.status !== 'active') {
    throw new HttpError(409, 'Inactive assignment is read-only');
  }
  await assertSemesterWritable(current.semester_id, current.academic_year_id);
  return updateTeachingAssignmentRecord(id, {
    role: input.role ?? current.role,
    note: input.note === undefined ? current.note : input.note,
  });
}

export async function setTeachingAssignmentStatus(
  user: AuthUser,
  id: number,
  input: TeachingAssignmentStatusInput,
) {
  ensureAdmin(user);
  const current = await getAssignmentOrThrow(id);
  if (current.status === input.status) return current;
  const semester = await assertSemesterWritable(
    current.semester_id,
    current.academic_year_id,
  );
  ensureDateInSemester(
    input.effective_date,
    semester.start_date,
    semester.end_date,
  );
  if (
    input.status === 'active' &&
    (await activeTeachingAssignmentExists(current, id))
  ) {
    throw new HttpError(409, 'Active teaching assignment already exists');
  }
  return updateTeachingAssignmentStatusRecord(
    id,
    input.status,
    input.effective_date,
  );
}

export async function endTeachingAssignment(
  user: AuthUser,
  id: number,
  effectiveDate: string,
) {
  await setTeachingAssignmentStatus(user, id, {
    status: 'inactive',
    effective_date: effectiveDate,
  });
}

export async function canTeachSubjectInClass(
  user: AuthUser,
  classroomId: number,
  subjectId: number,
  semesterId: number,
) {
  if (isAdmin(user)) return true;
  if (!user.roles.includes('teacher')) return false;
  return canTeachAssignment(user.id, classroomId, subjectId, semesterId);
}

export async function assertCanTeachSubjectInClass(
  user: AuthUser,
  classroomId: number,
  subjectId: number,
  semesterId: number,
) {
  if (
    !(await canTeachSubjectInClass(
      user,
      classroomId,
      subjectId,
      semesterId,
    ))
  ) {
    throw new HttpError(
      403,
      'Teacher is not assigned to this subject, classroom, and semester',
    );
  }
}

export async function getTeachingAssignmentSemester(id: number) {
  const assignment = await getAssignmentOrThrow(id);
  const semester = await findSemesterById(assignment.semester_id);
  return { assignment, semester };
}
