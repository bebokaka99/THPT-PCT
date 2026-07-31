import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { requirePermission } from '../../middlewares/require-permission.js';
import {
  activateAssessmentConfigurationController,
  calculateAssessmentPreviewController,
  createAssessmentConfigurationController,
  createAssessmentConfigurationVersionController,
  deleteAssessmentConfigurationController,
  getAssessmentConfigurationController,
  listAssessmentConfigurationsController,
  listMyAssessmentConfigurationsController,
  updateAssessmentConfigurationController,
} from './assessment-configuration.controller.js';

export const assessmentConfigurationRoutes = Router();
const canManage = [
  requireAuth,
  requirePermission('assessment_configurations.manage'),
];

assessmentConfigurationRoutes.get(
  '/me',
  requireAuth,
  listMyAssessmentConfigurationsController,
);
assessmentConfigurationRoutes.get(
  '/',
  ...canManage,
  listAssessmentConfigurationsController,
);
assessmentConfigurationRoutes.post(
  '/',
  ...canManage,
  createAssessmentConfigurationController,
);
assessmentConfigurationRoutes.patch(
  '/:id',
  ...canManage,
  updateAssessmentConfigurationController,
);
assessmentConfigurationRoutes.post(
  '/:id/versions',
  ...canManage,
  createAssessmentConfigurationVersionController,
);
assessmentConfigurationRoutes.post(
  '/:id/activate',
  ...canManage,
  activateAssessmentConfigurationController,
);
assessmentConfigurationRoutes.delete(
  '/:id',
  ...canManage,
  deleteAssessmentConfigurationController,
);
assessmentConfigurationRoutes.post(
  '/:id/calculate',
  requireAuth,
  calculateAssessmentPreviewController,
);
assessmentConfigurationRoutes.get(
  '/:id',
  requireAuth,
  getAssessmentConfigurationController,
);
