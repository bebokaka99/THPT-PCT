import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { requirePermission } from '../../middlewares/require-permission.js';
import {
  bulkTeachingAssignmentController,
  createTeachingAssignmentController,
  deleteTeachingAssignmentController,
  getTeachingAssignmentController,
  listMyTeachingAssignmentsController,
  listTeachingAssignmentsController,
  setTeachingAssignmentStatusController,
  updateTeachingAssignmentController,
} from './teaching-assignment.controller.js';

export const teachingAssignmentRoutes = Router();
const canManage = [
  requireAuth,
  requirePermission('teaching_assignments.manage'),
];

teachingAssignmentRoutes.get('/me', requireAuth, listMyTeachingAssignmentsController);
teachingAssignmentRoutes.get('/', ...canManage, listTeachingAssignmentsController);
teachingAssignmentRoutes.post('/', ...canManage, createTeachingAssignmentController);
teachingAssignmentRoutes.post('/bulk', ...canManage, bulkTeachingAssignmentController);
teachingAssignmentRoutes.patch('/:id', ...canManage, updateTeachingAssignmentController);
teachingAssignmentRoutes.patch(
  '/:id/status',
  ...canManage,
  setTeachingAssignmentStatusController,
);
teachingAssignmentRoutes.delete(
  '/:id',
  ...canManage,
  deleteTeachingAssignmentController,
);
teachingAssignmentRoutes.get('/:id', requireAuth, getTeachingAssignmentController);
