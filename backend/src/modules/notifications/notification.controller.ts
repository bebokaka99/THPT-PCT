import type { Request, RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import {
  createAdminNotification,
  deleteAdminNotification,
  getMyUnreadCount,
  listAdminNotifications,
  listMyNotifications,
  readAllMyNotifications,
  readMyNotification,
} from './notification.service.js';
import {
  validateCreateNotification,
  validateId,
  validateMyNotificationsQuery,
  validateNotificationsQuery,
} from './notification.validation.js';

function user(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return req.user;
}

export const listMyNotificationsController: RequestHandler = async (req, res, next) => {
  try { res.json(await listMyNotifications(user(req), validateMyNotificationsQuery(req.query))); } catch (error) { next(error); }
};

export const unreadCountController: RequestHandler = async (req, res, next) => {
  try { res.json({ count: await getMyUnreadCount(user(req)) }); } catch (error) { next(error); }
};

export const markReadController: RequestHandler = async (req, res, next) => {
  try { await readMyNotification(user(req), validateId(req.params.id)); res.status(204).send(); } catch (error) { next(error); }
};

export const markReadAllController: RequestHandler = async (req, res, next) => {
  try { await readAllMyNotifications(user(req)); res.status(204).send(); } catch (error) { next(error); }
};

export const listNotificationsController: RequestHandler = async (req, res, next) => {
  try { res.json(await listAdminNotifications(user(req), validateNotificationsQuery(req.query))); } catch (error) { next(error); }
};

export const createNotificationController: RequestHandler = async (req, res, next) => {
  try { res.status(201).json({ data: await createAdminNotification(user(req), validateCreateNotification(req.body)) }); } catch (error) { next(error); }
};

export const deleteNotificationController: RequestHandler = async (req, res, next) => {
  try { await deleteAdminNotification(user(req), validateId(req.params.id)); res.status(204).send(); } catch (error) { next(error); }
};
