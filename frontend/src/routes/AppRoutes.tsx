import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../pages/auth/LoginPage';
import { CategoryPage } from '../pages/public/CategoryPage';
import { DocumentDetailPage } from '../pages/public/DocumentDetailPage';
import { DocumentsPage } from '../pages/public/DocumentsPage';
import { HomePage } from '../pages/public/HomePage';
import { PostDetailPage } from '../pages/public/PostDetailPage';
import { PostsPage } from '../pages/public/PostsPage';
import { SearchPage } from '../pages/public/SearchPage';
import { EventsPage } from '../pages/public/EventsPage';
import { EventDetailPage } from '../pages/public/EventDetailPage';
import { AuthProvider } from '../stores/auth-context';
import { ProtectedRoute } from './ProtectedRoute';

const AdminAcademicPeriodsPage = lazy(() =>
  import('../pages/admin/AdminAcademicPeriodsPage').then((module) => ({
    default: module.AdminAcademicPeriodsPage,
  })),
);
const AdminAcademicOperationsPage = lazy(() =>
  import('../pages/admin/AdminAcademicOperationsPage').then((module) => ({
    default: module.AdminAcademicOperationsPage,
  })),
);
const AdminAcademicCalendarPage = lazy(() =>
  import('../pages/admin/AdminAcademicCalendarPage').then((module) => ({
    default: module.AdminAcademicCalendarPage,
  })),
);
const AdminSubjectsPage = lazy(() =>
  import('../pages/admin/AdminSubjectsPage').then((module) => ({
    default: module.AdminSubjectsPage,
  })),
);
const AdminEnrollmentsPage = lazy(() =>
  import('../pages/admin/AdminEnrollmentsPage').then((module) => ({
    default: module.AdminEnrollmentsPage,
  })),
);
const AdminTeachingAssignmentsPage = lazy(() =>
  import('../pages/admin/AdminTeachingAssignmentsPage').then((module) => ({
    default: module.AdminTeachingAssignmentsPage,
  })),
);
const AdminAssessmentConfigurationsPage = lazy(() =>
  import('../pages/admin/AdminAssessmentConfigurationsPage').then(
    (module) => ({
      default: module.AdminAssessmentConfigurationsPage,
    }),
  ),
);
const AdminAttendancePage = lazy(() =>
  import('../pages/admin/AdminAttendancePage').then((module) => ({
    default: module.AdminAttendancePage,
  })),
);
const AdminAssignmentsPage = lazy(() =>
  import('../pages/admin/AdminAssignmentsPage').then((module) => ({
    default: module.AdminAssignmentsPage,
  })),
);
const AdminGradebooksPage = lazy(() =>
  import('../pages/admin/AdminGradebooksPage').then((module) => ({
    default: module.AdminGradebooksPage,
  })),
);
const AdminReportCardsPage = lazy(() =>
  import('../pages/admin/AdminReportCardsPage').then((module) => ({
    default: module.AdminReportCardsPage,
  })),
);
const AdminConductPage = lazy(() =>
  import('../pages/admin/AdminConductPage').then((module) => ({
    default: module.AdminConductPage,
  })),
);
const AdminGuardiansPage = lazy(() =>
  import('../pages/admin/AdminGuardiansPage').then((module) => ({
    default: module.AdminGuardiansPage,
  })),
);
const AdminStudentRequestsPage = lazy(() =>
  import('../pages/admin/AdminStudentRequestsPage').then((module) => ({
    default: module.AdminStudentRequestsPage,
  })),
);
const AdminCategoriesPage = lazy(() =>
  import('../pages/admin/AdminCategoriesPage').then((module) => ({
    default: module.AdminCategoriesPage,
  })),
);
const AdminClassroomDetailPage = lazy(() =>
  import('../pages/admin/AdminClassroomDetailPage').then((module) => ({
    default: module.AdminClassroomDetailPage,
  })),
);
const AdminClassroomFormPage = lazy(() =>
  import('../pages/admin/AdminClassroomFormPage').then((module) => ({
    default: module.AdminClassroomFormPage,
  })),
);
const AdminClassroomsPage = lazy(() =>
  import('../pages/admin/AdminClassroomsPage').then((module) => ({
    default: module.AdminClassroomsPage,
  })),
);
const AdminTimetableSettingsPage = lazy(() =>
  import('../pages/admin/AdminTimetableSettingsPage').then((module) => ({
    default: module.AdminTimetableSettingsPage,
  })),
);
const AdminDashboardPage = lazy(() =>
  import('../pages/admin/AdminDashboardPage').then((module) => ({
    default: module.AdminDashboardPage,
  })),
);
const AdminDocumentFormPage = lazy(() =>
  import('../pages/admin/AdminDocumentFormPage').then((module) => ({
    default: module.AdminDocumentFormPage,
  })),
);
const AdminDocumentsPage = lazy(() =>
  import('../pages/admin/AdminDocumentsPage').then((module) => ({
    default: module.AdminDocumentsPage,
  })),
);
const AdminImporterPage = lazy(() =>
  import('../pages/admin/AdminImporterPage').then((module) => ({
    default: module.AdminImporterPage,
  })),
);
const AdminEventsPage = lazy(() =>
  import('../pages/admin/AdminEventsPage').then((module) => ({
    default: module.AdminEventsPage,
  })),
);
const AdminEventFormPage = lazy(() =>
  import('../pages/admin/AdminEventFormPage').then((module) => ({
    default: module.AdminEventFormPage,
  })),
);
const AdminMediaPage = lazy(() =>
  import('../pages/admin/AdminMediaPage').then((module) => ({
    default: module.AdminMediaPage,
  })),
);
const AdminPostFormPage = lazy(() =>
  import('../pages/admin/AdminPostFormPage').then((module) => ({
    default: module.AdminPostFormPage,
  })),
);
const AdminPostsPage = lazy(() =>
  import('../pages/admin/AdminPostsPage').then((module) => ({
    default: module.AdminPostsPage,
  })),
);
const AdminUserFormPage = lazy(() =>
  import('../pages/admin/AdminUserFormPage').then((module) => ({
    default: module.AdminUserFormPage,
  })),
);
const AdminBulkStudentAccountsPage = lazy(() =>
  import('../pages/admin/AdminBulkStudentAccountsPage').then((module) => ({
    default: module.AdminBulkStudentAccountsPage,
  })),
);
const AdminUsersPage = lazy(() =>
  import('../pages/admin/AdminUsersPage').then((module) => ({
    default: module.AdminUsersPage,
  })),
);
const StudentDashboardPage = lazy(() =>
  import('../pages/student/StudentDashboardPage').then((module) => ({
    default: module.StudentDashboardPage,
  })),
);
const StudentEnrollmentHistoryPage = lazy(() =>
  import('../pages/student/StudentEnrollmentHistoryPage').then((module) => ({
    default: module.StudentEnrollmentHistoryPage,
  })),
);
const StudentAttendancePage = lazy(() =>
  import('../pages/student/StudentAttendancePage').then((module) => ({
    default: module.StudentAttendancePage,
  })),
);
const StudentTimetablePage = lazy(() =>
  import('../pages/student/StudentTimetablePage').then((module) => ({
    default: module.StudentTimetablePage,
  })),
);
const StudentAcademicCalendarPage = lazy(() =>
  import('../pages/student/StudentAcademicCalendarPage').then((module) => ({
    default: module.StudentAcademicCalendarPage,
  })),
);
const StudentAssignmentsPage = lazy(() =>
  import('../pages/student/StudentAssignmentsPage').then((module) => ({
    default: module.StudentAssignmentsPage,
  })),
);
const StudentRequestsPage = lazy(() =>
  import('../pages/student/StudentRequestsPage').then((module) => ({
    default: module.StudentRequestsPage,
  })),
);
const StudentGradesPage = lazy(() =>
  import('../pages/student/StudentGradesPage').then((module) => ({
    default: module.StudentGradesPage,
  })),
);
const StudentClassDetailPage = lazy(() =>
  import('../pages/student/StudentClassDetailPage').then((module) => ({
    default: module.StudentClassDetailPage,
  })),
);
const StudentClassesPage = lazy(() =>
  import('../pages/student/StudentClassesPage').then((module) => ({
    default: module.StudentClassesPage,
  })),
);
const StudentProfilePage = lazy(() =>
  import('../pages/student/StudentProfilePage').then((module) => ({
    default: module.StudentProfilePage,
  })),
);
const TeacherDashboardPage = lazy(() =>
  import('../pages/teacher/TeacherDashboardPage').then((module) => ({
    default: module.TeacherDashboardPage,
  })),
);
const TeacherClassDetailPage = lazy(() =>
  import('../pages/teacher/TeacherClassDetailPage').then((module) => ({
    default: module.TeacherClassDetailPage,
  })),
);
const TeacherTeachingAssignmentsPage = lazy(() =>
  import('../pages/teacher/TeacherTeachingAssignmentsPage').then((module) => ({
    default: module.TeacherTeachingAssignmentsPage,
  })),
);
const TeacherTimetablePage = lazy(() =>
  import('../pages/teacher/TeacherTimetablePage').then((module) => ({
    default: module.TeacherTimetablePage,
  })),
);
const TeacherAcademicCalendarPage = lazy(() =>
  import('../pages/teacher/TeacherAcademicCalendarPage').then((module) => ({
    default: module.TeacherAcademicCalendarPage,
  })),
);
const TeacherAssessmentConfigurationsPage = lazy(() =>
  import('../pages/teacher/TeacherAssessmentConfigurationsPage').then(
    (module) => ({
      default: module.TeacherAssessmentConfigurationsPage,
    }),
  ),
);
const TeacherAttendancePage = lazy(() =>
  import('../pages/teacher/TeacherAttendancePage').then((module) => ({
    default: module.TeacherAttendancePage,
  })),
);
const TeacherAssignmentsPage = lazy(() =>
  import('../pages/teacher/TeacherAssignmentsPage').then((module) => ({
    default: module.TeacherAssignmentsPage,
  })),
);
const TeacherGradebookPage = lazy(() =>
  import('../pages/teacher/TeacherGradebookPage').then((module) => ({
    default: module.TeacherGradebookPage,
  })),
);
const TeacherReportCardsPage = lazy(() =>
  import('../pages/teacher/TeacherReportCardsPage').then((module) => ({
    default: module.TeacherReportCardsPage,
  })),
);
const TeacherConductPage = lazy(() =>
  import('../pages/teacher/TeacherConductPage').then((module) => ({
    default: module.TeacherConductPage,
  })),
);
const TeacherStudentRequestsPage = lazy(() =>
  import('../pages/teacher/TeacherStudentRequestsPage').then((module) => ({
    default: module.TeacherStudentRequestsPage,
  })),
);
const TeacherClassesPage = lazy(() =>
  import('../pages/teacher/TeacherClassesPage').then((module) => ({
    default: module.TeacherClassesPage,
  })),
);
const TeacherProfilePage = lazy(() =>
  import('../pages/teacher/TeacherProfilePage').then((module) => ({
    default: module.TeacherProfilePage,
  })),
);
const NotificationCenterPage = lazy(() =>
  import('../pages/shared/NotificationCenterPage').then((module) => ({
    default: module.NotificationCenterPage,
  })),
);
const ParentDashboardPage = lazy(() =>
  import('../pages/parent/ParentDashboardPage').then((module) => ({
    default: module.ParentDashboardPage,
  })),
);
const ParentStudentPage = lazy(() =>
  import('../pages/parent/ParentStudentPage').then((module) => ({
    default: module.ParentStudentPage,
  })),
);
const ParentAcademicCalendarPage = lazy(() =>
  import('../pages/parent/ParentAcademicCalendarPage').then((module) => ({
    default: module.ParentAcademicCalendarPage,
  })),
);

function AdminPageFallback() {
  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
        Đang tải trang quản trị...
      </div>
    </div>
  );
}

function protectedAdminPage(children: ReactNode, requiredPermission: string) {
  return (
    <ProtectedRoute requiredRole="admin" requiredPermission={requiredPermission}>
      <Suspense fallback={<AdminPageFallback />}>{children}</Suspense>
    </ProtectedRoute>
  );
}

function protectedRolePage(children: ReactNode, requiredRoles: string[]) {
  return (
    <ProtectedRoute requiredRoles={requiredRoles}>
      <Suspense fallback={<AdminPageFallback />}>{children}</Suspense>
    </ProtectedRoute>
  );
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tin-tuc" element={<PostsPage />} />
          <Route path="/tin-tuc/:slug" element={<PostDetailPage />} />
          <Route path="/tai-lieu" element={<DocumentsPage />} />
          <Route path="/tai-lieu/:slug" element={<DocumentDetailPage />} />
          <Route path="/danh-muc/:slug" element={<CategoryPage />} />
          <Route path="/tim-kiem" element={<SearchPage />} />
          <Route path="/su-kien" element={<EventsPage />} />
          <Route path="/su-kien/:slug" element={<EventDetailPage />} />
          <Route path="/dang-nhap" element={<LoginPage />} />
          <Route
            path="/notifications"
            element={protectedRolePage(<NotificationCenterPage />, [
              'admin',
              'teacher',
              'student',
              'guardian',
            ])}
          />
          <Route
            path="/admin"
            element={protectedAdminPage(<AdminDashboardPage />, 'dashboard.read')}
          />
          <Route
            path="/admin/academic-periods"
            element={protectedAdminPage(
              <AdminAcademicPeriodsPage />,
              'academic_periods.manage',
            )}
          />
          <Route
            path="/admin/academic-operations"
            element={protectedAdminPage(
              <AdminAcademicOperationsPage />,
              'academic_imports.manage',
            )}
          />
          <Route
            path="/admin/academic-calendar"
            element={protectedAdminPage(
              <AdminAcademicCalendarPage />,
              'academic_calendar.manage',
            )}
          />
          <Route
            path="/admin/subjects"
            element={protectedAdminPage(
              <AdminSubjectsPage />,
              'subjects.manage',
            )}
          />
          <Route
            path="/admin/enrollments"
            element={protectedAdminPage(
              <AdminEnrollmentsPage />,
              'enrollments.manage',
            )}
          />
          <Route
            path="/admin/teaching-assignments"
            element={protectedAdminPage(
              <AdminTeachingAssignmentsPage />,
              'teaching_assignments.manage',
            )}
          />
          <Route
            path="/admin/assessment-configurations"
            element={protectedAdminPage(
              <AdminAssessmentConfigurationsPage />,
              'assessment_configurations.manage',
            )}
          />
          <Route
            path="/admin/attendance"
            element={protectedRolePage(<AdminAttendancePage />, ['admin'])}
          />
          <Route
            path="/admin/assignments"
            element={protectedAdminPage(
              <AdminAssignmentsPage />,
              'assignments.manage',
            )}
          />
          <Route
            path="/admin/gradebooks"
            element={protectedAdminPage(
              <AdminGradebooksPage />,
              'gradebooks.manage',
            )}
          />
          <Route
            path="/admin/report-cards"
            element={protectedAdminPage(
              <AdminReportCardsPage />,
              'transcripts.read',
            )}
          />
          <Route
            path="/admin/conduct"
            element={protectedAdminPage(
              <AdminConductPage />,
              'conduct.review',
            )}
          />
          <Route
            path="/admin/guardians"
            element={protectedAdminPage(
              <AdminGuardiansPage />,
              'guardians.manage',
            )}
          />
          <Route
            path="/admin/student-requests"
            element={protectedAdminPage(
              <AdminStudentRequestsPage />,
              'student_requests.review',
            )}
          />
          <Route
            path="/admin/posts"
            element={protectedAdminPage(<AdminPostsPage />, 'posts.manage')}
          />
          <Route
            path="/admin/posts/new"
            element={protectedAdminPage(<AdminPostFormPage />, 'posts.manage')}
          />
          <Route
            path="/admin/posts/:id/edit"
            element={protectedAdminPage(<AdminPostFormPage />, 'posts.manage')}
          />
          <Route
            path="/admin/categories"
            element={protectedAdminPage(<AdminCategoriesPage />, 'posts.manage')}
          />
          <Route
            path="/admin/classrooms"
            element={protectedAdminPage(<AdminClassroomsPage />, 'classrooms.manage')}
          />
          <Route
            path="/admin/classrooms/new"
            element={protectedAdminPage(<AdminClassroomFormPage />, 'classrooms.manage')}
          />
          <Route
            path="/admin/classrooms/:id"
            element={protectedAdminPage(<AdminClassroomDetailPage />, 'classrooms.manage')}
          />
          <Route
            path="/admin/classrooms/:id/edit"
            element={protectedAdminPage(<AdminClassroomFormPage />, 'classrooms.manage')}
          />
          <Route
            path="/admin/timetable-settings"
            element={protectedAdminPage(<AdminTimetableSettingsPage />, 'classrooms.manage')}
          />
          <Route
            path="/admin/documents"
            element={protectedAdminPage(<AdminDocumentsPage />, 'documents.manage')}
          />
          <Route
            path="/admin/documents/new"
            element={protectedAdminPage(<AdminDocumentFormPage />, 'documents.manage')}
          />
          <Route
            path="/admin/documents/:id/edit"
            element={protectedAdminPage(<AdminDocumentFormPage />, 'documents.manage')}
          />
          <Route
            path="/admin/media"
            element={protectedAdminPage(<AdminMediaPage />, 'posts.manage')}
          />
          <Route
            path="/admin/events"
            element={protectedAdminPage(<AdminEventsPage />, 'events.manage')}
          />
          <Route
            path="/admin/events/new"
            element={protectedAdminPage(<AdminEventFormPage />, 'events.manage')}
          />
          <Route
            path="/admin/events/:id/edit"
            element={protectedAdminPage(<AdminEventFormPage />, 'events.manage')}
          />
          <Route
            path="/admin/importer"
            element={protectedAdminPage(<AdminImporterPage />, 'posts.manage')}
          />
          <Route
            path="/admin/users"
            element={protectedAdminPage(<AdminUsersPage />, 'users.manage')}
          />
          <Route
            path="/admin/users/bulk-students"
            element={protectedAdminPage(<AdminBulkStudentAccountsPage />, 'users.manage')}
          />
          <Route
            path="/admin/users/new"
            element={protectedAdminPage(<AdminUserFormPage />, 'users.manage')}
          />
          <Route
            path="/admin/users/:id/edit"
            element={protectedAdminPage(<AdminUserFormPage />, 'users.manage')}
          />
          <Route
            path="/teacher"
            element={protectedRolePage(<TeacherDashboardPage />, ['teacher', 'admin'])}
          />
          <Route
            path="/teacher/classes"
            element={protectedRolePage(<TeacherClassesPage />, ['teacher', 'admin'])}
          />
          <Route
            path="/teacher/classes/:id"
            element={protectedRolePage(<TeacherClassDetailPage />, ['teacher', 'admin'])}
          />
          <Route
            path="/teacher/teaching-assignments"
            element={protectedRolePage(<TeacherTeachingAssignmentsPage />, [
              'teacher',
              'admin',
            ])}
          />
          <Route
            path="/teacher/timetable"
            element={protectedRolePage(<TeacherTimetablePage />, [
              'teacher',
              'admin',
            ])}
          />
          <Route
            path="/teacher/academic-calendar"
            element={protectedRolePage(<TeacherAcademicCalendarPage />, [
              'teacher',
              'admin',
            ])}
          />
          <Route
            path="/teacher/assessment-configurations"
            element={protectedRolePage(
              <TeacherAssessmentConfigurationsPage />,
              ['teacher', 'admin'],
            )}
          />
          <Route
            path="/teacher/attendance"
            element={protectedRolePage(<TeacherAttendancePage />, [
              'teacher',
              'admin',
            ])}
          />
          <Route
            path="/teacher/assignments"
            element={protectedRolePage(<TeacherAssignmentsPage />, [
              'teacher',
              'admin',
            ])}
          />
          <Route
            path="/teacher/gradebook"
            element={protectedRolePage(<TeacherGradebookPage />, [
              'teacher',
              'admin',
            ])}
          />
          <Route
            path="/teacher/report-cards"
            element={protectedRolePage(<TeacherReportCardsPage />, [
              'teacher',
              'admin',
            ])}
          />
          <Route
            path="/teacher/conduct"
            element={protectedRolePage(<TeacherConductPage />, [
              'teacher',
              'admin',
            ])}
          />
          <Route
            path="/teacher/student-requests"
            element={protectedRolePage(<TeacherStudentRequestsPage />, [
              'teacher',
              'admin',
            ])}
          />
          <Route
            path="/teacher/profile"
            element={protectedRolePage(<TeacherProfilePage />, ['teacher', 'admin'])}
          />
          <Route
            path="/student"
            element={protectedRolePage(<StudentDashboardPage />, ['student', 'admin'])}
          />
          <Route
            path="/student/classes"
            element={protectedRolePage(<StudentClassesPage />, ['student', 'admin'])}
          />
          <Route
            path="/student/enrollments"
            element={protectedRolePage(<StudentEnrollmentHistoryPage />, [
              'student',
              'admin',
            ])}
          />
          <Route
            path="/student/timetable"
            element={protectedRolePage(<StudentTimetablePage />, [
              'student',
              'admin',
            ])}
          />
          <Route
            path="/student/academic-calendar"
            element={protectedRolePage(<StudentAcademicCalendarPage />, [
              'student',
              'admin',
            ])}
          />
          <Route
            path="/student/attendance"
            element={protectedRolePage(<StudentAttendancePage />, [
              'student',
              'admin',
            ])}
          />
          <Route
            path="/student/assignments"
            element={protectedRolePage(<StudentAssignmentsPage />, [
              'student',
              'admin',
            ])}
          />
          <Route
            path="/student/grades"
            element={protectedRolePage(<StudentGradesPage />, [
              'student',
              'admin',
            ])}
          />
          <Route
            path="/student/requests"
            element={protectedRolePage(<StudentRequestsPage />, [
              'student',
              'admin',
            ])}
          />
          <Route
            path="/student/classes/:id"
            element={protectedRolePage(<StudentClassDetailPage />, ['student', 'admin'])}
          />
          <Route
            path="/student/profile"
            element={protectedRolePage(<StudentProfilePage />, ['student', 'admin'])}
          />
          <Route
            path="/parent"
            element={protectedRolePage(<ParentDashboardPage />, [
              'guardian',
            ])}
          />
          <Route
            path="/parent/students/:id"
            element={protectedRolePage(<ParentStudentPage />, [
              'guardian',
            ])}
          />
          <Route
            path="/parent/academic-calendar"
            element={protectedRolePage(<ParentAcademicCalendarPage />, [
              'guardian',
            ])}
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
