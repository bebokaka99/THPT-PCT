import { Router } from 'express';
import { requireAuth } from '../../middlewares/require-auth.js';
import { auditController, createController, detailController, listController, optionsController, reportController, updateController } from './class-journal.controller.js';

export const classJournalRoutes = Router();
classJournalRoutes.use(requireAuth);
classJournalRoutes.get('/options', optionsController);
classJournalRoutes.get('/report', reportController);
classJournalRoutes.get('/', listController);
classJournalRoutes.post('/', createController);
classJournalRoutes.get('/:id/audit', auditController);
classJournalRoutes.get('/:id', detailController);
classJournalRoutes.patch('/:id', updateController);
