import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { requirePermission } from '../../middlewares/require-permission.js';
import {
  getGuardianPreferencesController,
  getGuardianStudentSummaryController,
  inviteGuardianController,
  listGuardianAuditsController,
  listGuardianLinksController,
  listMyGuardianChildrenController,
  revokeGuardianController,
  updateGuardianPreferencesController,
  verifyGuardianController,
} from './guardian.controller.js';

export const guardianRoutes = Router();

guardianRoutes.use(requireAuth);
guardianRoutes.get(
  '/me/students',
  requirePermission('guardian.children.read'),
  listMyGuardianChildrenController,
);
guardianRoutes.get(
  '/me/students/:studentId/summary',
  requirePermission('guardian.children.read'),
  getGuardianStudentSummaryController,
);
guardianRoutes.get(
  '/me/preferences',
  requirePermission('guardian.preferences.manage'),
  getGuardianPreferencesController,
);
guardianRoutes.patch(
  '/me/preferences',
  requirePermission('guardian.preferences.manage'),
  updateGuardianPreferencesController,
);
guardianRoutes.get(
  '/links',
  requirePermission('guardians.manage'),
  listGuardianLinksController,
);
guardianRoutes.post(
  '/links',
  requirePermission('guardians.manage'),
  inviteGuardianController,
);
guardianRoutes.get(
  '/links/:id/audit',
  requirePermission('guardians.manage'),
  listGuardianAuditsController,
);
guardianRoutes.post(
  '/links/:id/verify',
  requirePermission('guardians.manage'),
  verifyGuardianController,
);
guardianRoutes.post(
  '/links/:id/revoke',
  requirePermission('guardians.manage'),
  revokeGuardianController,
);
