import type { Request, RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  approveTeachingPlan,
  archiveTeachingPlan,
  createTeachingPlan,
  deleteTeachingPlan,
  getTeachingPlan,
  getTeachingPlanOptions,
  getTeachingPlansSummary,
  listTeachingPlans,
  rejectTeachingPlan,
  submitTeachingPlan,
  updateTeachingPlan,
} from './teaching-plan.service.js';
import { validateCreatePlan, validateListQuery, validatePlanId, validateReview, validateUpdatePlan } from './teaching-plan.validation.js';

function user(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return req.user;
}

export const listController: RequestHandler = async (req, res, next) => {
  try { res.json(await listTeachingPlans(user(req), validateListQuery(req.query))); } catch (error) { next(error); }
};
export const optionsController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await getTeachingPlanOptions(user(req)) }); } catch (error) { next(error); }
};
export const summaryController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await getTeachingPlansSummary(user(req)) }); } catch (error) { next(error); }
};
export const detailController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await getTeachingPlan(user(req), validatePlanId(req.params.id)) }); } catch (error) { next(error); }
};
export const createController: RequestHandler = async (req, res, next) => {
  try { res.status(201).json({ data: await createTeachingPlan(user(req), validateCreatePlan(req.body)) }); } catch (error) { next(error); }
};
export const updateController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await updateTeachingPlan(user(req), validatePlanId(req.params.id), validateUpdatePlan(req.body)) }); } catch (error) { next(error); }
};
export const submitController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await submitTeachingPlan(user(req), validatePlanId(req.params.id)) }); } catch (error) { next(error); }
};
export const approveController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await approveTeachingPlan(user(req), validatePlanId(req.params.id), validateReview(req.body)) }); } catch (error) { next(error); }
};
export const rejectController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await rejectTeachingPlan(user(req), validatePlanId(req.params.id), validateReview(req.body)) }); } catch (error) { next(error); }
};
export const archiveController: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await archiveTeachingPlan(user(req), validatePlanId(req.params.id)) }); } catch (error) { next(error); }
};
export const deleteController: RequestHandler = async (req, res, next) => {
  try { await deleteTeachingPlan(user(req), validatePlanId(req.params.id)); res.status(204).send(); } catch (error) { next(error); }
};
