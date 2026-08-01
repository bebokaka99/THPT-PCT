import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { requireRole } from '../../middlewares/require-role.js';
import {
  getOperationalHealthController,
  syntheticFailureController,
} from './operation.controller.js';

export const operationRoutes = Router();

operationRoutes.use(requireAuth, requireRole('admin'));
operationRoutes.get('/health', getOperationalHealthController);
operationRoutes.post('/synthetic-failure', syntheticFailureController);
