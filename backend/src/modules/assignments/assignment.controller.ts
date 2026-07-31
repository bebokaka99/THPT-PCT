import type { Request, RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  closeAssignment,
  createAssignment,
  getAssignment,
  listAssignments,
  listSubmissions,
  publishAssignment,
  removeAssignment,
  submitAssignment,
  updateAssignment,
} from './assignment.service.js';
import {
  validateAssignmentCreate,
  validateAssignmentId,
  validateAssignmentListQuery,
  validateAssignmentUpdate,
  validateSubmission,
} from './assignment.validation.js';

function user(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return req.user;
}

export const listAssignmentsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json(
      await listAssignments(user(req), validateAssignmentListQuery(req.query)),
    );
  } catch (error) {
    next(error);
  }
};

export const getAssignmentController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await getAssignment(
        user(req),
        validateAssignmentId(req.params.id),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const createAssignmentController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.status(201).json({
      data: await createAssignment(
        user(req),
        validateAssignmentCreate(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const updateAssignmentController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await updateAssignment(
        user(req),
        validateAssignmentId(req.params.id),
        validateAssignmentUpdate(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const publishAssignmentController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await publishAssignment(
        user(req),
        validateAssignmentId(req.params.id),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const closeAssignmentController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await closeAssignment(
        user(req),
        validateAssignmentId(req.params.id),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAssignmentController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    await removeAssignment(user(req), validateAssignmentId(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const listSubmissionsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await listSubmissions(
        user(req),
        validateAssignmentId(req.params.id),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const submitAssignmentController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.status(201).json({
      data: await submitAssignment(
        user(req),
        validateAssignmentId(req.params.id),
        validateSubmission(req.body),
        req.file,
      ),
    });
  } catch (error) {
    next(error);
  }
};
