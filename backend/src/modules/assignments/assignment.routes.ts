import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { requirePermission } from '../../middlewares/require-permission.js';
import {
  closeAssignmentController,
  createAssignmentController,
  deleteAssignmentController,
  getAssignmentController,
  listAssignmentsController,
  listSubmissionsController,
  publishAssignmentController,
  submitAssignmentController,
  updateAssignmentController,
} from './assignment.controller.js';
import { assignmentSubmissionUpload } from './assignment-upload.js';

export const assignmentRoutes = Router();

assignmentRoutes.use(requireAuth);
assignmentRoutes.get(
  '/',
  requirePermission('assignments.read'),
  listAssignmentsController,
);
assignmentRoutes.post(
  '/',
  requirePermission('assignments.manage'),
  createAssignmentController,
);
assignmentRoutes.get(
  '/:id/submissions',
  requirePermission('assignments.manage'),
  listSubmissionsController,
);
assignmentRoutes.post(
  '/:id/submissions',
  requirePermission('assignments.read'),
  assignmentSubmissionUpload.single('file'),
  submitAssignmentController,
);
assignmentRoutes.post(
  '/:id/publish',
  requirePermission('assignments.manage'),
  publishAssignmentController,
);
assignmentRoutes.post(
  '/:id/close',
  requirePermission('assignments.manage'),
  closeAssignmentController,
);
assignmentRoutes.patch(
  '/:id',
  requirePermission('assignments.manage'),
  updateAssignmentController,
);
assignmentRoutes.delete(
  '/:id',
  requirePermission('assignments.manage'),
  deleteAssignmentController,
);
assignmentRoutes.get(
  '/:id',
  requirePermission('assignments.read'),
  getAssignmentController,
);
