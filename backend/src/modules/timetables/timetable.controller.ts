import type { Request, RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  createClassroomTimetable,
  deleteClassroomTimetable,
  getClassroomTimetable,
  getMyTeachingTimetable,
  updateClassroomTimetable,
} from './timetable.service.js';
import { validateId, validateTimetable } from './timetable.validation.js';

function user(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return req.user;
}

export const getMyTeachingTimetableController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({ data: await getMyTeachingTimetable(user(req)) });
  } catch (error) {
    next(error);
  }
};

export const getClassroomTimetableController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await getClassroomTimetable(user(req), validateId(req.params.id)) }); } catch (error) { next(error); }
};

export const createClassroomTimetableController: RequestHandler = async (req, res, next) => {
  try { res.status(201).json({ data: await createClassroomTimetable(user(req), validateId(req.params.id), validateTimetable(req.body)) }); } catch (error) { next(error); }
};

export const updateClassroomTimetableController: RequestHandler = async (req, res, next) => {
  try {
    res.json({
      data: await updateClassroomTimetable(
        user(req),
        validateId(req.params.id),
        validateId(req.params.timetableId, 'timetableId'),
        validateTimetable(req.body),
      ),
    });
  } catch (error) { next(error); }
};

export const deleteClassroomTimetableController: RequestHandler = async (req, res, next) => {
  try { await deleteClassroomTimetable(user(req), validateId(req.params.id), validateId(req.params.timetableId, 'timetableId')); res.status(204).send(); } catch (error) { next(error); }
};
