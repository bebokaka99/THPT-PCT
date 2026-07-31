import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { env, validateApplicationEnvironment } from './config/env.js';
import { apiRateLimiter, corsOptions } from './config/security.js';
import { checkDatabaseConnection } from './database/postgres.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { requestIdMiddleware } from './middlewares/request-id.middleware.js';
import { requestLogger } from './middlewares/request-logger.js';
import { academicPeriodRoutes } from './modules/academic-periods/academic-period.routes.js';
import { academicOperationRoutes } from './modules/academic-operations/academic-operation.routes.js';
import { academicCalendarRoutes } from './modules/academic-calendar/academic-calendar.routes.js';
import { attendanceRoutes } from './modules/attendance/attendance.routes.js';
import { assessmentConfigurationRoutes } from './modules/assessment-configurations/assessment-configuration.routes.js';
import { assignmentRoutes } from './modules/assignments/assignment.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { categoryRoutes } from './modules/categories/category.routes.js';
import { classroomRoutes } from './modules/classrooms/classroom.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { documentRoutes } from './modules/documents/document.routes.js';
import { eventRoutes } from './modules/events/event.routes.js';
import { gradebookRoutes } from './modules/gradebooks/gradebook.routes.js';
import { guardianRoutes } from './modules/guardians/guardian.routes.js';
import { enrollmentRoutes } from './modules/enrollments/enrollment.routes.js';
import { importerRoutes } from './modules/importer/importer.routes.js';
import { mediaRoutes } from './modules/media/media.routes.js';
import { notificationRoutes } from './modules/notifications/notification.routes.js';
import { postRoutes } from './modules/posts/post.routes.js';
import { profileRoutes } from './modules/profiles/profile.routes.js';
import { roleRoutes } from './modules/roles/role.routes.js';
import { searchRoutes } from './modules/search/search.routes.js';
import { subjectRoutes } from './modules/subjects/subject.routes.js';
import { studentRequestRoutes } from './modules/student-requests/student-request.routes.js';
import { teachingAssignmentRoutes } from './modules/teaching-assignments/teaching-assignment.routes.js';
import { timetableRoutes } from './modules/timetables/timetable.routes.js';
import { transcriptRoutes } from './modules/transcripts/transcript.routes.js';
import { conductRoutes } from './modules/conduct/conduct.routes.js';
import { userRoutes } from './modules/users/user.routes.js';
import { HttpError } from './utils/http-error.js';

validateApplicationEnvironment();

export const app = express();

if (env.security.trustProxyHops > 0) {
  app.set('trust proxy', env.security.trustProxyHops);
}

app.disable('x-powered-by');
app.use(requestIdMiddleware);
app.use(requestLogger);
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  }),
);
app.use(cors(corsOptions));
app.use(express.json({ limit: env.security.jsonBodyLimit, strict: true }));
app.use(
  '/uploads',
  express.static(path.resolve(process.cwd(), 'uploads'), {
    dotfiles: 'deny',
    index: false,
    redirect: false,
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  }),
);
app.use('/api', apiRateLimiter);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'THPT-PCT-PT API is running',
  });
});

app.get('/api/health/db', async (_req, res, next) => {
  try {
    await checkDatabaseConnection();

    res.json({
      status: 'ok',
      database: 'connected',
    });
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/academic-periods', academicPeriodRoutes);
app.use('/api/academic-operations', academicOperationRoutes);
app.use('/api/academic-calendar', academicCalendarRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/assessment-configurations', assessmentConfigurationRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/gradebooks', gradebookRoutes);
app.use('/api/guardians', guardianRoutes);
app.use('/api/importer', importerRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/student-requests', studentRequestRoutes);
app.use('/api/teaching-assignments', teachingAssignmentRoutes);
app.use('/api/timetables', timetableRoutes);
app.use('/api/transcripts', transcriptRoutes);
app.use('/api/conduct', conductRoutes);
app.use('/api/users', userRoutes);

app.use((_req, _res, next) => {
  next(new HttpError(404, 'Route not found'));
});

app.use(errorHandler);
