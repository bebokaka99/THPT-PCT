import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { requirePermission } from '../../middlewares/require-permission.js';
import {
  createEnrollmentController,
  endEnrollmentController,
  getEnrollmentController,
  getMyEnrollmentsController,
  getStudentHistoryController,
  listEnrollmentsController,
  transferEnrollmentController,
} from './enrollment.controller.js';

export const enrollmentRoutes = Router();
const canManage = [requireAuth, requirePermission('enrollments.manage')];

enrollmentRoutes.get('/me', requireAuth, getMyEnrollmentsController);
enrollmentRoutes.get(
  '/students/:userId',
  requireAuth,
  getStudentHistoryController,
);
enrollmentRoutes.get('/', ...canManage, listEnrollmentsController);
enrollmentRoutes.post('/', ...canManage, createEnrollmentController);
enrollmentRoutes.post(
  '/:id/transfer',
  ...canManage,
  transferEnrollmentController,
);
enrollmentRoutes.patch('/:id/status', ...canManage, endEnrollmentController);
enrollmentRoutes.get('/:id', requireAuth, getEnrollmentController);
