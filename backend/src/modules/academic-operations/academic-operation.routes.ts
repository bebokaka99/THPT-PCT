import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { requirePermission } from '../../middlewares/require-permission.js';
import {
  commitImportController,
  downloadTemplateController,
  exportAttendanceController,
  exportGradebookController,
  exportImportErrorsController,
  exportRosterController,
  exportTranscriptController,
  getImportJobController,
  listImportJobsController,
  previewImportController,
  reportSummaryController,
} from './academic-operation.controller.js';
import { academicCsvUpload } from './academic-operation.upload.js';

export const academicOperationRoutes = Router();

academicOperationRoutes.use(requireAuth);
academicOperationRoutes.get(
  '/templates/:type',
  requirePermission('academic_imports.manage'),
  downloadTemplateController,
);
academicOperationRoutes.post(
  '/imports/preview',
  requirePermission('academic_imports.manage'),
  academicCsvUpload.single('file'),
  previewImportController,
);
academicOperationRoutes.get(
  '/imports',
  requirePermission('academic_imports.manage'),
  listImportJobsController,
);
academicOperationRoutes.get(
  '/imports/:id/errors',
  requirePermission('academic_imports.manage'),
  exportImportErrorsController,
);
academicOperationRoutes.post(
  '/imports/:id/commit',
  requirePermission('academic_imports.manage'),
  commitImportController,
);
academicOperationRoutes.get(
  '/imports/:id',
  requirePermission('academic_imports.manage'),
  getImportJobController,
);
academicOperationRoutes.get(
  '/exports/roster',
  requirePermission('academic_reports.export'),
  exportRosterController,
);
academicOperationRoutes.get(
  '/exports/attendance',
  requirePermission('academic_reports.export'),
  exportAttendanceController,
);
academicOperationRoutes.get(
  '/exports/gradebook/:id',
  requirePermission('academic_reports.export'),
  exportGradebookController,
);
academicOperationRoutes.get(
  '/exports/transcript-summary',
  requirePermission('academic_reports.export'),
  exportTranscriptController,
);
academicOperationRoutes.get(
  '/reports/summary',
  requirePermission('academic_reports.export'),
  reportSummaryController,
);

