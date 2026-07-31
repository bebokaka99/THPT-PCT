import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import {
  approveRequestController,
  cancelRequestController,
  createRequestController,
  createRequestTypeController,
  downloadRequestAttachmentController,
  getRequestController,
  getRequestHistoryController,
  listRequestsController,
  listRequestTypesController,
  rejectRequestController,
  startRequestReviewController,
  submitRequestController,
  updateRequestTypeController,
  uploadRequestAttachmentController,
} from './student-request.controller.js';
import { studentRequestAttachmentUpload } from './student-request.upload.js';

export const studentRequestRoutes = Router();

studentRequestRoutes.use(requireAuth);
studentRequestRoutes.get('/types', listRequestTypesController);
studentRequestRoutes.post('/types', createRequestTypeController);
studentRequestRoutes.patch('/types/:id', updateRequestTypeController);
studentRequestRoutes.get('/', listRequestsController);
studentRequestRoutes.post('/', createRequestController);
studentRequestRoutes.post('/:id/submit', submitRequestController);
studentRequestRoutes.post('/:id/cancel', cancelRequestController);
studentRequestRoutes.post('/:id/start-review', startRequestReviewController);
studentRequestRoutes.post('/:id/approve', approveRequestController);
studentRequestRoutes.post('/:id/reject', rejectRequestController);
studentRequestRoutes.get('/:id/history', getRequestHistoryController);
studentRequestRoutes.post(
  '/:id/attachments',
  studentRequestAttachmentUpload.single('file'),
  uploadRequestAttachmentController,
);
studentRequestRoutes.get(
  '/:id/attachments/:attachmentId/download',
  downloadRequestAttachmentController,
);
studentRequestRoutes.get('/:id', getRequestController);
