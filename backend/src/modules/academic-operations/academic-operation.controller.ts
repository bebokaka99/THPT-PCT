import type { Request, RequestHandler, Response } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  commitAcademicImport,
  exportAttendance,
  exportGradebook,
  exportImportErrors,
  exportRoster,
  exportTranscriptSummary,
  getAcademicImportJob,
  getImportTemplate,
  getReportSummary,
  listAcademicImportJobs,
  previewAcademicImport,
} from './academic-operation.service.js';
import {
  requiredExportId,
  validateIdempotencyKey,
  validateImportJobId,
  validateImportJobList,
  validateImportType,
  validateReportFilters,
} from './academic-operation.validation.js';

function user(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return req.user;
}

function sendCsv(res: Response, fileName: string, content: string) {
  res
    .status(200)
    .setHeader('Content-Type', 'text/csv; charset=utf-8')
    .setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    .send(content);
}

export const downloadTemplateController: RequestHandler = (req, res, next) => {
  try {
    const type = validateImportType(req.params.type);
    sendCsv(res, `${type}-template.csv`, getImportTemplate(type));
  } catch (error) {
    next(error);
  }
};

export const previewImportController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    if (!req.file) throw new HttpError(400, 'CSV file is required');
    res.status(201).json({
      data: await previewAcademicImport(user(req), {
        type: validateImportType(req.body.type),
        idempotencyKey: validateIdempotencyKey(req.body.idempotency_key),
        file: req.file,
      }),
    });
  } catch (error) {
    next(error);
  }
};

export const listImportJobsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json(
      await listAcademicImportJobs(
        user(req),
        validateImportJobList(req.query),
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getImportJobController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await getAcademicImportJob(
        user(req),
        validateImportJobId(req.params.id),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const commitImportController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await commitAcademicImport(
        user(req),
        validateImportJobId(req.params.id),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const exportImportErrorsController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const id = validateImportJobId(req.params.id);
    sendCsv(
      res,
      `academic-import-${id}-errors.csv`,
      await exportImportErrors(user(req), id),
    );
  } catch (error) {
    next(error);
  }
};

export const exportRosterController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const classroomId = requiredExportId(req.query, 'classroom_id');
    sendCsv(
      res,
      `classroom-${classroomId}-roster.csv`,
      await exportRoster(user(req), classroomId),
    );
  } catch (error) {
    next(error);
  }
};

export const exportAttendanceController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const classroomId = requiredExportId(req.query, 'classroom_id');
    const semesterId = requiredExportId(req.query, 'semester_id');
    sendCsv(
      res,
      `classroom-${classroomId}-attendance.csv`,
      await exportAttendance(user(req), classroomId, semesterId),
    );
  } catch (error) {
    next(error);
  }
};

export const exportGradebookController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const id = validateImportJobId(req.params.id);
    sendCsv(
      res,
      `gradebook-${id}.csv`,
      await exportGradebook(user(req), id),
    );
  } catch (error) {
    next(error);
  }
};

export const exportTranscriptController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const classroomId = requiredExportId(req.query, 'classroom_id');
    const semesterId = requiredExportId(req.query, 'semester_id');
    sendCsv(
      res,
      `classroom-${classroomId}-transcript-summary.csv`,
      await exportTranscriptSummary(user(req), classroomId, semesterId),
    );
  } catch (error) {
    next(error);
  }
};

export const reportSummaryController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    res.json({
      data: await getReportSummary(user(req), validateReportFilters(req.query)),
    });
  } catch (error) {
    next(error);
  }
};

