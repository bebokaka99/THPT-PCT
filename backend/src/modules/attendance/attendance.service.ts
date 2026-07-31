import type { AuthUser } from '../auth/auth.types.js';
import { HttpError } from '../../utils/http-error.js';
import { findSemesterById } from '../academic-periods/academic-period.repository.js';
import { findClassroomById } from '../classrooms/classroom.repository.js';
import {
  findAttendanceAudits,
  findAttendanceSessionById,
  findAttendanceSessionDetail,
  findAttendanceSessions,
  findClassroomAttendanceSummary,
  findStudentAttendance,
  insertAttendanceSession,
  saveAttendanceRecords,
  teacherCanManageAttendanceScope,
} from './attendance.repository.js';
import type {
  AttendanceBulkInput,
  AttendanceListQuery,
  AttendanceSession,
  AttendanceSessionInput,
} from './attendance.types.js';

function isAdmin(user: AuthUser) {
  return user.roles.includes('admin');
}

function isTeacher(user: AuthUser) {
  return user.roles.includes('teacher');
}

function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date());
}

async function sessionOrThrow(id: number) {
  const session = await findAttendanceSessionById(id);
  if (!session) throw new HttpError(404, 'Attendance session not found');
  return session;
}

async function teacherScopeForSession(
  user: AuthUser,
  session: AttendanceSession,
) {
  if (isAdmin(user)) return { isHomeroom: true, assignmentId: null };
  if (!isTeacher(user)) throw new HttpError(403, 'Teacher role required');
  const scope = await teacherCanManageAttendanceScope(user.id, {
    classroom_id: session.classroom_id,
    semester_id: session.semester_id,
    subject_id: session.subject_id ?? undefined,
    teaching_assignment_id: session.teaching_assignment_id ?? undefined,
    session_date: session.session_date,
  });
  if (!scope.isHomeroom && !scope.assignmentId) {
    throw new HttpError(403, 'Attendance scope denied');
  }
  return scope;
}

export async function listAttendanceSessions(
  user: AuthUser,
  query: AttendanceListQuery,
) {
  if (!isAdmin(user) && !isTeacher(user)) {
    throw new HttpError(403, 'Attendance session access denied');
  }
  const result = await findAttendanceSessions(
    query,
    isAdmin(user) ? undefined : { teacher_user_id: user.id },
  );
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

export async function getAttendanceSession(user: AuthUser, id: number) {
  const session = await sessionOrThrow(id);
  await teacherScopeForSession(user, session);
  return findAttendanceSessionDetail(id);
}

export async function createAttendanceSession(
  user: AuthUser,
  input: AttendanceSessionInput,
) {
  const classroom = await findClassroomById(input.classroom_id);
  if (!classroom) throw new HttpError(404, 'Classroom not found');
  const semester = await findSemesterById(input.semester_id);
  if (!semester) throw new HttpError(404, 'Semester not found');
  if (semester.academic_year_id !== classroom.academic_year_id) {
    throw new HttpError(400, 'Semester does not belong to the classroom');
  }
  if (
    input.session_date < semester.start_date ||
    input.session_date > semester.end_date
  ) {
    throw new HttpError(400, 'session_date must be inside the semester');
  }
  if (!isAdmin(user)) {
    if (!isTeacher(user)) throw new HttpError(403, 'Teacher role required');
    const scope = await teacherCanManageAttendanceScope(user.id, input);
    if (!scope.isHomeroom && !scope.assignmentId) {
      throw new HttpError(403, 'Teacher is not assigned to this class');
    }
    if (!scope.isHomeroom && !input.subject_id) {
      throw new HttpError(400, 'subject_id is required for subject attendance');
    }
    if (!input.teaching_assignment_id && scope.assignmentId) {
      input = { ...input, teaching_assignment_id: scope.assignmentId };
    }
  }
  try {
    return await insertAttendanceSession(input, user.id);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      throw new HttpError(409, 'Attendance session already exists');
    }
    throw error;
  }
}

export async function saveAttendance(
  user: AuthUser,
  sessionId: number,
  input: AttendanceBulkInput,
) {
  const session = await sessionOrThrow(sessionId);
  await teacherScopeForSession(user, session);
  if (session.session_date < today() && !input.correction_reason) {
    throw new HttpError(
      400,
      'correction_reason is required when changing past attendance',
    );
  }
  try {
    return await saveAttendanceRecords(session, input, user.id);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'ATTENDANCE_STUDENT_SCOPE'
    ) {
      throw new HttpError(
        400,
        'All students must belong to the classroom on the attendance date',
      );
    }
    throw error;
  }
}

export async function getAttendanceAudit(user: AuthUser, sessionId: number) {
  const session = await sessionOrThrow(sessionId);
  const scope = await teacherScopeForSession(user, session);
  if (!isAdmin(user) && !scope.isHomeroom && session.created_by_user_id !== user.id) {
    throw new HttpError(403, 'Only admin, homeroom, or session creator can view audit');
  }
  return findAttendanceAudits(sessionId);
}

export function getMyAttendance(
  user: AuthUser,
  filters: { semesterId?: number; from?: string; to?: string } = {},
) {
  if (!user.roles.includes('student') && !user.roles.includes('admin')) {
    throw new HttpError(403, 'Student role required');
  }
  return findStudentAttendance(user.id, filters);
}

export async function getClassroomSummary(
  user: AuthUser,
  classroomId: number,
  filters: { semesterId?: number; from?: string; to?: string } = {},
) {
  if (!isAdmin(user)) {
    const semesterId = filters.semesterId;
    if (!semesterId) {
      throw new HttpError(400, 'semester_id is required for teacher summary');
    }
    const semester = await findSemesterById(semesterId);
    if (!semester) throw new HttpError(404, 'Semester not found');
    const scopeDate =
      today() < semester.start_date
        ? semester.start_date
        : today() > semester.end_date
          ? semester.end_date
          : today();
    const scope = await teacherCanManageAttendanceScope(user.id, {
      classroom_id: classroomId,
      semester_id: semesterId,
      session_date: scopeDate,
    });
    if (!scope.isHomeroom && !scope.assignmentId) {
      throw new HttpError(403, 'Attendance summary scope denied');
    }
  }
  return findClassroomAttendanceSummary(classroomId, filters);
}
