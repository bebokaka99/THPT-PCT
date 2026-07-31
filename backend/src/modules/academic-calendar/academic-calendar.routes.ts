import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import {
  archiveAcademicCalendarController,
  createAcademicCalendarController,
  deleteAcademicCalendarController,
  getAcademicCalendarController,
  listAcademicCalendarAuditsController,
  listAcademicCalendarController,
  previewAcademicCalendarConflictsController,
  publishAcademicCalendarController,
  updateAcademicCalendarController,
} from './academic-calendar.controller.js';

export const academicCalendarRoutes = Router();
academicCalendarRoutes.use(requireAuth);
academicCalendarRoutes.get('/', listAcademicCalendarController);
academicCalendarRoutes.post('/conflicts', previewAcademicCalendarConflictsController);
academicCalendarRoutes.post('/', createAcademicCalendarController);
academicCalendarRoutes.get('/:id/audit', listAcademicCalendarAuditsController);
academicCalendarRoutes.post('/:id/publish', publishAcademicCalendarController);
academicCalendarRoutes.post('/:id/archive', archiveAcademicCalendarController);
academicCalendarRoutes.patch('/:id', updateAcademicCalendarController);
academicCalendarRoutes.delete('/:id', deleteAcademicCalendarController);
academicCalendarRoutes.get('/:id', getAcademicCalendarController);
