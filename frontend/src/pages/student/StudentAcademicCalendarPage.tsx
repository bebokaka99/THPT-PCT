import { AcademicCalendarWorkspace } from '../../components/academic/AcademicCalendarWorkspace';
import { StudentPortalLayout } from '../../components/layout/StudentPortalLayout';

export function StudentAcademicCalendarPage() {
  return <StudentPortalLayout><AcademicCalendarWorkspace role="student" /></StudentPortalLayout>;
}
