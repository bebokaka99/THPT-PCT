import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { requirePermission } from '../../middlewares/require-permission.js';
import { optionalAuth } from '../../middlewares/optional-auth.js';
import {
  archivePostController,
  createPostController,
  deletePostController,
  getAdminPostController,
  getPostController,
  listPostsController,
  publishPostController,
  restorePostController,
  updatePostController,
} from './post.controller.js';

export const postRoutes = Router();

const canManagePosts = [requireAuth, requirePermission('posts.manage')];

postRoutes.get('/', optionalAuth, listPostsController);
postRoutes.get('/admin/:id', ...canManagePosts, getAdminPostController);
postRoutes.get('/:slug', getPostController);
postRoutes.post('/', ...canManagePosts, createPostController);
postRoutes.patch('/:id/publish', ...canManagePosts, publishPostController);
postRoutes.patch('/:id/archive', ...canManagePosts, archivePostController);
postRoutes.patch('/:id/restore', ...canManagePosts, restorePostController);
postRoutes.patch('/:id', ...canManagePosts, updatePostController);
postRoutes.delete('/:id', ...canManagePosts, deletePostController);
