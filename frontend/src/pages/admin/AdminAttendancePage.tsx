import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, Search, Users } from 'lucide-react';
import { useState } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import {
  attendanceStatusLabels,
  getAttendanceSessions,
  getClassroomAttendanceSummary,
} from '../../services/attendance.service';
import { getAcademicPeriods } from '../../services/academicPeriod.service';
import { getClassrooms } from '../../services/classroom.service';
import { useAuth } from '../../stores/auth-context';

export function AdminAttendancePage() {
  const { accessToken } = useAuth();
  const [classroomId, setClassroomId] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const classrooms = useQuery({
    queryKey: ['admin', 'attendance-classrooms'],
    queryFn: () =>
      getClassrooms(accessToken!, { page: 1, limit: 100, is_active: true }),
    enabled: Boolean(accessToken),
  });
  const periods = useQuery({
    queryKey: ['academic-periods'],
    queryFn: () => getAcademicPeriods(accessToken!),
    enabled: Boolean(accessToken),
  });
  const sessions = useQuery({
    queryKey: ['admin', 'attendance-sessions', classroomId, semesterId],
    queryFn: () =>
      getAttendanceSessions(accessToken!, {
        page: 1,
        limit: 100,
        classroom_id: classroomId ? Number(classroomId) : undefined,
        semester_id: semesterId ? Number(semesterId) : undefined,
      }),
    enabled: Boolean(accessToken),
  });
  const summary = useQuery({
    queryKey: ['admin', 'attendance-summary', classroomId, semesterId],
    queryFn: () =>
      getClassroomAttendanceSummary(
        accessToken!,
        Number(classroomId),
        semesterId ? Number(semesterId) : undefined,
      ),
    enabled: Boolean(accessToken && classroomId),
  });
  const semesters = periods.data?.flatMap((year) =>
    year.semesters.map((semester) => ({
      ...semester,
      academic_year_name: year.name,
    })),
  );

  return (
    <AdminLayout>
      <div className="grid min-w-0 gap-6">
        <header className="border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-cyan-700">
              <CalendarCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-cyan-700">
                Quản lý học vụ
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">
                Tổng hợp chuyên cần
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Theo dõi phiên điểm danh và tỷ lệ chuyên cần theo lớp, học kỳ.
              </p>
            </div>
          </div>
        </header>

        <section className="border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Lớp học
              <select
                value={classroomId}
                onChange={(event) => setClassroomId(event.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal"
              >
                <option value="">Tất cả lớp</option>
                {classrooms.data?.data.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.name} · {classroom.school_year}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Học kỳ
              <select
                value={semesterId}
                onChange={(event) => setSemesterId(event.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal"
              >
                <option value="">Tất cả học kỳ</option>
                {semesters?.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.academic_year_name} · {semester.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {classroomId && (
          <section className="overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <h2 className="font-bold text-slate-950">
                Tổng hợp theo học sinh
              </h2>
            </div>
            {summary.isLoading ? (
              <div className="h-32 animate-pulse bg-slate-50" />
            ) : (summary.data?.length ?? 0) === 0 ? (
              <div className="p-10 text-center text-slate-500">
                <Users className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-3">Chưa có dữ liệu để tổng hợp.</p>
              </div>
            ) : (
              <div className="max-w-full overflow-x-auto">
                <table className="min-w-[900px] divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Học sinh</th>
                      <th className="px-4 py-3">Tổng</th>
                      <th className="px-4 py-3">Có mặt</th>
                      <th className="px-4 py-3">Có phép</th>
                      <th className="px-4 py-3">Không phép</th>
                      <th className="px-4 py-3">Đi trễ</th>
                      <th className="px-4 py-3">Tỷ lệ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.data?.map((row) => (
                      <tr key={row.student_user_id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-950">
                            {row.student_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {row.student_code || `ID ${row.student_user_id}`}
                          </p>
                        </td>
                        <td className="px-4 py-3">{row.total}</td>
                        <td className="px-4 py-3">{row.present}</td>
                        <td className="px-4 py-3">{row.excused}</td>
                        <td className="px-4 py-3">{row.unexcused}</td>
                        <td className="px-4 py-3">{row.late}</td>
                        <td className="px-4 py-3 font-bold text-cyan-700">
                          {row.attendance_rate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <section className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 p-4">
            <Search className="h-4 w-4 text-slate-400" />
            <h2 className="font-bold text-slate-950">Các phiên điểm danh</h2>
          </div>
          {sessions.isLoading ? (
            <div className="h-36 animate-pulse bg-slate-50" />
          ) : (sessions.data?.data.length ?? 0) === 0 ? (
            <p className="p-10 text-center text-sm text-slate-500">
              Chưa có phiên điểm danh phù hợp.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {sessions.data?.data.map((session) => (
                <article
                  key={session.id}
                  className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-slate-950">
                      {session.classroom_name} ·{' '}
                      {session.subject_name || 'Sinh hoạt lớp'}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {session.session_date} · Tiết {session.lesson_index} ·{' '}
                      {session.created_by_name || 'Quản trị viên'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    {(
                      [
                        'present',
                        'excused',
                        'unexcused',
                        'late',
                      ] as const
                    ).map((status) => (
                      <span
                        key={status}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600"
                      >
                        {attendanceStatusLabels[status]}:{' '}
                        {session[`${status}_count`]}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}

