import type { Request, RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  addRequestAttachment,
  approveRequest,
  cancelRequest,
  createRequest,
  createRequestType,
  getRequest,
  getRequestAttachmentDownload,
  getRequestHistory,
  listRequests,
  listRequestTypes,
  rejectRequest,
  startRequestReview,
  submitRequest,
  updateRequestType,
} from './student-request.service.js';
import {
  validateDecisionReason,
  validateStudentRequestCreate,
  validateStudentRequestId,
  validateStudentRequestListQuery,
  validateStudentRequestType,
} from './student-request.validation.js';

function user(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return req.user;
}

export const listRequestTypesController: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await listRequestTypes(user(req)) });
  } catch (error) {
    next(error);
  }
};

export const createRequestTypeController: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json({
      data: await createRequestType(user(req), validateStudentRequestType(req.body)),
    });
  } catch (error) {
    next(error);
  }
};

export const updateRequestTypeController: RequestHandler = async (req, res, next) => {
  try {
    res.json({
      data: await updateRequestType(
        user(req),
        validateStudentRequestId(req.params.id),
        validateStudentRequestType(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const listRequestsController: RequestHandler = async (req, res, next) => {
  try {
    res.json(await listRequests(user(req), validateStudentRequestListQuery(req.query)));
  } catch (error) {
    next(error);
  }
};

export const getRequestController: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await getRequest(user(req), validateStudentRequestId(req.params.id)) });
  } catch (error) {
    next(error);
  }
};

export const createRequestController: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json({
      data: await createRequest(user(req), validateStudentRequestCreate(req.body)),
    });
  } catch (error) {
    next(error);
  }
};

export const uploadRequestAttachmentController: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json({
      data: await addRequestAttachment(
        user(req),
        validateStudentRequestId(req.params.id),
        req.file,
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const downloadRequestAttachmentController: RequestHandler = async (req, res, next) => {
  try {
    const file = await getRequestAttachmentDownload(
      user(req),
      validateStudentRequestId(req.params.id),
      validateStudentRequestId(req.params.attachmentId),
    );
    res.type(file.mimeType);
    res.download(file.path, file.name, (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
};

function transitionController(
  action: 'submit' | 'cancel' | 'start_review',
): RequestHandler {
  return async (req, res, next) => {
    try {
      const id = validateStudentRequestId(req.params.id);
      const data =
        action === 'submit'
          ? await submitRequest(user(req), id)
          : action === 'cancel'
            ? await cancelRequest(user(req), id)
            : await startRequestReview(user(req), id);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  };
}

export const submitRequestController = transitionController('submit');
export const cancelRequestController = transitionController('cancel');
export const startRequestReviewController = transitionController('start_review');

export const approveRequestController: RequestHandler = async (req, res, next) => {
  try {
    res.json({
      data: await approveRequest(
        user(req),
        validateStudentRequestId(req.params.id),
        validateDecisionReason(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const rejectRequestController: RequestHandler = async (req, res, next) => {
  try {
    res.json({
      data: await rejectRequest(
        user(req),
        validateStudentRequestId(req.params.id),
        validateDecisionReason(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const getRequestHistoryController: RequestHandler = async (req, res, next) => {
  try {
    res.json({
      data: await getRequestHistory(
        user(req),
        validateStudentRequestId(req.params.id),
      ),
    });
  } catch (error) {
    next(error);
  }
};
