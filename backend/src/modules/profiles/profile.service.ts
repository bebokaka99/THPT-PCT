import type { AuthUser } from '../auth/auth.types.js';
import { HttpError } from '../../utils/http-error.js';
import { deleteMedia, saveUploadedMedia } from '../media/media.service.js';
import {
  findStudentProfileByUserId,
  findTeacherProfileByUserId,
  listStudentProfiles,
  listTeacherProfiles,
  updateMyStudentProfile,
  updateMyTeacherProfile,
  updateStudentProfileById,
  updateTeacherProfileById,
  upsertStudentProfile,
  upsertTeacherProfile,
} from './profile.repository.js';
import type { UpdateMyProfileInput, UpsertStudentProfileInput, UpsertTeacherProfileInput } from './profile.types.js';

function isAdmin(user: AuthUser) {
  return user.roles.includes('admin') || user.permissions.includes('users.manage');
}

function basicUser(user: AuthUser) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    roles: user.roles,
  };
}

export async function getMyProfile(user: AuthUser) {
  if (user.roles.includes('teacher')) {
    return {
      user: basicUser(user),
      profileType: 'teacher' as const,
      profile: await findTeacherProfileByUserId(user.id),
    };
  }

  if (user.roles.includes('student')) {
    return {
      user: basicUser(user),
      profileType: 'student' as const,
      profile: await findStudentProfileByUserId(user.id),
    };
  }

  return {
    user: basicUser(user),
    profileType: user.roles.includes('admin') ? ('admin' as const) : null,
    profile: null,
  };
}

export async function updateMyProfile(user: AuthUser, input: UpdateMyProfileInput) {
  if (user.roles.includes('teacher')) {
    const current = await findTeacherProfileByUserId(user.id);
    if (!current) throw new HttpError(404, 'Teacher profile has not been set up');
    const profile = await updateMyTeacherProfile(user.id, {
      phone: input.phone === undefined ? current.phone : input.phone,
      avatar_url: input.avatar_url === undefined ? current.avatar_url : input.avatar_url,
      bio: input.bio === undefined ? current.bio : input.bio,
    });
    return { user: basicUser(user), profileType: 'teacher' as const, profile };
  }

  if (user.roles.includes('student')) {
    const current = await findStudentProfileByUserId(user.id);
    if (!current) throw new HttpError(404, 'Student profile has not been set up');
    const profile = await updateMyStudentProfile(user.id, {
      phone: input.phone === undefined ? current.phone : input.phone,
      parent_name:
        input.parent_name === undefined ? current.parent_name : input.parent_name,
      parent_phone:
        input.parent_phone === undefined ? current.parent_phone : input.parent_phone,
      permanent_address:
        input.permanent_address === undefined
          ? current.permanent_address
          : input.permanent_address,
      avatar_url: input.avatar_url === undefined ? current.avatar_url : input.avatar_url,
    });
    return { user: basicUser(user), profileType: 'student' as const, profile };
  }

  throw new HttpError(403, 'Only teacher or student profiles can be updated here');
}

export async function uploadMyProfileAvatar(user: AuthUser, file: Express.Multer.File) {
  const current = await getMyProfile(user);
  if (!current.profile || !['teacher', 'student'].includes(current.profileType ?? '')) {
    throw new HttpError(404, 'Profile has not been set up');
  }

  const media = await saveUploadedMedia(file, 'image', user.id);
  try {
    const profile = await updateMyProfile(user, {
      avatar_url: media.variants.medium?.url ?? media.url,
    });
    return { profile, media };
  } catch (error) {
    await deleteMedia(media.id).catch(() => undefined);
    throw error;
  }
}

export async function getTeacherProfiles(user: AuthUser) {
  if (!isAdmin(user)) throw new HttpError(403, 'Permission denied');
  return listTeacherProfiles();
}

export async function getStudentProfiles(user: AuthUser) {
  if (!isAdmin(user)) throw new HttpError(403, 'Permission denied');
  return listStudentProfiles();
}

export async function createTeacherProfile(user: AuthUser, input: UpsertTeacherProfileInput) {
  if (!isAdmin(user)) throw new HttpError(403, 'Permission denied');
  return upsertTeacherProfile(input);
}

export async function createStudentProfile(user: AuthUser, input: UpsertStudentProfileInput) {
  if (!isAdmin(user)) throw new HttpError(403, 'Permission denied');
  return upsertStudentProfile(input);
}

export async function patchTeacherProfile(user: AuthUser, id: number, input: UpsertTeacherProfileInput) {
  if (!isAdmin(user)) throw new HttpError(403, 'Permission denied');
  const updated = await updateTeacherProfileById(id, input);
  if (!updated) throw new HttpError(404, 'Teacher profile not found');
  return updated;
}

export async function patchStudentProfile(user: AuthUser, id: number, input: UpsertStudentProfileInput) {
  if (!isAdmin(user)) throw new HttpError(403, 'Permission denied');
  const updated = await updateStudentProfileById(id, input);
  if (!updated) throw new HttpError(404, 'Student profile not found');
  return updated;
}
