import type { Request, RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  archiveClassroomTimetable,
  createClassroomTimetable,
  createSchoolShift,
  deleteClassroomTimetable,
  getClassroomTimetable,
  getMyTeachingTimetable,
  getSchoolShifts,
  previewClassroomTimetableConflicts,
  publishClassroomTimetable,
  updateClassroomTimetable,
  updateSchoolShift,
} from './timetable.service.js';
import { validateId, validateShift, validateTimetable } from './timetable.validation.js';

function user(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return req.user;
}

export const getMyTeachingTimetableController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await getMyTeachingTimetable(user(req)) }); } catch (error) { next(error); }
};

export const listSchoolShiftsController: RequestHandler = async (_req, res, next) => {
  try { res.json({ data: await getSchoolShifts() }); } catch (error) { next(error); }
};

export const createSchoolShiftController: RequestHandler = async (req, res, next) => {
  try { res.status(201).json({ data: await createSchoolShift(user(req), validateShift(req.body)) }); } catch (error) { next(error); }
};

export const updateSchoolShiftController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await updateSchoolShift(user(req), validateId(req.params.shiftId, 'shiftId'), validateShift(req.body)) }); } catch (error) { next(error); }
};

export const getClassroomTimetableController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await getClassroomTimetable(user(req), validateId(req.params.id)) }); } catch (error) { next(error); }
};

export const previewTimetableConflictsController: RequestHandler = async (req, res, next) => {
  try {
    const excludeId = req.query.exclude_timetable_id
      ? validateId(String(req.query.exclude_timetable_id), 'exclude_timetable_id')
      : undefined;
    res.json({ data: await previewClassroomTimetableConflicts(
      user(req), validateId(req.params.id), validateTimetable(req.body), excludeId,
    ) });
  } catch (error) { next(error); }
};

export const createClassroomTimetableController: RequestHandler = async (req, res, next) => {
  try { res.status(201).json({ data: await createClassroomTimetable(user(req), validateId(req.params.id), validateTimetable(req.body)) }); } catch (error) { next(error); }
};

export const updateClassroomTimetableController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await updateClassroomTimetable(user(req), validateId(req.params.id), validateId(req.params.timetableId, 'timetableId'), validateTimetable(req.body)) }); } catch (error) { next(error); }
};

export const publishClassroomTimetableController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await publishClassroomTimetable(user(req), validateId(req.params.id), validateId(req.params.timetableId, 'timetableId')) }); } catch (error) { next(error); }
};

export const archiveClassroomTimetableController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await archiveClassroomTimetable(user(req), validateId(req.params.id), validateId(req.params.timetableId, 'timetableId')) }); } catch (error) { next(error); }
};

export const deleteClassroomTimetableController: RequestHandler = async (req, res, next) => {
  try { await deleteClassroomTimetable(user(req), validateId(req.params.id), validateId(req.params.timetableId, 'timetableId')); res.status(204).send(); } catch (error) { next(error); }
};
