import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { uploadRateLimiter } from '../../config/security.js';
import { avatarUpload } from '../media/media-upload.js';
import {
  createStudentController,
  createTeacherController,
  getMyProfileController,
  listStudentsController,
  listTeachersController,
  requireMyProfileForAvatar,
  updateMyProfileController,
  uploadMyAvatarController,
  updateStudentController,
  updateTeacherController,
} from './profile.controller.js';

export const profileRoutes = Router();

profileRoutes.use(requireAuth);
profileRoutes.get('/me', getMyProfileController);
profileRoutes.patch('/me', updateMyProfileController);
profileRoutes.post(
  '/me/avatar',
  uploadRateLimiter,
  requireMyProfileForAvatar,
  avatarUpload.single('file'),
  uploadMyAvatarController,
);
profileRoutes.get('/teachers', listTeachersController);
profileRoutes.get('/students', listStudentsController);
profileRoutes.post('/teachers', createTeacherController);
profileRoutes.post('/students', createStudentController);
profileRoutes.patch('/teachers/:id', updateTeacherController);
profileRoutes.patch('/students/:id', updateStudentController);
