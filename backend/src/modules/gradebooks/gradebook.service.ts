import type { AuthUser } from '../auth/auth.types.js';
import { assertSemesterWritable } from '../academic-periods/academic-period.service.js';
import { HttpError } from '../../utils/http-error.js';
import { createGradebookWorkflowNotification } from '../notifications/notification.service.js';
import { findVerifiedGuardianChild } from '../guardians/guardian.repository.js';
import {
  createGradebookChangeRequestRecord,
  findGradebookChangeRequests,
  findGradebookAudits,
  findGradebookDetail,
  findGradebookSetup,
  findGradebooks,
  findGradebookSummaryById,
  findGradebookWorkflowAudits,
  findPublishedGradeFilterOptionsForStudent,
  findPublishedGradesForStudent,
  insertGradebook,
  reviewGradebookChangeRequestRecord,
  saveGradebookScores,
  transitionGradebookStatus,
  GradebookWorkflowConflictError,
  ScoreVersionConflictError,
} from './gradebook.repository.js';
import type {
  GradebookCreateInput,
  GradebookListQuery,
  GradebookScoreBatchInput,
  StudentGradeQuery,
} from './gradebook.types.js';

function isAdmin(user: AuthUser) {
  return user.roles.includes('admin');
}

function isTeacher(user: AuthUser) {
  return user.roles.includes('teacher');
}

function isReviewer(user: AuthUser) {
  return isAdmin(user) || user.permissions.includes('gradebooks.review');
}

async function gradebookForManager(user: AuthUser, id: number) {
  const gradebook = await findGradebookSummaryById(id);
  if (!gradebook) throw new HttpError(404, 'Gradebook not found');
  if (!isAdmin(user) && (!isTeacher(user) || gradebook.teacher_user_id !== user.id)) {
    throw new HttpError(403, 'Gradebook management scope denied');
  }
  return gradebook;
}

export async function listGradebooks(
  user: AuthUser,
  query: GradebookListQuery,
) {
  if (!isAdmin(user) && !isTeacher(user)) {
    throw new HttpError(403, 'Gradebook access denied');
  }
  const result = await findGradebooks(
    query,
    isAdmin(user) ? undefined : user.id,
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

async function publishedGradesForStudent(
  studentUserId: number,
  query: StudentGradeQuery,
) {
  const [data, filters] = await Promise.all([
    findPublishedGradesForStudent(studentUserId, query),
    findPublishedGradeFilterOptionsForStudent(studentUserId),
  ]);
  return { data, filters };
}

export async function listMyPublishedGrades(
  user: AuthUser,
  query: StudentGradeQuery,
) {
  if (!user.roles.includes('student') && !isAdmin(user)) {
    throw new HttpError(403, 'Student role required');
  }
  if (isAdmin(user)) {
    return {
      data: [],
      filters: { academic_years: [], semesters: [], subjects: [] },
    };
  }
  return publishedGradesForStudent(user.id, query);
}

export async function listGuardianStudentPublishedGrades(
  user: AuthUser,
  studentUserId: number,
  query: StudentGradeQuery,
) {
  if (
    !user.roles.includes('guardian') ||
    !user.permissions.includes('guardian.children.read')
  ) {
    throw new HttpError(403, 'Guardian role required');
  }
  if (!(await findVerifiedGuardianChild(user.id, studentUserId))) {
    throw new HttpError(403, 'Verified guardian link required');
  }
  return publishedGradesForStudent(studentUserId, query);
}

export async function getGradebook(user: AuthUser, id: number) {
  await gradebookForManager(user, id);
  const detail = await findGradebookDetail(id);
  if (!detail) throw new HttpError(404, 'Gradebook not found');
  return detail;
}

export async function createGradebook(
  user: AuthUser,
  input: GradebookCreateInput,
) {
  if (!isAdmin(user) && !isTeacher(user)) {
    throw new HttpError(403, 'Teacher role required');
  }
  const setup = await findGradebookSetup(input.teaching_assignment_id);
  if (!setup) throw new HttpError(404, 'Teaching assignment not found');
  if (setup.status !== 'active') {
    throw new HttpError(409, 'Teaching assignment is not active');
  }
  if (!isAdmin(user) && Number(setup.teacher_user_id) !== user.id) {
    throw new HttpError(403, 'Teacher is not assigned to this class and subject');
  }
  if (!setup.configuration_id) {
    throw new HttpError(
      409,
      'No active assessment configuration matches this class, subject and semester',
    );
  }
  await assertSemesterWritable(Number(setup.semester_id));
  return insertGradebook(setup, user.id);
}

export async function updateGradebookScores(
  user: AuthUser,
  id: number,
  input: GradebookScoreBatchInput,
) {
  const gradebook = await gradebookForManager(user, id);
  if (gradebook.status !== 'draft') {
    throw new HttpError(409, 'Scores can only be changed while gradebook is draft');
  }
  await assertSemesterWritable(gradebook.semester_id);
  try {
    const detail = await saveGradebookScores(id, input, user.id);
    if (!detail) throw new HttpError(404, 'Gradebook not found');
    return detail;
  } catch (error) {
    if (error instanceof ScoreVersionConflictError) {
      throw new HttpError(
        409,
        `Score was changed by another session (student ${error.studentUserId}, column ${error.columnId}, current version ${error.currentVersion})`,
      );
    }
    if (
      error instanceof Error &&
      /score column|student is not enrolled|score exceeds/i.test(error.message)
    ) {
      throw new HttpError(400, error.message);
    }
    throw error;
  }
}

export async function listGradebookAudits(user: AuthUser, id: number) {
  await gradebookForManager(user, id);
  return { data: await findGradebookAudits(id) };
}

function workflowError(error: unknown): never {
  if (error instanceof GradebookWorkflowConflictError) {
    if (error.message === 'GRADEBOOK_NOT_FOUND') {
      throw new HttpError(404, 'Gradebook not found');
    }
    if (error.message === 'REQUEST_NOT_FOUND') {
      throw new HttpError(404, 'Gradebook change request not found');
    }
    if (error.message === 'SELF_REVIEW_NOT_ALLOWED') {
      throw new HttpError(403, 'Requester cannot review their own change request');
    }
    if (error.message === 'GRADEBOOK_NOT_LOCKED') {
      throw new HttpError(409, 'Gradebook must be locked for this action');
    }
    throw new HttpError(409, 'Gradebook workflow state has changed');
  }
  throw error;
}

async function notifyWorkflow(
  user: AuthUser,
  gradebook: Awaited<ReturnType<typeof gradebookForManager>>,
  recipient: 'admin' | 'teacher' | 'students',
  title: string,
  message: string,
) {
  await createGradebookWorkflowNotification({
    createdByUserId: user.id,
    recipient,
    teacherUserId: gradebook.teacher_user_id,
    classroomId: gradebook.classroom_id,
    title,
    message,
    relatedUrl:
      recipient === 'admin'
        ? '/admin/gradebooks'
        : recipient === 'teacher'
          ? '/teacher/gradebook'
          : '/student/grades',
  });
}

export async function submitGradebook(
  user: AuthUser,
  id: number,
  reason: string | null,
) {
  const gradebook = await gradebookForManager(user, id);
  await assertSemesterWritable(gradebook.semester_id);
  try {
    const result = await transitionGradebookStatus(
      id,
      'submitted',
      user.id,
      'submit',
      reason,
    );
    if (result.changed && result.gradebook) {
      await notifyWorkflow(
        user,
        result.gradebook,
        'admin',
        `Sổ điểm chờ duyệt: ${result.gradebook.classroom_name}`,
        `${result.gradebook.subject_name} · ${result.gradebook.teacher_name}`,
      );
    }
    return result.gradebook;
  } catch (error) {
    return workflowError(error);
  }
}

async function reviewTransition(
  user: AuthUser,
  id: number,
  target: 'approved' | 'draft' | 'locked',
  action: 'approve' | 'reject' | 'lock',
  reason: string | null,
) {
  if (!isReviewer(user)) throw new HttpError(403, 'Gradebook review permission required');
  const gradebook = await gradebookForManager(user, id);
  try {
    const result = await transitionGradebookStatus(
      id,
      target,
      user.id,
      action,
      reason,
    );
    if (result.changed && result.gradebook) {
      if (action === 'approve') {
        await Promise.all([
          notifyWorkflow(
            user,
            result.gradebook,
            'teacher',
            'Sổ điểm đã được duyệt',
            `${result.gradebook.classroom_name} · ${result.gradebook.subject_name}`,
          ),
          notifyWorkflow(
            user,
            result.gradebook,
            'students',
            'Kết quả học tập mới',
            `${result.gradebook.subject_name} đã được nhà trường duyệt.`,
          ),
        ]);
      } else if (action === 'reject') {
        await notifyWorkflow(
          user,
          result.gradebook,
          'teacher',
          'Sổ điểm cần chỉnh sửa',
          reason!,
        );
      } else {
        await notifyWorkflow(
          user,
          result.gradebook,
          'teacher',
          'Sổ điểm đã khóa',
          `${result.gradebook.classroom_name} · ${result.gradebook.subject_name}`,
        );
      }
    }
    return result.gradebook;
  } catch (error) {
    return workflowError(error);
  }
}

export function approveGradebook(user: AuthUser, id: number, reason: string | null) {
  return reviewTransition(user, id, 'approved', 'approve', reason);
}

export function rejectGradebook(user: AuthUser, id: number, reason: string) {
  return reviewTransition(user, id, 'draft', 'reject', reason);
}

export function lockGradebook(user: AuthUser, id: number, reason: string | null) {
  return reviewTransition(user, id, 'locked', 'lock', reason);
}

export async function createGradebookChangeRequest(
  user: AuthUser,
  id: number,
  reason: string,
) {
  const gradebook = await gradebookForManager(user, id);
  try {
    const result = await createGradebookChangeRequestRecord(id, user.id, reason);
    if (result.changed) {
      await notifyWorkflow(
        user,
        gradebook,
        'admin',
        'Yêu cầu mở khóa sổ điểm',
        `${gradebook.classroom_name} · ${gradebook.subject_name}: ${reason}`,
      );
    }
    return result.request;
  } catch (error) {
    return workflowError(error);
  }
}

export async function listGradebookChangeRequests(user: AuthUser) {
  if (!isReviewer(user)) throw new HttpError(403, 'Gradebook review permission required');
  return { data: await findGradebookChangeRequests() };
}

export async function reviewGradebookChangeRequest(
  user: AuthUser,
  requestId: number,
  decision: 'approved' | 'rejected',
  note: string,
) {
  if (!isReviewer(user)) throw new HttpError(403, 'Gradebook review permission required');
  try {
    const result = await reviewGradebookChangeRequestRecord(
      requestId,
      user.id,
      decision,
      note,
    );
    if (result.changed && result.gradebook) {
      await notifyWorkflow(
        user,
        result.gradebook,
        'teacher',
        decision === 'approved'
          ? 'Yêu cầu sửa điểm đã được duyệt'
          : 'Yêu cầu sửa điểm bị từ chối',
        note,
      );
    }
    return result.request;
  } catch (error) {
    return workflowError(error);
  }
}

export async function listGradebookWorkflowAudits(
  user: AuthUser,
  id: number,
) {
  await gradebookForManager(user, id);
  return { data: await findGradebookWorkflowAudits(id) };
}
