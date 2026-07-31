import type { Request, RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  approveConduct,
  getMyConduct,
  listConductAudits,
  listConductRoster,
  lockConduct,
  rejectConduct,
  saveStudentConduct,
  submitConduct,
} from './conduct.service.js';
import {
  validateConductId,
  validateConductListQuery,
  validateConductUpsert,
  validateOptionalReason,
  validateOptionalSemesterId,
  validateRequiredReason,
  validateStudentId,
} from './conduct.validation.js';

function user(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return req.user;
}

export const getMyConductController: RequestHandler = async (req, res, next) => {
  try {
    res.json({
      data: await getMyConduct(
        user(req),
        validateOptionalSemesterId(req.query.semester_id),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const listConductController: RequestHandler = async (req, res, next) => {
  try {
    res.json(
      await listConductRoster(
        user(req),
        validateConductListQuery(req.query as Record<string, unknown>),
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const saveConductController: RequestHandler = async (req, res, next) => {
  try {
    res.json({
      data: await saveStudentConduct(
        user(req),
        validateStudentId(req.params.studentId),
        validateConductUpsert(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

function workflowController(
  action: 'submit' | 'approve' | 'reject' | 'lock',
): RequestHandler {
  return async (req, res, next) => {
    try {
      const currentUser = user(req);
      const id = validateConductId(req.params.id);
      const reason =
        action === 'reject'
          ? validateRequiredReason(req.body)
          : validateOptionalReason(req.body);
      const data =
        action === 'submit'
          ? await submitConduct(currentUser, id, reason)
          : action === 'approve'
            ? await approveConduct(currentUser, id, reason)
            : action === 'reject'
              ? await rejectConduct(currentUser, id, reason!)
              : await lockConduct(currentUser, id, reason);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  };
}

export const submitConductController = workflowController('submit');
export const approveConductController = workflowController('approve');
export const rejectConductController = workflowController('reject');
export const lockConductController = workflowController('lock');

export const listConductAuditsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json(
      await listConductAudits(user(req), validateConductId(req.params.id)),
    );
  } catch (error) {
    next(error);
  }
};
