import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { requirePermission } from '../../middlewares/require-permission.js';
import {
  approveConductController,
  getMyConductController,
  listConductAuditsController,
  listConductController,
  lockConductController,
  rejectConductController,
  saveConductController,
  submitConductController,
} from './conduct.controller.js';

export const conductRoutes = Router();

conductRoutes.use(requireAuth);
conductRoutes.get('/me', requirePermission('conduct.read'), getMyConductController);
conductRoutes.get('/', requirePermission('conduct.manage'), listConductController);
conductRoutes.put(
  '/students/:studentId',
  requirePermission('conduct.manage'),
  saveConductController,
);
conductRoutes.get(
  '/:id/audit',
  requirePermission('conduct.manage'),
  listConductAuditsController,
);
conductRoutes.post(
  '/:id/submit',
  requirePermission('conduct.manage'),
  submitConductController,
);
conductRoutes.post(
  '/:id/approve',
  requirePermission('conduct.review'),
  approveConductController,
);
conductRoutes.post(
  '/:id/reject',
  requirePermission('conduct.review'),
  rejectConductController,
);
conductRoutes.post(
  '/:id/lock',
  requirePermission('conduct.review'),
  lockConductController,
);
