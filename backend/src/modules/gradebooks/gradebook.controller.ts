import type { Request, RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  approveGradebook,
  createGradebookChangeRequest,
  createGradebook,
  getGradebook,
  listGradebookAudits,
  listGradebookChangeRequests,
  listGradebooks,
  listGradebookWorkflowAudits,
  listMyPublishedGrades,
  lockGradebook,
  rejectGradebook,
  reviewGradebookChangeRequest,
  submitGradebook,
  updateGradebookScores,
} from './gradebook.service.js';
import {
  validateGradebookCreate,
  validateGradebookId,
  validateGradebookListQuery,
  validateGradebookScoreBatch,
  validateOptionalWorkflowReason,
  validateRequiredWorkflowReason,
} from './gradebook.validation.js';

function user(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return req.user;
}

export const listGradebooksController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json(
      await listGradebooks(user(req), validateGradebookListQuery(req.query)),
    );
  } catch (error) {
    next(error);
  }
};

export const submitGradebookController: RequestHandler = async (req, res, next) => {
  try {
    res.json({
      data: await submitGradebook(
        user(req),
        validateGradebookId(req.params.id),
        validateOptionalWorkflowReason(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const approveGradebookController: RequestHandler = async (req, res, next) => {
  try {
    res.json({
      data: await approveGradebook(
        user(req),
        validateGradebookId(req.params.id),
        validateOptionalWorkflowReason(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const rejectGradebookController: RequestHandler = async (req, res, next) => {
  try {
    res.json({
      data: await rejectGradebook(
        user(req),
        validateGradebookId(req.params.id),
        validateRequiredWorkflowReason(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const lockGradebookController: RequestHandler = async (req, res, next) => {
  try {
    res.json({
      data: await lockGradebook(
        user(req),
        validateGradebookId(req.params.id),
        validateOptionalWorkflowReason(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const createChangeRequestController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.status(201).json({
      data: await createGradebookChangeRequest(
        user(req),
        validateGradebookId(req.params.id),
        validateRequiredWorkflowReason(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const listChangeRequestsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json(await listGradebookChangeRequests(user(req)));
  } catch (error) {
    next(error);
  }
};

function decisionController(decision: 'approved' | 'rejected'): RequestHandler {
  return async (req, res, next) => {
    try {
      res.json({
        data: await reviewGradebookChangeRequest(
          user(req),
          validateGradebookId(req.params.requestId),
          decision,
          validateRequiredWorkflowReason(req.body),
        ),
      });
    } catch (error) {
      next(error);
    }
  };
}

export const approveChangeRequestController = decisionController('approved');
export const rejectChangeRequestController = decisionController('rejected');

export const listWorkflowAuditsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json(
      await listGradebookWorkflowAudits(
        user(req),
        validateGradebookId(req.params.id),
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const listMyGradesController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json(await listMyPublishedGrades(user(req)));
  } catch (error) {
    next(error);
  }
};

export const getGradebookController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await getGradebook(user(req), validateGradebookId(req.params.id)),
    });
  } catch (error) {
    next(error);
  }
};

export const createGradebookController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.status(201).json({
      data: await createGradebook(user(req), validateGradebookCreate(req.body)),
    });
  } catch (error) {
    next(error);
  }
};

export const saveGradebookScoresController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await updateGradebookScores(
        user(req),
        validateGradebookId(req.params.id),
        validateGradebookScoreBatch(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const listGradebookAuditsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json(
      await listGradebookAudits(
        user(req),
        validateGradebookId(req.params.id),
      ),
    );
  } catch (error) {
    next(error);
  }
};
