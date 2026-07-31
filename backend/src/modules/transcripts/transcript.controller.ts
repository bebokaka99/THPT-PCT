import type { Request, RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  generateSemesterSnapshots,
  getMyTranscript,
  getStudentTranscript,
  listClassroomTranscripts,
} from './transcript.service.js';
import {
  validateClassroomId,
  validateOptionalSemesterId,
  validateSemesterId,
  validateStudentId,
} from './transcript.validation.js';

function user(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return req.user;
}

export const getMyTranscriptController: RequestHandler = async (req, res, next) => {
  try {
    res.json({
      data: await getMyTranscript(
        user(req),
        validateOptionalSemesterId(req.query.semester_id),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const getStudentTranscriptController: RequestHandler = async (req, res, next) => {
  try {
    res.json({
      data: await getStudentTranscript(
        user(req),
        validateStudentId(req.params.studentId),
        validateOptionalSemesterId(req.query.semester_id),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const listClassroomTranscriptsController: RequestHandler = async (req, res, next) => {
  try {
    res.json(
      await listClassroomTranscripts(
        user(req),
        validateClassroomId(req.params.classroomId),
        validateSemesterId(req.query.semester_id),
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const generateSemesterSnapshotsController: RequestHandler = async (req, res, next) => {
  try {
    res.json({
      data: await generateSemesterSnapshots(
        user(req),
        validateSemesterId(req.params.semesterId),
      ),
    });
  } catch (error) {
    next(error);
  }
};
