import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { requirePermission } from '../../middlewares/require-permission.js';
import {
  approveChangeRequestController,
  approveGradebookController,
  createChangeRequestController,
  createGradebookController,
  getGradebookController,
  listGradebookAuditsController,
  listGuardianStudentGradesController,
  listChangeRequestsController,
  listGradebooksController,
  listMyGradesController,
  listWorkflowAuditsController,
  lockGradebookController,
  rejectChangeRequestController,
  rejectGradebookController,
  saveGradebookScoresController,
  submitGradebookController,
} from './gradebook.controller.js';

export const gradebookRoutes = Router();

gradebookRoutes.use(requireAuth);
gradebookRoutes.get('/me', requirePermission('gradebooks.read'), listMyGradesController);
gradebookRoutes.get(
  '/students/:studentId',
  requirePermission('guardian.children.read'),
  listGuardianStudentGradesController,
);
gradebookRoutes.get(
  '/change-requests',
  requirePermission('gradebooks.review'),
  listChangeRequestsController,
);
gradebookRoutes.post(
  '/change-requests/:requestId/approve',
  requirePermission('gradebooks.review'),
  approveChangeRequestController,
);
gradebookRoutes.post(
  '/change-requests/:requestId/reject',
  requirePermission('gradebooks.review'),
  rejectChangeRequestController,
);
gradebookRoutes.get('/', requirePermission('gradebooks.manage'), listGradebooksController);
gradebookRoutes.post('/', requirePermission('gradebooks.manage'), createGradebookController);
gradebookRoutes.get(
  '/:id/audit',
  requirePermission('gradebooks.manage'),
  listGradebookAuditsController,
);
gradebookRoutes.get(
  '/:id/workflow-audit',
  requirePermission('gradebooks.manage'),
  listWorkflowAuditsController,
);
gradebookRoutes.post(
  '/:id/submit',
  requirePermission('gradebooks.manage'),
  submitGradebookController,
);
gradebookRoutes.post(
  '/:id/approve',
  requirePermission('gradebooks.review'),
  approveGradebookController,
);
gradebookRoutes.post(
  '/:id/reject',
  requirePermission('gradebooks.review'),
  rejectGradebookController,
);
gradebookRoutes.post(
  '/:id/lock',
  requirePermission('gradebooks.review'),
  lockGradebookController,
);
gradebookRoutes.post(
  '/:id/change-requests',
  requirePermission('gradebooks.manage'),
  createChangeRequestController,
);
gradebookRoutes.put(
  '/:id/scores',
  requirePermission('gradebooks.manage'),
  saveGradebookScoresController,
);
gradebookRoutes.get(
  '/:id',
  requirePermission('gradebooks.manage'),
  getGradebookController,
);
