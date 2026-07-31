import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { requirePermission } from '../../middlewares/require-permission.js';
import { listRolesController } from './role.controller.js';

export const roleRoutes = Router();

roleRoutes.get('/', requireAuth, requirePermission('users.manage'), listRolesController);
