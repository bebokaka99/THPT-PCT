import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { requirePermission } from '../../middlewares/require-permission.js';
import {
  createCategoryController,
  deleteCategoryController,
  getCategoryController,
  listAdminCategoriesController,
  listCategoriesController,
  updateCategoryController,
} from './category.controller.js';

export const categoryRoutes = Router();

categoryRoutes.get('/', listCategoriesController);
categoryRoutes.get('/admin/all', requireAuth, requirePermission('posts.manage'), listAdminCategoriesController);
categoryRoutes.get('/:slug', getCategoryController);
categoryRoutes.post('/', requireAuth, requirePermission('posts.manage'), createCategoryController);
categoryRoutes.patch('/:id', requireAuth, requirePermission('posts.manage'), updateCategoryController);
categoryRoutes.delete('/:id', requireAuth, requirePermission('posts.manage'), deleteCategoryController);
