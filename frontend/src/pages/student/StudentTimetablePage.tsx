import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { TimetablePrintView } from '../../components/classrooms/TimetablePrintView';
import { StudentPortalLayout } from '../../components/layout/StudentPortalLayout';
import { getClassrooms, getClassroomTimetable } from '../../services/classroom.service';
import { useAuth } from '../../stores/auth-context';

export function StudentTimetablePage() {
  const { accessToken, user } = useAuth();
  const timetable = useQuery({
    queryKey: ['student', 'personal-timetable', user?.id],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      const classrooms = await getClassrooms(accessToken!, { page: 1, limit: 20, is_active: true });
      const classroom = classrooms.data[0] ?? null;
      if (!classroom) return { classroom: null, timetable: null };
      const response = await getClassroomTimetable(accessToken!, classroom.id);
      return { classroom, timetable: response.data };
    },
  });

  return (
    <StudentPortalLayout>
      <header className="border-b border-slate-200 pb-6">
        <p className="text-sm font-semibold text-blue-700">Lịch học trong tuần</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Thời khóa biểu</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Theo dõi môn học, giáo viên phụ trách, tiết học và phòng học của lớp hiện tại.
        </p>
      </header>

      {timetable.isLoading ? (
        <div className="mt-6 h-72 animate-pulse border border-slate-200 bg-white" />
      ) : timetable.isError ? (
        <p className="mt-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700">Không thể tải thời khóa biểu.</p>
      ) : !timetable.data?.classroom ? (
        <section className="mt-6 border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <CalendarDays className="mx-auto h-9 w-9 text-slate-400" />
          <h2 className="mt-3 font-bold text-slate-950">Chưa được xếp lớp</h2>
          <p className="mt-2 text-sm text-slate-500">Vui lòng liên hệ giáo viên chủ nhiệm hoặc quản trị viên.</p>
        </section>
      ) : !timetable.data.timetable ? (
        <section className="mt-6 border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <CalendarDays className="mx-auto h-9 w-9 text-slate-400" />
          <h2 className="mt-3 font-bold text-slate-950">Chưa có thời khóa biểu</h2>
          <p className="mt-2 text-sm text-slate-500">Thời khóa biểu của lớp đang được nhà trường cập nhật.</p>
        </section>
      ) : (
        <div className="mt-6">
          <TimetablePrintView classroom={timetable.data.classroom} timetable={timetable.data.timetable} />
        </div>
      )}
    </StudentPortalLayout>
  );
}
