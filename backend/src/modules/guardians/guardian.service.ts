import type { AuthUser } from '../auth/auth.types.js';
import { findStudentAttendance } from '../attendance/attendance.repository.js';
import { getAuthorizedStudentTranscript } from '../transcripts/transcript.service.js';
import { HttpError } from '../../utils/http-error.js';
import {
  findGuardianLinkAudits,
  findGuardianLinkById,
  findGuardianLinks,
  findGuardianPreferences,
  findVerifiedGuardianChild,
  findVerifiedGuardianChildren,
  insertGuardianAccessAudit,
  inviteGuardianLink,
  transitionGuardianLink,
  updateGuardianPreferencesRecord,
} from './guardian.repository.js';
import type {
  GuardianInviteInput,
  GuardianLinkQuery,
  GuardianPreferencesInput,
  GuardianStudentSummary,
} from './guardian.types.js';

function ensureAdmin(user: AuthUser) {
  if (
    !user.roles.includes('admin') &&
    !user.permissions.includes('guardians.manage')
  ) {
    throw new HttpError(403, 'Guardian management permission required');
  }
}

function ensureGuardian(user: AuthUser) {
  if (
    !user.roles.includes('guardian') ||
    !user.permissions.includes('guardian.children.read')
  ) {
    throw new HttpError(403, 'Guardian role required');
  }
}

function mapRepositoryError(error: unknown): never {
  if (!(error instanceof Error)) throw error;
  if (error.message === 'GUARDIAN_ROLE_REQUIRED') {
    throw new HttpError(400, 'Selected account must have guardian role');
  }
  if (error.message === 'STUDENT_ROLE_REQUIRED') {
    throw new HttpError(400, 'Selected account must have student role');
  }
  if (error.message === 'GUARDIAN_LINK_EXISTS') {
    throw new HttpError(409, 'Guardian-student link already exists');
  }
  if (error.message === 'GUARDIAN_LINK_NOT_FOUND') {
    throw new HttpError(404, 'Guardian link not found');
  }
  if (error.message === 'GUARDIAN_LINK_STATE') {
    throw new HttpError(409, 'Guardian link state has changed');
  }
  throw error;
}

export async function listAdminGuardianLinks(
  user: AuthUser,
  query: GuardianLinkQuery,
) {
  ensureAdmin(user);
  const result = await findGuardianLinks(query);
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

export async function inviteGuardian(
  user: AuthUser,
  input: GuardianInviteInput,
) {
  ensureAdmin(user);
  try {
    return await inviteGuardianLink(input, user.id);
  } catch (error) {
    return mapRepositoryError(error);
  }
}

async function transitionLink(
  user: AuthUser,
  id: number,
  action: 'verify' | 'revoke',
  reason: string | null,
) {
  ensureAdmin(user);
  try {
    return await transitionGuardianLink(id, action, user.id, reason);
  } catch (error) {
    return mapRepositoryError(error);
  }
}

export function verifyGuardian(
  user: AuthUser,
  id: number,
  reason: string | null,
) {
  return transitionLink(user, id, 'verify', reason);
}

export function revokeGuardian(
  user: AuthUser,
  id: number,
  reason: string | null,
) {
  return transitionLink(user, id, 'revoke', reason);
}

export async function listMyGuardianChildren(user: AuthUser) {
  ensureGuardian(user);
  return { data: await findVerifiedGuardianChildren(user.id) };
}

export async function getGuardianStudentSummary(
  user: AuthUser,
  studentUserId: number,
  semesterId?: number,
): Promise<GuardianStudentSummary> {
  ensureGuardian(user);
  const child = await findVerifiedGuardianChild(user.id, studentUserId);
  if (!child) {
    throw new HttpError(403, 'Verified guardian link required');
  }
  let transcript = null;
  try {
    transcript = await getAuthorizedStudentTranscript(studentUserId, semesterId);
  } catch (error) {
    if (!(error instanceof HttpError) || error.statusCode !== 404) throw error;
  }
  const resolvedSemesterId =
    semesterId ?? transcript?.period.semester_id ?? undefined;
  const attendance = await findStudentAttendance(studentUserId, {
    semesterId: resolvedSemesterId,
  });
  await insertGuardianAccessAudit(user.id, studentUserId, resolvedSemesterId);
  return { child, transcript, attendance };
}

export function getMyGuardianPreferences(user: AuthUser) {
  ensureGuardian(user);
  return findGuardianPreferences(user.id);
}

export function updateMyGuardianPreferences(
  user: AuthUser,
  input: GuardianPreferencesInput,
) {
  ensureGuardian(user);
  return updateGuardianPreferencesRecord(user.id, input);
}

export async function listGuardianAudits(user: AuthUser, linkId: number) {
  ensureAdmin(user);
  if (!(await findGuardianLinkById(linkId))) {
    throw new HttpError(404, 'Guardian link not found');
  }
  return { data: await findGuardianLinkAudits(linkId) };
}
