import type { Request, RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  archiveScheduleOverride,
  createScheduleOverride,
  deleteScheduleOverride,
  getClassroomDailySchedule,
  getGuardianStudentDailySchedule,
  getMyDailySchedule,
  getScheduleOverrideOptions,
  getScheduleOverrideAudit,
  listClassroomOverrides,
  listAllOverrides,
  publishScheduleOverride,
  updateScheduleOverride,
} from './schedule-override.service.js';
import {
  validateOverrideId,
  validateScheduleOverride,
  validateScheduleOverrideQuery,
} from './schedule-override.validation.js';

function user(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return req.user;
}

export const listClassroomOverridesController: RequestHandler = async (req, res, next) => {
  try {
    res.json(await listClassroomOverrides(
      user(req),
      validateOverrideId(req.params.id),
      validateScheduleOverrideQuery(req.query as Record<string, unknown>),
    ));
  } catch (error) { next(error); }
};

export const listAllOverridesController: RequestHandler = async (req, res, next) => {
  try { res.json(await listAllOverrides(user(req), validateScheduleOverrideQuery(req.query as Record<string, unknown>))); } catch (error) { next(error); }
};

export const getClassroomDailyScheduleController: RequestHandler = async (req, res, next) => {
  try {
    const query = validateScheduleOverrideQuery(req.query as Record<string, unknown>);
    res.json({ data: await getClassroomDailySchedule(user(req), validateOverrideId(req.params.id), query.date) });
  } catch (error) { next(error); }
};

export const getMyDailyScheduleController: RequestHandler = async (req, res, next) => {
  try {
    const query = validateScheduleOverrideQuery(req.query as Record<string, unknown>);
    res.json({ data: await getMyDailySchedule(user(req), query.date) });
  } catch (error) { next(error); }
};

export const getScheduleOverrideOptionsController: RequestHandler = async (req, res, next) => {
  try {
    res.json({
      data: await getScheduleOverrideOptions(
        user(req),
        validateOverrideId(req.params.id),
        validateOverrideId(String(req.query.timetable_item_id ?? ''), 'timetable_item_id'),
      ),
    });
  } catch (error) { next(error); }
};

export const getGuardianStudentDailyScheduleController: RequestHandler = async (req, res, next) => {
  try {
    const query = validateScheduleOverrideQuery(req.query as Record<string, unknown>);
    res.json({
      data: await getGuardianStudentDailySchedule(
        user(req),
        validateOverrideId(req.params.studentId, 'studentId'),
        query.date,
      ),
    });
  } catch (error) { next(error); }
};

export const createScheduleOverrideController: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json({ data: await createScheduleOverride(user(req), validateOverrideId(req.params.id), validateScheduleOverride(req.body)) });
  } catch (error) { next(error); }
};

export const updateScheduleOverrideController: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await updateScheduleOverride(user(req), validateOverrideId(req.params.overrideId, 'overrideId'), validateScheduleOverride(req.body)) });
  } catch (error) { next(error); }
};

export const publishScheduleOverrideController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await publishScheduleOverride(user(req), validateOverrideId(req.params.overrideId, 'overrideId')) }); } catch (error) { next(error); }
};

export const archiveScheduleOverrideController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await archiveScheduleOverride(user(req), validateOverrideId(req.params.overrideId, 'overrideId')) }); } catch (error) { next(error); }
};

export const deleteScheduleOverrideController: RequestHandler = async (req, res, next) => {
  try { await deleteScheduleOverride(user(req), validateOverrideId(req.params.overrideId, 'overrideId')); res.status(204).send(); } catch (error) { next(error); }
};

export const getScheduleOverrideAuditController: RequestHandler = async (req, res, next) => {
  try { res.json(await getScheduleOverrideAudit(user(req), validateOverrideId(req.params.overrideId, 'overrideId'))); } catch (error) { next(error); }
};
