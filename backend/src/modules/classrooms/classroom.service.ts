import type { AuthUser } from '../auth/auth.types.js';
import { HttpError } from '../../utils/http-error.js';
import { createClassroomStudentNotification } from '../notifications/notification.service.js';
import {
  assertAcademicYearWritable,
} from '../academic-periods/academic-period.service.js';
import { findAcademicYearByName } from '../academic-periods/academic-period.repository.js';
import {
  createStudentEnrollment,
  endStudentEnrollment,
  getEnrollmentForUser,
} from '../enrollments/enrollment.service.js';
import {
  addMember,
  classroomHasEnrollmentHistory,
  classroomHasTeachingAssignmentHistory,
  createClassroomDocumentRecord,
  createClassroomPostRecord,
  createClassroomRecord,
  deleteClassroomDocumentRecord,
  deleteClassroomPostRecord,
  deleteClassroomRecord,
  findClassroomById,
  findClassroomDocumentById,
  findClassroomPostById,
  findClassrooms,
  isClassroomMember,
  listClassroomDocuments,
  listClassroomPosts,
  listMembers,
  removeTeacherMember,
  updateClassroomDocumentRecord,
  updateClassroomDocumentStatusRecord,
  updateClassroomPostRecord,
  updateClassroomPostStatusRecord,
  updateClassroomRecord,
} from './classroom.repository.js';
import type { ClassroomContentStatus, ClassroomDocumentInput, ClassroomInput, ClassroomPostInput, ListClassroomsQuery, MemberInput, ResolvedClassroomInput } from './classroom.types.js';

function isAdmin(user: AuthUser) {
  return user.roles.includes('admin') || user.permissions.includes('classrooms.manage');
}

function isTeacher(user: AuthUser) {
  return user.roles.includes('teacher') || isAdmin(user);
}

async function ensureClassroomAccess(user: AuthUser, classroomId: number) {
  if (isAdmin(user)) return;
  if (!(await isClassroomMember(classroomId, user.id))) throw new HttpError(403, 'Classroom access denied');
}

async function ensureTeacherCanManageClassroom(user: AuthUser, classroomId: number) {
  if (isAdmin(user)) return;
  if (!isTeacher(user) || !(await isClassroomMember(classroomId, user.id))) {
    throw new HttpError(403, 'You cannot manage this classroom');
  }
}

function ensureAdmin(user: AuthUser) {
  if (!isAdmin(user)) throw new HttpError(403, 'Permission denied');
}

function ensureAuthorOrAdmin(user: AuthUser, authorUserId: number) {
  if (!isAdmin(user) && user.id !== authorUserId) throw new HttpError(403, 'Only author or admin can manage this item');
}

async function resolveClassroomPeriod(
  input: ClassroomInput,
): Promise<ResolvedClassroomInput> {
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
  return {
    ...input,
    school_year: academicYear.name,
    academic_year_id: academicYear.id,
  };
}

export async function listClassroomsForUser(user: AuthUser, query: ListClassroomsQuery) {
  const scope = isAdmin(user)
    ? undefined
    : { userId: user.id, role: user.roles.includes('teacher') ? ('teacher' as const) : ('student' as const) };
  const { classrooms, total } = await findClassrooms(query, scope);
  return { data: classrooms, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function getClassroomForUser(user: AuthUser, classroomId: number) {
  await ensureClassroomAccess(user, classroomId);
  const classroom = await findClassroomById(classroomId);
  if (!classroom) throw new HttpError(404, 'Classroom not found');
  return classroom;
}

export async function createClassroom(user: AuthUser, input: ClassroomInput) {
  ensureAdmin(user);
  const classroom = await createClassroomRecord(await resolveClassroomPeriod(input));
  if (!classroom) throw new HttpError(500, 'Failed to create classroom');
  return classroom;
}

export async function updateClassroom(user: AuthUser, id: number, input: ClassroomInput) {
  ensureAdmin(user);
  const classroom = await updateClassroomRecord(
    id,
    await resolveClassroomPeriod(input),
  );
  if (!classroom) throw new HttpError(404, 'Classroom not found');
  return classroom;
}

export async function deleteClassroom(user: AuthUser, id: number) {
  ensureAdmin(user);
  if (
    (await classroomHasEnrollmentHistory(id)) ||
    (await classroomHasTeachingAssignmentHistory(id))
  ) {
    throw new HttpError(
      409,
      'Classroom has academic history; deactivate it instead',
    );
  }
  if (!(await deleteClassroomRecord(id))) throw new HttpError(404, 'Classroom not found');
}

export async function getMembers(user: AuthUser, classroomId: number) {
  await ensureClassroomAccess(user, classroomId);
  return listMembers(classroomId);
}

export async function addClassroomMember(user: AuthUser, classroomId: number, input: MemberInput) {
  ensureAdmin(user);
  if (input.role === 'student') {
    const classroom = await findClassroomById(classroomId);
    if (!classroom?.academic_year_id) {
      throw new HttpError(409, 'Classroom does not have an academic year');
    }
    const academicYear = await assertAcademicYearWritable(
      classroom.academic_year_id,
    );
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(new Date());
    const enrolledAt =
      today < academicYear.start_date
        ? academicYear.start_date
        : today > academicYear.end_date
          ? academicYear.end_date
          : today;
    await createStudentEnrollment(user, {
      student_user_id: input.user_id,
      classroom_id: classroomId,
      enrolled_at: enrolledAt,
      note: 'Assigned from classroom member management',
    });
    return listMembers(classroomId);
  }
  return addMember(classroomId, input);
}

export async function removeClassroomMember(
  user: AuthUser,
  classroomId: number,
  memberId: number,
  role?: 'teacher' | 'student',
) {
  ensureAdmin(user);
  if (role === 'student') {
    const current = await getEnrollmentForUser(user, memberId);
    if (current.classroom_id !== classroomId) {
      throw new HttpError(404, 'Classroom member not found');
    }
    const academicYear = await assertAcademicYearWritable(
      current.academic_year_id,
    );
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(new Date());
    const effectiveDate =
      today < academicYear.start_date
        ? academicYear.start_date
        : today > academicYear.end_date
          ? academicYear.end_date
          : today;
    await endStudentEnrollment(user, memberId, {
      status: 'withdrawn',
      effective_date: effectiveDate,
      note: 'Removed from classroom member management',
    });
    return;
  }
  if (!(await removeTeacherMember(classroomId, memberId))) {
    throw new HttpError(404, 'Classroom member not found');
  }
}

export async function getClassroomPosts(user: AuthUser, classroomId: number) {
  await ensureClassroomAccess(user, classroomId);
  return listClassroomPosts(classroomId, user.id, user.roles);
}

export async function createClassroomPost(user: AuthUser, classroomId: number, input: ClassroomPostInput) {
  await ensureTeacherCanManageClassroom(user, classroomId);
  const post = await createClassroomPostRecord(classroomId, user.id, input);
  if (!post) throw new HttpError(500, 'Failed to create classroom post');
  return post;
}

export async function updateClassroomPost(user: AuthUser, classroomId: number, postId: number, input: ClassroomPostInput) {
  await ensureTeacherCanManageClassroom(user, classroomId);
  const existing = await findClassroomPostById(postId);
  if (!existing || existing.classroom_id !== classroomId) throw new HttpError(404, 'Classroom post not found');
  ensureAuthorOrAdmin(user, existing.author_user_id);
  return updateClassroomPostRecord(postId, input);
}

export async function setClassroomPostStatus(user: AuthUser, classroomId: number, postId: number, status: ClassroomContentStatus) {
  await ensureTeacherCanManageClassroom(user, classroomId);
  const existing = await findClassroomPostById(postId);
  if (!existing || existing.classroom_id !== classroomId) throw new HttpError(404, 'Classroom post not found');
  ensureAuthorOrAdmin(user, existing.author_user_id);
  const post = await updateClassroomPostStatusRecord(postId, status);
  if (status === 'published' && post) {
    await createClassroomStudentNotification({
      classroomId,
      createdByUserId: user.id,
      title: `Thong bao lop: ${post.title}`,
      message: post.content || 'Co thong bao moi trong lop hoc.',
      kind: 'post',
      relatedUrl: user.roles.includes('admin') ? `/admin/classrooms/${classroomId}` : `/student/classes/${classroomId}`,
    });
  }
  return post;
}

export async function deleteClassroomPost(user: AuthUser, classroomId: number, postId: number) {
  await ensureTeacherCanManageClassroom(user, classroomId);
  const existing = await findClassroomPostById(postId);
  if (!existing || existing.classroom_id !== classroomId) throw new HttpError(404, 'Classroom post not found');
  ensureAuthorOrAdmin(user, existing.author_user_id);
  await deleteClassroomPostRecord(postId);
}

export async function getClassroomDocuments(user: AuthUser, classroomId: number) {
  await ensureClassroomAccess(user, classroomId);
  return listClassroomDocuments(classroomId, user.id, user.roles);
}

export async function createClassroomDocument(user: AuthUser, classroomId: number, input: ClassroomDocumentInput) {
  await ensureTeacherCanManageClassroom(user, classroomId);
  const document = await createClassroomDocumentRecord(classroomId, user.id, input);
  if (!document) throw new HttpError(500, 'Failed to create classroom document');
  return document;
}

export async function updateClassroomDocument(user: AuthUser, classroomId: number, documentId: number, input: ClassroomDocumentInput) {
  await ensureTeacherCanManageClassroom(user, classroomId);
  const existing = await findClassroomDocumentById(documentId);
  if (!existing || existing.classroom_id !== classroomId) throw new HttpError(404, 'Classroom document not found');
  ensureAuthorOrAdmin(user, existing.author_user_id);
  return updateClassroomDocumentRecord(documentId, input);
}

export async function setClassroomDocumentStatus(user: AuthUser, classroomId: number, documentId: number, status: ClassroomContentStatus) {
  await ensureTeacherCanManageClassroom(user, classroomId);
  const existing = await findClassroomDocumentById(documentId);
  if (!existing || existing.classroom_id !== classroomId) throw new HttpError(404, 'Classroom document not found');
  ensureAuthorOrAdmin(user, existing.author_user_id);
  const document = await updateClassroomDocumentStatusRecord(documentId, status);
  if (status === 'published' && document) {
    await createClassroomStudentNotification({
      classroomId,
      createdByUserId: user.id,
      title: `Tai lieu lop: ${document.title}`,
      message: document.description || 'Co tai lieu moi trong lop hoc.',
      kind: 'document',
      relatedUrl: user.roles.includes('admin') ? `/admin/classrooms/${classroomId}` : `/student/classes/${classroomId}`,
    });
  }
  return document;
}

export async function deleteClassroomDocument(user: AuthUser, classroomId: number, documentId: number) {
  await ensureTeacherCanManageClassroom(user, classroomId);
  const existing = await findClassroomDocumentById(documentId);
  if (!existing || existing.classroom_id !== classroomId) throw new HttpError(404, 'Classroom document not found');
  ensureAuthorOrAdmin(user, existing.author_user_id);
  await deleteClassroomDocumentRecord(documentId);
}
