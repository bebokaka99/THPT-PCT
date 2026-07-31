import type { RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  archivePost,
  createPost,
  deletePost,
  getAdminPostById,
  getPostBySlug,
  listPosts,
  publishPost,
  restorePost,
  updatePost,
} from './post.service.js';
import {
  validateCreatePost,
  validateListPostsQuery,
  validatePostId,
  validateUpdatePost,
} from './post.validation.js';

export const listPostsController: RequestHandler = async (req, res, next) => {
  try {
    const query = validateListPostsQuery(req.query);

    if (query.status !== 'published') {
      if (!req.user) {
        throw new HttpError(401, 'Authentication required');
      }

      if (!req.user.roles.includes('admin') && !req.user.permissions.includes('posts.manage')) {
        throw new HttpError(403, 'Permission denied');
      }
    }

    res.json(await listPosts(query));
  } catch (error) {
    next(error);
  }
};

export const getPostController: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await getPostBySlug(req.params.slug) });
  } catch (error) {
    next(error);
  }
};

export const getAdminPostController: RequestHandler = async (req, res, next) => {
  try {
    const id = validatePostId(req.params.id);
    res.json({ data: await getAdminPostById(id) });
  } catch (error) {
    next(error);
  }
};

export const createPostController: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new HttpError(401, 'Authentication required');
    }

    const input = validateCreatePost(req.body);
    const post = await createPost(input, req.user.id);
    res.status(201).json({ data: post });
  } catch (error) {
    next(error);
  }
};

export const updatePostController: RequestHandler = async (req, res, next) => {
  try {
    const id = validatePostId(req.params.id);
    const input = validateUpdatePost(req.body);
    res.json({ data: await updatePost(id, input) });
  } catch (error) {
    next(error);
  }
};

export const deletePostController: RequestHandler = async (req, res, next) => {
  try {
    const id = validatePostId(req.params.id);
    await deletePost(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const publishPostController: RequestHandler = async (req, res, next) => {
  try {
    const id = validatePostId(req.params.id);
    res.json({ data: await publishPost(id) });
  } catch (error) {
    next(error);
  }
};

export const archivePostController: RequestHandler = async (req, res, next) => {
  try {
    const id = validatePostId(req.params.id);
    res.json({ data: await archivePost(id) });
  } catch (error) {
    next(error);
  }
};

export const restorePostController: RequestHandler = async (req, res, next) => {
  try {
    const id = validatePostId(req.params.id);
    res.json({ data: await restorePost(id) });
  } catch (error) {
    next(error);
  }
};
