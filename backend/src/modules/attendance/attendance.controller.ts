import type { Request, RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  createAttendanceSession,
  getAttendanceAudit,
  getAttendanceSession,
  getClassroomSummary,
  getMyAttendance,
  listAttendanceSessions,
  saveAttendance,
} from './attendance.service.js';
import {
  validateAttendanceBulk,
  validateAttendanceId,
  validateAttendanceListQuery,
  validateAttendanceSession,
} from './attendance.validation.js';

function user(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return req.user;
}

export const listAttendanceSessionsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json(
      await listAttendanceSessions(
        user(req),
        validateAttendanceListQuery(req.query),
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getAttendanceSessionController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await getAttendanceSession(
        user(req),
        validateAttendanceId(req.params.id),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const createAttendanceSessionController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.status(201).json({
      data: await createAttendanceSession(
        user(req),
        validateAttendanceSession(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const saveAttendanceController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await saveAttendance(
        user(req),
        validateAttendanceId(req.params.id),
        validateAttendanceBulk(req.body),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const getAttendanceAuditController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await getAttendanceAudit(
        user(req),
        validateAttendanceId(req.params.id),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const getMyAttendanceController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const query = validateAttendanceListQuery(req.query);
    res.json(
      await getMyAttendance(user(req), {
        semesterId: query.semester_id,
        from: query.from,
        to: query.to,
      }),
    );
  } catch (error) {
    next(error);
  }
};

export const getClassroomAttendanceSummaryController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const query = validateAttendanceListQuery(req.query);
    res.json({
      data: await getClassroomSummary(
        user(req),
        validateAttendanceId(req.params.classroomId),
        {
          semesterId: query.semester_id,
          from: query.from,
          to: query.to,
        },
      ),
    });
  } catch (error) {
    next(error);
  }
};
