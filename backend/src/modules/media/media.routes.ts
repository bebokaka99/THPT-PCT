import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { requireAnyPermission } from '../../middlewares/require-permission.js';
import { uploadRateLimiter } from '../../config/security.js';
import {
  deleteMediaController,
  listMediaController,
  uploadMediaController,
} from './media.controller.js';
import { mediaUpload } from './media-upload.js';

const canManageMedia = [requireAuth, requireAnyPermission(['posts.manage', 'documents.manage', 'classroom_documents.manage'])];

export const mediaRoutes = Router();

mediaRoutes.get('/', ...canManageMedia, listMediaController);
mediaRoutes.post(
  '/upload',
  uploadRateLimiter,
  ...canManageMedia,
  mediaUpload.single('file'),
  uploadMediaController,
);
mediaRoutes.delete('/:id', ...canManageMedia, deleteMediaController);
