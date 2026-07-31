import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { requirePermission } from '../../middlewares/require-permission.js';
import {
  convertImportedContentController,
  getImportedContentController,
  listImportedContentsController,
  updateImportedContentStatusController,
} from './importer.controller.js';

export const importerRoutes = Router();

const canManageImports = [requireAuth, requirePermission('posts.manage')];

importerRoutes.get('/imported-contents', ...canManageImports, listImportedContentsController);
importerRoutes.get('/imported-contents/:id', ...canManageImports, getImportedContentController);
importerRoutes.patch('/imported-contents/:id/status', ...canManageImports, updateImportedContentStatusController);
importerRoutes.post('/imported-contents/:id/convert-to-post', ...canManageImports, convertImportedContentController);
