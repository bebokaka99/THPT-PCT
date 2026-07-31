import type { RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  createStudentProfile,
  createTeacherProfile,
  getMyProfile,
  getStudentProfiles,
  getTeacherProfiles,
  patchStudentProfile,
  patchTeacherProfile,
  uploadMyProfileAvatar,
  updateMyProfile,
} from './profile.service.js';
import { validateProfileId, validateStudentProfile, validateTeacherProfile, validateUpdateMyProfile } from './profile.validation.js';

function requireUser(req: Parameters<RequestHandler>[0]) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return req.user;
}

export const getMyProfileController: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await getMyProfile(requireUser(req)) });
  } catch (error) {
    next(error);
  }
};

export const updateMyProfileController: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await updateMyProfile(requireUser(req), validateUpdateMyProfile(req.body)) });
  } catch (error) {
    next(error);
  }
};

export const requireMyProfileForAvatar: RequestHandler = async (req, _res, next) => {
  try {
    const profile = await getMyProfile(requireUser(req));
    if (!profile.profile || !['teacher', 'student'].includes(profile.profileType ?? '')) {
      throw new HttpError(404, 'Profile has not been set up');
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const uploadMyAvatarController: RequestHandler = async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, 'Avatar image is required');
    res.status(201).json({
      data: await uploadMyProfileAvatar(requireUser(req), req.file),
    });
  } catch (error) {
    next(error);
  }
};

export const listTeachersController: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await getTeacherProfiles(requireUser(req)) });
  } catch (error) {
    next(error);
  }
};

export const listStudentsController: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await getStudentProfiles(requireUser(req)) });
  } catch (error) {
    next(error);
  }
};

export const createTeacherController: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json({ data: await createTeacherProfile(requireUser(req), validateTeacherProfile(req.body)) });
  } catch (error) {
    next(error);
  }
};

export const createStudentController: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json({ data: await createStudentProfile(requireUser(req), validateStudentProfile(req.body)) });
  } catch (error) {
    next(error);
  }
};

export const updateTeacherController: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await patchTeacherProfile(requireUser(req), validateProfileId(req.params.id), validateTeacherProfile(req.body)) });
  } catch (error) {
    next(error);
  }
};

export const updateStudentController: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await patchStudentProfile(requireUser(req), validateProfileId(req.params.id), validateStudentProfile(req.body)) });
  } catch (error) {
    next(error);
  }
};
