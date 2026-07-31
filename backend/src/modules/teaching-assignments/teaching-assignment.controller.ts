import type { Request, RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  createTeachingAssignment,
  createTeachingAssignmentsBulk,
  endTeachingAssignment,
  getTeachingAssignmentForUser,
  listMyTeachingAssignments,
  listTeachingAssignmentsForAdmin,
  setTeachingAssignmentStatus,
  updateTeachingAssignment,
} from './teaching-assignment.service.js';
import {
  validateListTeachingAssignmentsQuery,
  validateTeachingAssignment,
  validateTeachingAssignmentBulk,
  validateTeachingAssignmentId,
  validateTeachingAssignmentStatus,
  validateTeachingAssignmentUpdate,
} from './teaching-assignment.validation.js';

function user(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return req.user;
}

export const listTeachingAssignmentsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json(
      await listTeachingAssignmentsForAdmin(
        user(req),
        validateListTeachingAssignmentsQuery(req.query),
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const listMyTeachingAssignmentsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json(
      await listMyTeachingAssignments(
        user(req),
        validateListTeachingAssignmentsQuery(req.query),
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getTeachingAssignmentController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await getTeachingAssignmentForUser(
        user(req),
        validateTeachingAssignmentId(req.params.id),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const createTeachingAssignmentController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.status(201).json({
      data: await createTeachingAssignment(
        user(req),
        validateTeachingAssignment(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const bulkTeachingAssignmentController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const data = await createTeachingAssignmentsBulk(
      user(req),
      validateTeachingAssignmentBulk(req.body),
    );
    res.status(201).json({ data, total: data.length });
  } catch (error) {
    next(error);
  }
};

export const updateTeachingAssignmentController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await updateTeachingAssignment(
        user(req),
        validateTeachingAssignmentId(req.params.id),
        validateTeachingAssignmentUpdate(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const setTeachingAssignmentStatusController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await setTeachingAssignmentStatus(
        user(req),
        validateTeachingAssignmentId(req.params.id),
        validateTeachingAssignmentStatus(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTeachingAssignmentController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const status = validateTeachingAssignmentStatus({
      status: 'inactive',
      effective_date: req.query.effective_date,
    });
    await endTeachingAssignment(
      user(req),
      validateTeachingAssignmentId(req.params.id),
      status.effective_date,
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
