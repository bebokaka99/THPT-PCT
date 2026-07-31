import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { requirePermission } from '../../middlewares/require-permission.js';
import {
  activateAcademicYearController,
  activateSemesterController,
  closeAcademicYearController,
  closeSemesterController,
  createAcademicYearController,
  createSemesterController,
  deleteAcademicYearController,
  deleteSemesterController,
  getAcademicYearController,
  getActiveAcademicPeriodsController,
  listAcademicPeriodsController,
  lockAcademicYearController,
  lockSemesterController,
  updateAcademicYearController,
  updateSemesterController,
} from './academic-period.controller.js';

export const academicPeriodRoutes = Router();
const canManage = [requireAuth, requirePermission('academic_periods.manage')];

academicPeriodRoutes.get('/', requireAuth, listAcademicPeriodsController);
academicPeriodRoutes.get('/active', requireAuth, getActiveAcademicPeriodsController);
academicPeriodRoutes.get('/years/:yearId', requireAuth, getAcademicYearController);

academicPeriodRoutes.post('/years', ...canManage, createAcademicYearController);
academicPeriodRoutes.patch('/years/:yearId', ...canManage, updateAcademicYearController);
academicPeriodRoutes.patch('/years/:yearId/activate', ...canManage, activateAcademicYearController);
academicPeriodRoutes.patch('/years/:yearId/close', ...canManage, closeAcademicYearController);
academicPeriodRoutes.patch('/years/:yearId/lock', ...canManage, lockAcademicYearController);
academicPeriodRoutes.delete('/years/:yearId', ...canManage, deleteAcademicYearController);

academicPeriodRoutes.post(
  '/years/:yearId/semesters',
  ...canManage,
  createSemesterController,
);
academicPeriodRoutes.patch(
  '/semesters/:semesterId',
  ...canManage,
  updateSemesterController,
);
academicPeriodRoutes.patch(
  '/semesters/:semesterId/activate',
  ...canManage,
  activateSemesterController,
);
academicPeriodRoutes.patch(
  '/semesters/:semesterId/close',
  ...canManage,
  closeSemesterController,
);
academicPeriodRoutes.patch(
  '/semesters/:semesterId/lock',
  ...canManage,
  lockSemesterController,
);
academicPeriodRoutes.delete(
  '/semesters/:semesterId',
  ...canManage,
  deleteSemesterController,
);
