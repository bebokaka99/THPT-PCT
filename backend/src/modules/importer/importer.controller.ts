import type { RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  convertImportedContentToPost,
  getImportedContent,
  listImportedContents,
  updateImportedContentStatus,
} from './importer.service.js';
import {
  validateConvertImportedContent,
  validateImportedContentId,
  validateListImportedContentsQuery,
  validateUpdateImportedContentStatus,
} from './importer.validation.js';

export const listImportedContentsController: RequestHandler = async (req, res, next) => {
  try {
    const query = validateListImportedContentsQuery(req.query);
    res.json(await listImportedContents(query));
  } catch (error) {
    next(error);
  }
};

export const getImportedContentController: RequestHandler = async (req, res, next) => {
  try {
    const id = validateImportedContentId(req.params.id);
    res.json({ data: await getImportedContent(id) });
  } catch (error) {
    next(error);
  }
};

export const updateImportedContentStatusController: RequestHandler = async (req, res, next) => {
  try {
    const id = validateImportedContentId(req.params.id);
    const input = validateUpdateImportedContentStatus(req.body);
    res.json({ data: await updateImportedContentStatus(id, input) });
  } catch (error) {
    next(error);
  }
};

export const convertImportedContentController: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new HttpError(401, 'Authentication required');
    }

    const id = validateImportedContentId(req.params.id);
    const input = validateConvertImportedContent(req.body);
    res.status(201).json({ data: await convertImportedContentToPost(id, input, req.user.id) });
  } catch (error) {
    next(error);
  }
};
