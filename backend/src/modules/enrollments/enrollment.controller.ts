import type { Request, RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  createStudentEnrollment,
  endStudentEnrollment,
  getEnrollmentForUser,
  getMyEnrollmentHistory,
  getStudentHistory,
  listEnrollmentsForAdmin,
  transferStudentEnrollment,
} from './enrollment.service.js';
import {
  validateCreateEnrollment,
  validateEndEnrollment,
  validateEnrollmentId,
  validateListEnrollmentsQuery,
  validateTransferEnrollment,
} from './enrollment.validation.js';

function user(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return req.user;
}

export const listEnrollmentsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json(
      await listEnrollmentsForAdmin(
        user(req),
        validateListEnrollmentsQuery(req.query),
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getEnrollmentController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await getEnrollmentForUser(
        user(req),
        validateEnrollmentId(req.params.id),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const getMyEnrollmentsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({ data: await getMyEnrollmentHistory(user(req)) });
  } catch (error) {
    next(error);
  }
};

export const getStudentHistoryController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await getStudentHistory(
        user(req),
        validateEnrollmentId(req.params.userId, 'userId'),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const createEnrollmentController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.status(201).json({
      data: await createStudentEnrollment(
        user(req),
        validateCreateEnrollment(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const transferEnrollmentController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.status(201).json({
      data: await transferStudentEnrollment(
        user(req),
        validateEnrollmentId(req.params.id),
        validateTransferEnrollment(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const endEnrollmentController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await endStudentEnrollment(
        user(req),
        validateEnrollmentId(req.params.id),
        validateEndEnrollment(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};
