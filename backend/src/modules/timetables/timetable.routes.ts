import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import {
  createSchoolShiftController,
  getMyTeachingTimetableController,
  listSchoolShiftsController,
  updateSchoolShiftController,
} from './timetable.controller.js';

export const timetableRoutes = Router();

timetableRoutes.use(requireAuth);
timetableRoutes.get('/me', getMyTeachingTimetableController);
timetableRoutes.get('/shifts', listSchoolShiftsController);
timetableRoutes.post('/shifts', createSchoolShiftController);
timetableRoutes.patch('/shifts/:shiftId', updateSchoolShiftController);
