import type { AuthUser } from '../auth/auth.types.js';
import { assertSemesterWritable } from '../academic-periods/academic-period.service.js';
import { findTranscriptPeriod } from '../transcripts/transcript.repository.js';
import { HttpError } from '../../utils/http-error.js';
import {
  ConductWorkflowConflictError,
  findClassroomConductRoster,
  findConductAudits,
  findConductRecordById,
  findPublishedConductForStudent,
  isClassroomHomeroomTeacher,
  findStudentConductContext,
  transitionConductRecord,
  upsertConductRecord,
} from './conduct.repository.js';
import type {
  ConductListQuery,
  ConductStatus,
  ConductUpsertInput,
} from './conduct.types.js';

function isAdmin(user: AuthUser) {
  return user.roles.includes('admin');
}

function isTeacher(user: AuthUser) {
  return user.roles.includes('teacher');
}

function isReviewer(user: AuthUser) {
  return isAdmin(user) || user.permissions.includes('conduct.review');
}

async function ensureHomeroomScope(user: AuthUser, classroomId: number) {
  if (isAdmin(user)) return;
  if (!isTeacher(user)) throw new HttpError(403, 'Conduct access denied');
  if (!(await isClassroomHomeroomTeacher(classroomId, user.id))) {
    throw new HttpError(403, 'Only the homeroom teacher can manage conduct records');
  }
}

async function recordForManager(user: AuthUser, id: number) {
  const record = await findConductRecordById(id);
  if (!record) throw new HttpError(404, 'Conduct record not found');
  await ensureHomeroomScope(user, record.classroom_id);
  return record;
}

async function resolvedSemesterId(studentUserId: number, semesterId?: number) {
  const period = await findTranscriptPeriod(
    semesterId,
    semesterId ? undefined : studentUserId,
  );
  if (!period) throw new HttpError(404, 'No conduct period found');
  return Number(period.id);
}

export async function getMyConduct(user: AuthUser, semesterId?: number) {
  if (!user.roles.includes('student') && !isAdmin(user)) {
    throw new HttpError(403, 'Student role required');
  }
  if (isAdmin(user) && !user.roles.includes('student')) {
    throw new HttpError(400, 'Admin must select a student');
  }
  const resolved = await resolvedSemesterId(user.id, semesterId);
  return findPublishedConductForStudent(user.id, resolved);
}

export async function listConductRoster(
  user: AuthUser,
  query: ConductListQuery,
) {
  await ensureHomeroomScope(user, query.classroom_id);
  return {
    data: await findClassroomConductRoster(
      query.classroom_id,
      query.semester_id,
    ),
  };
}

export async function saveStudentConduct(
  user: AuthUser,
  studentUserId: number,
  input: ConductUpsertInput,
) {
  const context = await findStudentConductContext(
    studentUserId,
    input.semester_id,
  );
  if (!context) {
    throw new HttpError(404, 'Student enrollment not found for semester');
  }
  await ensureHomeroomScope(user, Number(context.classroom_id));
  await assertSemesterWritable(input.semester_id);
  try {
    return await upsertConductRecord(
      {
        student_user_id: studentUserId,
        classroom_id: Number(context.classroom_id),
        academic_year_id: Number(context.academic_year_id),
      },
      input,
      user.id,
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'CONDUCT_NOT_DRAFT') {
      throw new HttpError(409, 'Only draft conduct records can be edited');
    }
    throw error;
  }
}

function workflowConflict(error: unknown): never {
  if (error instanceof ConductWorkflowConflictError) {
    if (error.message === 'NOT_FOUND') {
      throw new HttpError(404, 'Conduct record not found');
    }
    throw new HttpError(409, 'Conduct workflow state has changed');
  }
  throw error;
}

async function conductTransition(
  user: AuthUser,
  id: number,
  targetStatus: ConductStatus,
  action: 'submit' | 'approve' | 'reject' | 'lock',
  reason: string | null,
) {
  const record = await recordForManager(user, id);
  if (action !== 'submit' && !isReviewer(user)) {
    throw new HttpError(403, 'Conduct review permission required');
  }
  await assertSemesterWritable(record.semester_id);
  try {
    return await transitionConductRecord(
      id,
      targetStatus,
      user.id,
      action,
      reason,
    );
  } catch (error) {
    return workflowConflict(error);
  }
}

export function submitConduct(
  user: AuthUser,
  id: number,
  reason: string | null,
) {
  return conductTransition(user, id, 'submitted', 'submit', reason);
}

export function approveConduct(
  user: AuthUser,
  id: number,
  reason: string | null,
) {
  return conductTransition(user, id, 'approved', 'approve', reason);
}

export function rejectConduct(user: AuthUser, id: number, reason: string) {
  return conductTransition(user, id, 'draft', 'reject', reason);
}

export function lockConduct(
  user: AuthUser,
  id: number,
  reason: string | null,
) {
  return conductTransition(user, id, 'locked', 'lock', reason);
}

export async function listConductAudits(user: AuthUser, id: number) {
  await recordForManager(user, id);
  return { data: await findConductAudits(id) };
}
