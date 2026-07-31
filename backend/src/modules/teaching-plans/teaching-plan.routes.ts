import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import {
  approveController,
  archiveController,
  createController,
  deleteController,
  detailController,
  listController,
  optionsController,
  summaryController,
  rejectController,
  submitController,
  updateController,
} from './teaching-plan.controller.js';

export const teachingPlanRoutes = Router();
teachingPlanRoutes.use(requireAuth);
teachingPlanRoutes.get('/options', optionsController);
teachingPlanRoutes.get('/summary', summaryController);
teachingPlanRoutes.get('/', listController);
teachingPlanRoutes.get('/:id', detailController);
teachingPlanRoutes.post('/', createController);
teachingPlanRoutes.patch('/:id', updateController);
teachingPlanRoutes.post('/:id/submit', submitController);
teachingPlanRoutes.post('/:id/approve', approveController);
teachingPlanRoutes.post('/:id/reject', rejectController);
teachingPlanRoutes.post('/:id/archive', archiveController);
teachingPlanRoutes.delete('/:id', deleteController);
