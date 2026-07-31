import type { RequestHandler } from 'express';
import { listRoles } from './role.service.js';

export const listRolesController: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await listRoles());
  } catch (error) {
    next(error);
  }
};
