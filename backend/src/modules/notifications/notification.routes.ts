import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import {
  createNotificationController,
  deleteNotificationController,
  listMyNotificationsController,
  listNotificationsController,
  markReadAllController,
  markReadController,
  unreadCountController,
} from './notification.controller.js';

export const notificationRoutes = Router();

notificationRoutes.use(requireAuth);
notificationRoutes.get('/me', listMyNotificationsController);
notificationRoutes.get('/me/unread-count', unreadCountController);
notificationRoutes.patch('/me/read-all', markReadAllController);
notificationRoutes.patch('/me/:id/read', markReadController);
notificationRoutes.get('/', listNotificationsController);
notificationRoutes.post('/', createNotificationController);
notificationRoutes.delete('/:id', deleteNotificationController);
