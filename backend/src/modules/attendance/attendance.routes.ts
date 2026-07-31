import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import {
  createAttendanceSessionController,
  getAttendanceAuditController,
  getAttendanceSessionController,
  getClassroomAttendanceSummaryController,
  getMyAttendanceController,
  listAttendanceSessionsController,
  saveAttendanceController,
} from './attendance.controller.js';

export const attendanceRoutes = Router();

attendanceRoutes.use(requireAuth);
attendanceRoutes.get('/me', getMyAttendanceController);
attendanceRoutes.get(
  '/summary/classrooms/:classroomId',
  getClassroomAttendanceSummaryController,
);
attendanceRoutes.get('/sessions', listAttendanceSessionsController);
attendanceRoutes.post('/sessions', createAttendanceSessionController);
attendanceRoutes.get('/sessions/:id/audit', getAttendanceAuditController);
attendanceRoutes.put('/sessions/:id/records', saveAttendanceController);
attendanceRoutes.get('/sessions/:id', getAttendanceSessionController);

