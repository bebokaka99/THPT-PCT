import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { requirePermission } from '../../middlewares/require-permission.js';
import {
  cancelEventController,
  completeEventController,
  createEventController,
  deleteEventController,
  getAdminEventController,
  getPublicEventController,
  hideEventController,
  listAdminEventsController,
  listPublicEventsController,
  publishEventController,
  updateEventController,
} from './event.controller.js';

export const eventRoutes = Router();
const canManageEvents = [requireAuth, requirePermission('events.manage')];

eventRoutes.get('/', listPublicEventsController);
eventRoutes.get('/admin', ...canManageEvents, listAdminEventsController);
eventRoutes.get('/admin/:id', ...canManageEvents, getAdminEventController);
eventRoutes.post('/', ...canManageEvents, createEventController);
eventRoutes.patch('/:id/cancel', ...canManageEvents, cancelEventController);
eventRoutes.patch('/:id/complete', ...canManageEvents, completeEventController);
eventRoutes.patch('/:id/publish', ...canManageEvents, publishEventController);
eventRoutes.patch('/:id/hide', ...canManageEvents, hideEventController);
eventRoutes.patch('/:id', ...canManageEvents, updateEventController);
eventRoutes.delete('/:id', ...canManageEvents, deleteEventController);
eventRoutes.get('/:slug', getPublicEventController);
