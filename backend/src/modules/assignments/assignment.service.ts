import type { AuthUser } from '../auth/auth.types.js';
import { HttpError } from '../../utils/http-error.js';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { assignmentSubmissionUploadRoot } from './assignment-upload.js';
import { findVerifiedGuardianChild } from '../guardians/guardian.repository.js';
import { createAssignmentStudentNotification } from '../notifications/notification.service.js';
import {
  deleteAssignmentRecord,
  findAssignmentById,
  findAssignmentDetail,
  findAssignments,
  findAssignmentSubmissions,
  findAssignmentRoster,
  findSubmissionById,
  findSubmissionFile,
  findTeachingScope,
  insertAssignment,
  reviewAssignmentSubmission,
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
    max_score: input.max_score === undefined ? assignment.max_score : input.max_score,
    guardian_can_view_feedback:
      input.guardian_can_view_feedback === undefined
        ? assignment.guardian_can_view_feedback
        : input.guardian_can_view_feedback,
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
  return findAssignmentRoster(id);
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
  const contentText = input.content_text?.trim() || null;
  const linkUrl = input.link_url?.trim() || null;
  if (!file && !contentText && !linkUrl) {
    throw new HttpError(400, 'Submission requires text, a link, or a file');
  }
  try {
    return await saveStudentSubmission(
      id,
      user.id,
      {
        note: input.note?.trim() || null,
        content_text: contentText,
        link_url: linkUrl,
        file: file
          ? {
              storage_path: file.filename,
              original_name: file.originalname,
              mime_type: file.mimetype,
              size: file.size,
            }
          : null,
      },
    );
  } catch (error) {
    if (file?.path) await unlink(file.path).catch(() => undefined);
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
      if (error.message === 'ASSIGNMENT_CONTENT_REQUIRED') {
        throw new HttpError(400, 'Submission requires text, a link, or a file');
      }
    }
    throw error;
  }
}

export async function reviewSubmission(
  user: AuthUser,
  assignmentId: number,
  submissionId: number,
  input: { action: 'return' | 'grade'; feedback: string | null; score: number | null },
) {
  const assignment = await assignmentOrThrow(assignmentId);
  ensureTeacherOwnsAssignment(user, assignment);
  const result = await reviewAssignmentSubmission(assignmentId, submissionId, user.id, input).catch((error: unknown) => {
    if (error instanceof Error && error.message === 'ASSIGNMENT_SUBMISSION_NOT_FOUND') {
      throw new HttpError(404, 'Submission not found');
    }
    if (error instanceof Error && error.message === 'ASSIGNMENT_SCORE_REQUIRED') {
      throw new HttpError(400, 'This assignment requires a score before grading');
    }
    if (error instanceof Error && error.message === 'ASSIGNMENT_SCORE_EXCEEDS_MAX') {
      throw new HttpError(400, 'Score cannot exceed the assignment max score');
    }
    throw error;
  });
  if (!result.submission) throw new HttpError(404, 'Submission not found');
  await createAssignmentStudentNotification({
    classroomId: assignment.classroom_id,
    createdByUserId: user.id,
    assignmentId,
    title: input.action === 'grade' ? `Bai tap da duoc cham: ${assignment.title}` : `Bai tap can cap nhat: ${assignment.title}`,
    message: input.feedback || (input.action === 'grade' ? 'Giao vien da cham bai.' : 'Giao vien da tra bai de em cap nhat.'),
    publishedAt: new Date(),
  });
  return result.submission;
}

export async function downloadSubmissionFile(
  user: AuthUser,
  assignmentId: number,
  submissionId: number,
  fileId: number,
) {
  const file = await findSubmissionFile(assignmentId, submissionId, fileId);
  if (!file) throw new HttpError(404, 'Submission file not found');
  const allowed =
    isAdmin(user) ||
    file.student_user_id === user.id ||
    (isTeacher(user) && file.teacher_user_id === user.id);
  if (!allowed) throw new HttpError(403, 'Submission file access denied');
  if (!file.storage_path) throw new HttpError(404, 'Private file is not available');
  const root = path.resolve(assignmentSubmissionUploadRoot);
  const filePath = path.resolve(root, file.storage_path);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    throw new HttpError(400, 'Invalid submission file path');
  }
  return { path: filePath, name: file.original_name, mimeType: file.mime_type };
}

export async function listGuardianAssignments(
  user: AuthUser,
  studentId: number,
  query: AssignmentListQuery,
) {
  if (!user.roles.includes('guardian')) throw new HttpError(403, 'Guardian role required');
  if (!(await findVerifiedGuardianChild(user.id, studentId))) {
    throw new HttpError(403, 'Guardian-child link is not verified');
  }
  const result = await findAssignments(query, { role: 'student', userId: studentId });
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
