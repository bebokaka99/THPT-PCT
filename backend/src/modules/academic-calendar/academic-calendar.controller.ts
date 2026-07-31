import type { Request, RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  archiveAcademicCalendarEntry,
  createAcademicCalendarEntry,
  getAcademicCalendarEntry,
  listAcademicCalendarAudits,
  listAcademicCalendarEntries,
  previewAcademicCalendarConflicts,
  publishAcademicCalendarEntry,
  removeAcademicCalendarEntry,
  updateAcademicCalendarEntry,
} from './academic-calendar.service.js';
import {
  validateAcademicCalendarCreate,
  validateAcademicCalendarId,
  validateAcademicCalendarListQuery,
  validateAcademicCalendarUpdate,
} from './academic-calendar.validation.js';

function user(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return req.user;
}

export const listAcademicCalendarController: RequestHandler = async (req, res, next) => {
  try { res.json(await listAcademicCalendarEntries(user(req), validateAcademicCalendarListQuery(req.query))); } catch (error) { next(error); }
};
export const getAcademicCalendarController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await getAcademicCalendarEntry(user(req), validateAcademicCalendarId(req.params.id), req.query.student_id ? validateAcademicCalendarId(String(req.query.student_id), 'student_id') : undefined) }); } catch (error) { next(error); }
};
export const createAcademicCalendarController: RequestHandler = async (req, res, next) => {
  try { res.status(201).json({ data: await createAcademicCalendarEntry(user(req), validateAcademicCalendarCreate(req.body)) }); } catch (error) { next(error); }
};
export const updateAcademicCalendarController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await updateAcademicCalendarEntry(user(req), validateAcademicCalendarId(req.params.id), validateAcademicCalendarUpdate(req.body)) }); } catch (error) { next(error); }
};
export const previewAcademicCalendarConflictsController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await previewAcademicCalendarConflicts(user(req), validateAcademicCalendarCreate(req.body), req.query.exclude_id ? validateAcademicCalendarId(String(req.query.exclude_id), 'exclude_id') : undefined) }); } catch (error) { next(error); }
};
export const publishAcademicCalendarController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await publishAcademicCalendarEntry(user(req), validateAcademicCalendarId(req.params.id)) }); } catch (error) { next(error); }
};
export const archiveAcademicCalendarController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await archiveAcademicCalendarEntry(user(req), validateAcademicCalendarId(req.params.id)) }); } catch (error) { next(error); }
};
export const deleteAcademicCalendarController: RequestHandler = async (req, res, next) => {
  try { await removeAcademicCalendarEntry(user(req), validateAcademicCalendarId(req.params.id)); res.status(204).send(); } catch (error) { next(error); }
};
export const listAcademicCalendarAuditsController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await listAcademicCalendarAudits(user(req), validateAcademicCalendarId(req.params.id)) }); } catch (error) { next(error); }
};
