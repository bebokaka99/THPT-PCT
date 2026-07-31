import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import {
  generateSemesterSnapshotsController,
  getMyTranscriptController,
  getStudentTranscriptController,
  listClassroomTranscriptsController,
} from './transcript.controller.js';

export const transcriptRoutes = Router();

transcriptRoutes.use(requireAuth);
transcriptRoutes.get('/me', getMyTranscriptController);
transcriptRoutes.get('/students/:studentId', getStudentTranscriptController);
transcriptRoutes.get(
  '/classrooms/:classroomId',
  listClassroomTranscriptsController,
);
transcriptRoutes.post(
  '/semesters/:semesterId/snapshot',
  generateSemesterSnapshotsController,
);
