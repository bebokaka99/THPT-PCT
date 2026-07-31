import type { AuthUser } from '../auth/auth.types.js';
import { HttpError } from '../../utils/http-error.js';
import { deleteMedia, saveUploadedMedia } from '../media/media.service.js';
import { validateUploadedFile } from '../media/media.validation.js';
import { createAssignmentStudentNotification } from '../notifications/notification.service.js';
import {
  deleteAssignmentRecord,
  findAssignmentById,
  findAssignmentDetail,
  findAssignments,
  findAssignmentSubmissions,
  findTeachingScope,
  insertAssignment,
  saveStudentSubmission,
  setAssignmentStatusRecord,
  studentCanAccessAssignment,
  updateAssignmentRecord,
} from './assignment.repository.js';
import type {
  Assignment,
  AssignmentInput,
  AssignmentListQuery,
  AssignmentUpdateInput,
  SubmissionInput,
} from './assignment.types.js';

function isAdmin(user: AuthUser) {
  return user.roles.includes('admin');
}

function isTeacher(user: AuthUser) {
  return user.roles.includes('teacher');
}

function isStudent(user: AuthUser) {
  return user.roles.includes('student');
}

function scopeFor(user: AuthUser) {
  if (isAdmin(user)) return { role: 'admin' as const };
  if (isTeacher(user)) return { role: 'teacher' as const, userId: user.id };
  if (isStudent(user)) return { role: 'student' as const, userId: user.id };
  throw new HttpError(403, 'Assignment access denied');
}

async function assignmentOrThrow(id: number) {
  const assignment = await findAssignmentById(id);
  if (!assignment) throw new HttpError(404, 'Assignment not found');
  return assignment;
}

function ensureTeacherOwnsAssignment(user: AuthUser, assignment: Assignment) {
  if (isAdmin(user)) return;
  if (
    !isTeacher(user) ||
    assignment.teacher_user_id !== user.id ||
    assignment.created_by_user_id !== user.id
  ) {
    throw new HttpError(403, 'Assignment management scope denied');
  }
}

export async function listAssignments(
  user: AuthUser,
  query: AssignmentListQuery,
) {
  const result = await findAssignments(query, scopeFor(user));
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

export async function getAssignment(user: AuthUser, id: number) {
  const assignment = await assignmentOrThrow(id);
  if (isStudent(user)) {
    if (!(await studentCanAccessAssignment(id, user.id))) {
      throw new HttpError(403, 'Assignment access denied');
    }
    return findAssignmentDetail(id, user.id);
  }
  if (isTeacher(user) && assignment.teacher_user_id !== user.id) {
    throw new HttpError(403, 'Assignment access denied');
  }
  if (!isAdmin(user) && !isTeacher(user)) {
    throw new HttpError(403, 'Assignment access denied');
  }
  return findAssignmentDetail(id);
}

export async function createAssignment(
  user: AuthUser,
  input: AssignmentInput,
) {
  if (!isAdmin(user) && !isTeacher(user)) {
    throw new HttpError(403, 'Teacher role required');
  }
  const teaching = await findTeachingScope(input.teaching_assignment_id);
  if (!teaching) throw new HttpError(404, 'Teaching assignment not found');
  if (teaching.status !== 'active') {
    throw new HttpError(400, 'Teaching assignment is not active');
  }
  if (!isAdmin(user) && teaching.teacher_user_id !== user.id) {
    throw new HttpError(403, 'Teacher is not assigned to this class and subject');
  }
  try {
    return await insertAssignment(
      input,
      {
        classroom_id: teaching.classroom_id,
        subject_id: teaching.subject_id,
        semester_id: teaching.semester_id,
      },
      user.id,
    );
  } catch (error) {
    if (error instanceof Error && /due date/i.test(error.message)) {
      throw new HttpError(400, 'due_at must be inside the assigned semester');
    }
    throw error;
  }
}

export async function updateAssignment(
  user: AuthUser,
  id: number,
  input: AssignmentUpdateInput,
) {
  const assignment = await assignmentOrThrow(id);
  ensureTeacherOwnsAssignment(user, assignment);
  if (assignment.status !== 'draft') {
    throw new HttpError(409, 'Only draft assignments can be edited');
  }
  return updateAssignmentRecord(id, {
    title: input.title ?? assignment.title,
    description:
      input.description === undefined
        ? assignment.description
        : input.description,
    due_at: input.due_at ?? assignment.due_at,
    allow_late: input.allow_late ?? assignment.allow_late,
    attachments: input.attachments,
  });
}

export async function publishAssignment(user: AuthUser, id: number) {
  const assignment = await assignmentOrThrow(id);
  ensureTeacherOwnsAssignment(user, assignment);
  if (assignment.status !== 'draft') {
    throw new HttpError(409, 'Only draft assignments can be published');
  }
  const published = await setAssignmentStatusRecord(id, 'published');
  if (!published) throw new HttpError(500, 'Failed to publish assignment');
  await createAssignmentStudentNotification({
    classroomId: published.classroom_id,
    createdByUserId: user.id,
    assignmentId: published.id,
    title: `Bai tap moi: ${published.title}`,
    message: `${published.subject_name} - han nop ${new Intl.DateTimeFormat(
      'vi-VN',
      {
        timeZone: 'Asia/Ho_Chi_Minh',
        dateStyle: 'short',
        timeStyle: 'short',
      },
    ).format(new Date(published.due_at))}`,
    publishedAt: new Date(published.published_at!),
  });
  return published;
}

export async function closeAssignment(user: AuthUser, id: number) {
  const assignment = await assignmentOrThrow(id);
  ensureTeacherOwnsAssignment(user, assignment);
  if (assignment.status !== 'published') {
    throw new HttpError(409, 'Only published assignments can be closed');
  }
  return setAssignmentStatusRecord(id, 'closed');
}

export async function removeAssignment(user: AuthUser, id: number) {
  const assignment = await assignmentOrThrow(id);
  ensureTeacherOwnsAssignment(user, assignment);
  if (!(await deleteAssignmentRecord(id))) {
    throw new HttpError(
      409,
      'Only draft assignments without submissions can be deleted',
    );
  }
}

export async function listSubmissions(user: AuthUser, id: number) {
  const assignment = await assignmentOrThrow(id);
  ensureTeacherOwnsAssignment(user, assignment);
  return findAssignmentSubmissions(id);
}

export async function submitAssignment(
  user: AuthUser,
  id: number,
  input: SubmissionInput,
  file: Express.Multer.File | undefined,
) {
  if (!isStudent(user)) throw new HttpError(403, 'Student role required');
  const assignment = await assignmentOrThrow(id);
  if (!(await studentCanAccessAssignment(id, user.id))) {
    throw new HttpError(403, 'Assignment access denied');
  }
  if (assignment.status !== 'published') {
    throw new HttpError(409, 'Assignment is not open for submission');
  }
  if (new Date() > new Date(assignment.due_at) && !assignment.allow_late) {
    throw new HttpError(409, 'Assignment deadline has passed');
  }
  const type = validateUploadedFile(file);
  const media = await saveUploadedMedia(file!, type, user.id);
  try {
    return await saveStudentSubmission(
      id,
      user.id,
      input.note ?? null,
      media,
    );
  } catch (error) {
    await deleteMedia(media.id).catch(() => undefined);
    if (error instanceof Error) {
      if (error.message === 'ASSIGNMENT_NOT_OPEN') {
        throw new HttpError(409, 'Assignment is not open for submission');
      }
      if (error.message === 'ASSIGNMENT_STUDENT_SCOPE') {
        throw new HttpError(403, 'Assignment access denied');
      }
      if (error.message === 'ASSIGNMENT_DEADLINE_PASSED') {
        throw new HttpError(409, 'Assignment deadline has passed');
      }
    }
    throw error;
  }
}
