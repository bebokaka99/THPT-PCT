import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { requirePermission } from '../../middlewares/require-permission.js';
import { optionalAuth } from '../../middlewares/optional-auth.js';
import {
  archiveDocumentController,
  createDocumentController,
  deleteDocumentController,
  getAdminDocumentController,
  getDocumentController,
  listDocumentsController,
  publishDocumentController,
  restoreDocumentController,
  updateDocumentController,
} from './document.controller.js';

export const documentRoutes = Router();

const canManageDocuments = [requireAuth, requirePermission('documents.manage')];

documentRoutes.get('/', optionalAuth, listDocumentsController);
documentRoutes.get('/admin/:id', ...canManageDocuments, getAdminDocumentController);
documentRoutes.get('/:slug', getDocumentController);
documentRoutes.post('/', ...canManageDocuments, createDocumentController);
documentRoutes.patch('/:id/publish', ...canManageDocuments, publishDocumentController);
documentRoutes.patch('/:id/archive', ...canManageDocuments, archiveDocumentController);
documentRoutes.patch('/:id/restore', ...canManageDocuments, restoreDocumentController);
documentRoutes.patch('/:id', ...canManageDocuments, updateDocumentController);
documentRoutes.delete('/:id', ...canManageDocuments, deleteDocumentController);
