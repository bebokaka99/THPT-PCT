import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { requirePermission } from '../../middlewares/require-permission.js';
import {
  createUserController,
  bulkCreateStudentAccountsController,
  getUserController,
  listUsersController,
  updateUserController,
  updateUserRolesController,
  updateUserStatusController,
} from './user.controller.js';

export const userRoutes = Router();

const canManageUsers = [requireAuth, requirePermission('users.manage')];

userRoutes.get('/', ...canManageUsers, listUsersController);
userRoutes.post('/students/bulk', ...canManageUsers, bulkCreateStudentAccountsController);
userRoutes.get('/:id', ...canManageUsers, getUserController);
userRoutes.post('/', ...canManageUsers, createUserController);
userRoutes.patch('/:id/status', ...canManageUsers, updateUserStatusController);
userRoutes.patch('/:id/roles', ...canManageUsers, updateUserRolesController);
userRoutes.patch('/:id', ...canManageUsers, updateUserController);
