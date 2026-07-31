import type { AuthUser } from '../auth/auth.types.js';
import { HttpError } from '../../utils/http-error.js';
import { assertAcademicYearWritable } from '../academic-periods/academic-period.service.js';
import { findClassroomById } from '../classrooms/classroom.repository.js';
import {
  createEnrollmentRecord,
  endEnrollmentRecord,
  findActiveEnrollment,
  findEnrollmentById,
  findEnrollments,
  findStudentEnrollmentHistory,
  studentUserIsEligible,
  transferEnrollmentRecord,
} from './enrollment.repository.js';
import type {
  CreateEnrollmentInput,
  EndEnrollmentInput,
  ListEnrollmentsQuery,
  TransferEnrollmentInput,
} from './enrollment.types.js';

function isAdmin(user: AuthUser) {
  return (
    user.roles.includes('admin') ||
    user.permissions.includes('enrollments.manage')
  );
}

function requireAdmin(user: AuthUser) {
  if (!isAdmin(user)) throw new HttpError(403, 'Permission denied');
}

async function getEnrollmentOrThrow(id: number) {
  const enrollment = await findEnrollmentById(id);
  if (!enrollment) throw new HttpError(404, 'Enrollment not found');
  return enrollment;
}

async function getEnrollmentClassroom(classroomId: number) {
  const classroom = await findClassroomById(classroomId);
  if (!classroom) throw new HttpError(404, 'Classroom not found');
  if (!classroom.is_active) {
    throw new HttpError(409, 'Cannot assign students to an inactive classroom');
  }
  if (!classroom.academic_year_id) {
    throw new HttpError(409, 'Classroom does not have an academic year');
  }
  const academicYear = await assertAcademicYearWritable(
    classroom.academic_year_id,
  );
  return { classroom, academicYear };
}

function ensureDateInsideAcademicYear(
  value: string,
  academicYear: { start_date: string; end_date: string },
  field: string,
) {
  if (value < academicYear.start_date || value > academicYear.end_date) {
    throw new HttpError(
      400,
      `${field} must be inside the academic year date range`,
    );
  }
}

export async function listEnrollmentsForAdmin(
  user: AuthUser,
  query: ListEnrollmentsQuery,
) {
  requireAdmin(user);
  const result = await findEnrollments(query);
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

export async function getEnrollmentForUser(user: AuthUser, id: number) {
  const enrollment = await getEnrollmentOrThrow(id);
  if (!isAdmin(user) && enrollment.student_user_id !== user.id) {
    throw new HttpError(403, 'Enrollment access denied');
  }
  return enrollment;
}

export async function getStudentHistory(user: AuthUser, studentUserId: number) {
  if (!isAdmin(user) && user.id !== studentUserId) {
    throw new HttpError(403, 'Enrollment history access denied');
  }
  return findStudentEnrollmentHistory(studentUserId);
}

export function getMyEnrollmentHistory(user: AuthUser) {
  return findStudentEnrollmentHistory(user.id);
}

export async function createStudentEnrollment(
  user: AuthUser,
  input: CreateEnrollmentInput,
) {
  requireAdmin(user);
  if (!(await studentUserIsEligible(input.student_user_id))) {
    throw new HttpError(409, 'User must be an active student account');
  }
  const { classroom, academicYear } = await getEnrollmentClassroom(
    input.classroom_id,
  );
  ensureDateInsideAcademicYear(input.enrolled_at, academicYear, 'enrolled_at');
  const existing = await findActiveEnrollment(
    input.student_user_id,
    classroom.academic_year_id!,
  );
  if (existing) {
    throw new HttpError(
      409,
      existing.classroom_id === classroom.id
        ? 'Student is already active in this classroom'
        : 'Student already has an active classroom in this academic year',
    );
  }
  let enrollment: Awaited<ReturnType<typeof createEnrollmentRecord>>;
  try {
    enrollment = await createEnrollmentRecord({
      ...input,
      academic_year_id: classroom.academic_year_id!,
      created_by_user_id: user.id,
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      throw new HttpError(
        409,
        'Student already has an active classroom in this academic year',
      );
    }
    throw error;
  }
  if (!enrollment) throw new HttpError(500, 'Failed to create enrollment');
  return enrollment;
}

export async function transferStudentEnrollment(
  user: AuthUser,
  id: number,
  input: TransferEnrollmentInput,
) {
  requireAdmin(user);
  const current = await getEnrollmentOrThrow(id);
  if (current.status !== 'active') {
    throw new HttpError(409, 'Only an active enrollment can be transferred');
  }
  if (current.classroom_id === input.target_classroom_id) {
    throw new HttpError(409, 'Target classroom must be different');
  }
  await assertAcademicYearWritable(current.academic_year_id);
  const { classroom: target, academicYear } = await getEnrollmentClassroom(
    input.target_classroom_id,
  );
  if (target.academic_year_id !== current.academic_year_id) {
    throw new HttpError(
      409,
      'Transfer target must belong to the same academic year',
    );
  }
  if (input.effective_date < current.enrolled_at) {
    throw new HttpError(
      400,
      'effective_date cannot be before enrollment date',
    );
  }
  ensureDateInsideAcademicYear(
    input.effective_date,
    academicYear,
    'effective_date',
  );
  const enrollment = await transferEnrollmentRecord(id, {
    ...input,
    academic_year_id: current.academic_year_id,
    student_user_id: current.student_user_id,
    created_by_user_id: user.id,
  });
  if (!enrollment) {
    throw new HttpError(409, 'Enrollment is no longer active');
  }
  return enrollment;
}

export async function endStudentEnrollment(
  user: AuthUser,
  id: number,
  input: EndEnrollmentInput,
) {
  requireAdmin(user);
  const current = await getEnrollmentOrThrow(id);
  if (current.status !== 'active') {
    throw new HttpError(409, 'Only an active enrollment can be ended');
  }
  const academicYear = await assertAcademicYearWritable(
    current.academic_year_id,
  );
  if (input.effective_date < current.enrolled_at) {
    throw new HttpError(
      400,
      'effective_date cannot be before enrollment date',
    );
  }
  ensureDateInsideAcademicYear(
    input.effective_date,
    academicYear,
    'effective_date',
  );
  const enrollment = await endEnrollmentRecord(id, input);
  if (!enrollment) {
    throw new HttpError(409, 'Enrollment is no longer active');
  }
  return enrollment;
}
