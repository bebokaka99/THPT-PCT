import type { RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  archiveDocument,
  createDocument,
  deleteDocument,
  getAdminDocumentById,
  getDocumentBySlug,
  listDocuments,
  publishDocument,
  restoreDocument,
  updateDocument,
} from './document.service.js';
import {
  validateCreateDocument,
  validateDocumentId,
  validateListDocumentsQuery,
  validateUpdateDocument,
} from './document.validation.js';

export const listDocumentsController: RequestHandler = async (req, res, next) => {
  try {
    const query = validateListDocumentsQuery(req.query);

    if (query.status !== 'published') {
      if (!req.user) {
        throw new HttpError(401, 'Authentication required');
      }

      if (!req.user.roles.includes('admin') && !req.user.permissions.includes('documents.manage')) {
        throw new HttpError(403, 'Permission denied');
      }
    }

    res.json(await listDocuments(query));
  } catch (error) {
    next(error);
  }
};

export const getDocumentController: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await getDocumentBySlug(req.params.slug) });
  } catch (error) {
    next(error);
  }
};

export const getAdminDocumentController: RequestHandler = async (req, res, next) => {
  try {
    const id = validateDocumentId(req.params.id);
    res.json({ data: await getAdminDocumentById(id) });
  } catch (error) {
    next(error);
  }
};

export const createDocumentController: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new HttpError(401, 'Authentication required');
    }

    const input = validateCreateDocument(req.body);
    const document = await createDocument(input, req.user.id);
    res.status(201).json({ data: document });
  } catch (error) {
    next(error);
  }
};

export const updateDocumentController: RequestHandler = async (req, res, next) => {
  try {
    const id = validateDocumentId(req.params.id);
    const input = validateUpdateDocument(req.body);
    res.json({ data: await updateDocument(id, input) });
  } catch (error) {
    next(error);
  }
};

export const deleteDocumentController: RequestHandler = async (req, res, next) => {
  try {
    const id = validateDocumentId(req.params.id);
    await deleteDocument(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const publishDocumentController: RequestHandler = async (req, res, next) => {
  try {
    const id = validateDocumentId(req.params.id);
    res.json({ data: await publishDocument(id) });
  } catch (error) {
    next(error);
  }
};

export const archiveDocumentController: RequestHandler = async (req, res, next) => {
  try {
    const id = validateDocumentId(req.params.id);
    res.json({ data: await archiveDocument(id) });
  } catch (error) {
    next(error);
  }
};

export const restoreDocumentController: RequestHandler = async (req, res, next) => {
  try {
    const id = validateDocumentId(req.params.id);
    res.json({ data: await restoreDocument(id) });
  } catch (error) {
    next(error);
  }
};
