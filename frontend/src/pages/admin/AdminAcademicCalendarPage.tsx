import { AcademicCalendarWorkspace } from '../../components/academic/AcademicCalendarWorkspace';
import { AdminLayout } from '../../components/layout/AdminLayout';

export function AdminAcademicCalendarPage() {
  return <AdminLayout><AcademicCalendarWorkspace role="admin" /></AdminLayout>;
}
