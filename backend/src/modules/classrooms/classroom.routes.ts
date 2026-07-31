import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import {
  addMemberController,
  archiveDocumentController,
  archivePostController,
  createClassroomController,
  createDocumentController,
  createPostController,
  deleteClassroomController,
  deleteDocumentController,
  deletePostController,
  getClassroomController,
  listClassroomsController,
  listDocumentsController,
  listMembersController,
  listPostsController,
  publishDocumentController,
  publishPostController,
  removeMemberController,
  updateClassroomController,
  updateDocumentController,
  updatePostController,
} from './classroom.controller.js';
import {
  createClassroomTimetableController,
  deleteClassroomTimetableController,
  getClassroomTimetableController,
  updateClassroomTimetableController,
} from '../timetables/timetable.controller.js';

export const classroomRoutes = Router();

classroomRoutes.use(requireAuth);
classroomRoutes.get('/', listClassroomsController);
classroomRoutes.post('/', createClassroomController);
classroomRoutes.get('/:id', getClassroomController);
classroomRoutes.patch('/:id', updateClassroomController);
classroomRoutes.delete('/:id', deleteClassroomController);
classroomRoutes.get('/:id/members', listMembersController);
classroomRoutes.post('/:id/members', addMemberController);
classroomRoutes.delete('/:id/members/:memberId', removeMemberController);
classroomRoutes.get('/:id/timetable', getClassroomTimetableController);
classroomRoutes.post('/:id/timetable', createClassroomTimetableController);
classroomRoutes.patch('/:id/timetable/:timetableId', updateClassroomTimetableController);
classroomRoutes.delete('/:id/timetable/:timetableId', deleteClassroomTimetableController);
classroomRoutes.get('/:id/posts', listPostsController);
classroomRoutes.post('/:id/posts', createPostController);
classroomRoutes.patch('/:id/posts/:postId', updatePostController);
classroomRoutes.delete('/:id/posts/:postId', deletePostController);
classroomRoutes.patch('/:id/posts/:postId/publish', publishPostController);
classroomRoutes.patch('/:id/posts/:postId/archive', archivePostController);
classroomRoutes.get('/:id/documents', listDocumentsController);
classroomRoutes.post('/:id/documents', createDocumentController);
classroomRoutes.patch('/:id/documents/:documentId', updateDocumentController);
classroomRoutes.delete('/:id/documents/:documentId', deleteDocumentController);
classroomRoutes.patch('/:id/documents/:documentId/publish', publishDocumentController);
classroomRoutes.patch('/:id/documents/:documentId/archive', archiveDocumentController);
