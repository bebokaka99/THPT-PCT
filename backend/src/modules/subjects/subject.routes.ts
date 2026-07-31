import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { requirePermission } from '../../middlewares/require-permission.js';
import {
  createCurriculumController,
  createSubjectController,
  deleteCurriculumController,
  deleteSubjectController,
  getSubjectController,
  importSubjectsController,
  listCurriculumController,
  listSubjectsController,
  updateCurriculumController,
  updateSubjectController,
} from './subject.controller.js';

export const subjectRoutes = Router();
const canManage = [requireAuth, requirePermission('subjects.manage')];

subjectRoutes.get('/', requireAuth, listSubjectsController);
subjectRoutes.get('/curriculum', requireAuth, listCurriculumController);
subjectRoutes.post('/curriculum', ...canManage, createCurriculumController);
subjectRoutes.patch('/curriculum/:id', ...canManage, updateCurriculumController);
subjectRoutes.delete('/curriculum/:id', ...canManage, deleteCurriculumController);
subjectRoutes.post('/import', ...canManage, importSubjectsController);
subjectRoutes.post('/', ...canManage, createSubjectController);
subjectRoutes.get('/:id', requireAuth, getSubjectController);
subjectRoutes.patch('/:id', ...canManage, updateSubjectController);
subjectRoutes.delete('/:id', ...canManage, deleteSubjectController);
