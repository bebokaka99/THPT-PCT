import type { Request, RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  createClassJournal,
  getClassJournal,
  getClassJournalAudit,
  getClassJournalOptions,
  getClassJournalReport,
  listClassJournals,
  updateClassJournal,
} from './class-journal.service.js';
import { validateJournalDate, validateJournalId, validateJournalInput, validateJournalListQuery } from './class-journal.validation.js';

function user(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return req.user;
}

export const listController: RequestHandler = async (req, res, next) => {
  try { res.json(await listClassJournals(user(req), validateJournalListQuery(req.query as Record<string, unknown>))); } catch (error) { next(error); }
};

export const detailController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await getClassJournal(user(req), validateJournalId(req.params.id)) }); } catch (error) { next(error); }
};

export const optionsController: RequestHandler = async (req, res, next) => {
  try { res.json(await getClassJournalOptions(user(req), validateJournalDate(req.query.date))); } catch (error) { next(error); }
};

export const reportController: RequestHandler = async (req, res, next) => {
  try {
    const query = validateJournalListQuery(req.query as Record<string, unknown>);
    if (!query.from || !query.to) throw new HttpError(400, 'from và to là bắt buộc cho báo cáo sổ đầu bài');
    res.json({ data: await getClassJournalReport(user(req), { from: query.from, to: query.to, classroom_id: query.classroom_id, semester_id: query.semester_id }) });
  } catch (error) { next(error); }
};

export const createController: RequestHandler = async (req, res, next) => {
  try { res.status(201).json({ data: await createClassJournal(user(req), validateJournalInput(req.body)) }); } catch (error) { next(error); }
};

export const updateController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await updateClassJournal(user(req), validateJournalId(req.params.id), validateJournalInput(req.body)) }); } catch (error) { next(error); }
};

export const auditController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await getClassJournalAudit(user(req), validateJournalId(req.params.id)) }); } catch (error) { next(error); }
};
