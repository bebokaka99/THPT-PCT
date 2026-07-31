import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { requirePermission } from '../../middlewares/require-permission.js';
import { getDashboardOverviewController } from './dashboard.controller.js';

export const dashboardRoutes = Router();

dashboardRoutes.use(requireAuth, requirePermission('dashboard.read'));
dashboardRoutes.get('/overview', getDashboardOverviewController);
