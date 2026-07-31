import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { getMyTeachingTimetableController } from './timetable.controller.js';

export const timetableRoutes = Router();

timetableRoutes.use(requireAuth);
timetableRoutes.get('/me', getMyTeachingTimetableController);
