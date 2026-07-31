import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import {
  archiveScheduleOverrideController,
  createScheduleOverrideController,
  deleteScheduleOverrideController,
  getClassroomDailyScheduleController,
  getMyDailyScheduleController,
  getScheduleOverrideAuditController,
  listClassroomOverridesController,
  listAllOverridesController,
  publishScheduleOverrideController,
  updateScheduleOverrideController,
} from './schedule-override.controller.js';

export const scheduleOverrideRoutes = Router();
scheduleOverrideRoutes.use(requireAuth);
scheduleOverrideRoutes.get('/me', getMyDailyScheduleController);
scheduleOverrideRoutes.get('/', listAllOverridesController);
scheduleOverrideRoutes.get('/classrooms/:id', listClassroomOverridesController);
scheduleOverrideRoutes.get('/classrooms/:id/daily-schedule', getClassroomDailyScheduleController);
scheduleOverrideRoutes.post('/classrooms/:id', createScheduleOverrideController);
scheduleOverrideRoutes.patch('/:overrideId', updateScheduleOverrideController);
scheduleOverrideRoutes.post('/:overrideId/publish', publishScheduleOverrideController);
scheduleOverrideRoutes.post('/:overrideId/archive', archiveScheduleOverrideController);
scheduleOverrideRoutes.delete('/:overrideId', deleteScheduleOverrideController);
scheduleOverrideRoutes.get('/:overrideId/audit', getScheduleOverrideAuditController);
