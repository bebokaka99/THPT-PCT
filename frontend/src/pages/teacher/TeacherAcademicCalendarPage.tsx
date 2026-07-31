import { AcademicCalendarWorkspace } from '../../components/academic/AcademicCalendarWorkspace';
import { TeacherPortalLayout } from '../../components/layout/TeacherPortalLayout';

export function TeacherAcademicCalendarPage() {
  return <TeacherPortalLayout><AcademicCalendarWorkspace role="teacher" /></TeacherPortalLayout>;
}
