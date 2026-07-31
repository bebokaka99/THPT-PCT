import type { RequestHandler } from 'express';
import { getDashboardOverview } from './dashboard.service.js';

export const getDashboardOverviewController: RequestHandler = async (
  _req,
  res,
  next,
) => {
  try {
    res.json({ data: await getDashboardOverview() });
  } catch (error) {
    next(error);
  }
};
