import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import {
  createNotificationController,
  deleteNotificationController,
  acknowledgeController,
  communicationOptionsController,
  listMyNotificationsController,
  listNotificationsController,
  markReadAllController,
  markReadController,
  notificationReportController,
  unreadCountController,
} from './notification.controller.js';

export const notificationRoutes = Router();

notificationRoutes.use(requireAuth);
notificationRoutes.get('/me', listMyNotificationsController);
notificationRoutes.get('/me/unread-count', unreadCountController);
notificationRoutes.patch('/me/read-all', markReadAllController);
notificationRoutes.patch('/me/:id/read', markReadController);
notificationRoutes.patch('/me/:id/acknowledge', acknowledgeController);
notificationRoutes.get('/options', communicationOptionsController);
notificationRoutes.get('/:id/report', notificationReportController);
notificationRoutes.get('/', listNotificationsController);
notificationRoutes.post('/', createNotificationController);
notificationRoutes.delete('/:id', deleteNotificationController);
