import { Router } from 'express';
import {
  legacyDatabaseHealthController,
  legacyHealthController,
  livenessController,
  readinessController,
} from './health.controller.js';

export const healthRoutes = Router();

healthRoutes.get('/', legacyHealthController);
healthRoutes.get('/live', livenessController);
healthRoutes.get('/ready', readinessController);
healthRoutes.get('/db', legacyDatabaseHealthController);
