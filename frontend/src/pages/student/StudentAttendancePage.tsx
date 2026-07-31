import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, CheckCircle2, Clock3, UserX } from 'lucide-react';
import { StudentPortalLayout } from '../../components/layout/StudentPortalLayout';
import {
  attendanceStatusLabels,
  getMyAttendance,
} from '../../services/attendance.service';
import { useAuth } from '../../stores/auth-context';
import type { AttendanceStatus } from '../../types/attendance';

const statusStyles: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-50 text-emerald-700',
  excused: 'bg-blue-50 text-blue-700',
  unexcused: 'bg-red-50 text-red-700',
  late: 'bg-amber-50 text-amber-700',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN').format(
    new Date(`${value}T00:00:00`),
  );
}

export function StudentAttendancePage() {
  const { accessToken, user } = useAuth();
  const attendance = useQuery({
    queryKey: ['student', 'attendance', user?.id],
    queryFn: () => getMyAttendance(accessToken!),
    enabled: Boolean(accessToken),
  });
  const summary = attendance.data?.summary;
  const cards = [
    {
      label: 'Tỷ lệ chuyên cần',
      value: `${summary?.attendance_rate ?? 0}%`,
      icon: CalendarCheck,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Có mặt',
      value: summary?.present ?? 0,
      icon: CheckCircle2,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Đi trễ',
      value: summary?.late ?? 0,
      icon: Clock3,
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Vắng',
      value: (summary?.excused ?? 0) + (summary?.unexcused ?? 0),
      icon: UserX,
      tone: 'bg-red-50 text-red-700',
    },
  ];

  return (
    <StudentPortalLayout>
      <header className="border-b border-slate-200 pb-6">
        <p className="text-sm font-semibold text-blue-700">Hồ sơ học vụ</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
          Chuyên cần của em
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Theo dõi các buổi có mặt, vắng có phép, vắng không phép và đi trễ.
          Dữ liệu này chỉ hiển thị cho chính tài khoản của em.
        </p>
      </header>

      {attendance.isLoading ? (
        <div className="mt-6 h-40 animate-pulse border border-slate-200 bg-white" />
      ) : attendance.isError ? (
        <p className="mt-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Không thể tải dữ liệu chuyên cần.
        </p>
      ) : (
        <>
          <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cards.map(({ icon: Icon, label, tone, value }) => (
              <article
                key={label}
                className="border border-slate-200 bg-white p-4 shadow-sm"
              >
                <span
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-md ${tone}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <p className="mt-3 text-2xl font-bold text-slate-950">
                  {value}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {label}
                </p>
              </article>
            ))}
          </section>

          {(attendance.data?.data.length ?? 0) === 0 ? (
            <div className="mt-6 border border-dashed border-slate-300 bg-white p-10 text-center">
              <CalendarCheck className="mx-auto h-8 w-8 text-slate-400" />
              <h2 className="mt-3 font-bold text-slate-900">
                Chưa có dữ liệu chuyên cần
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Các phiên điểm danh đã lưu sẽ xuất hiện tại đây.
              </p>
            </div>
          ) : (
            <section className="mt-6 overflow-hidden border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-4">
                <h2 className="font-bold text-slate-950">Lịch sử điểm danh</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {attendance.data?.data.map((record) => (
                  <article
                    key={record.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <h3 className="font-semibold text-slate-950">
                        {record.subject_name || 'Sinh hoạt lớp'} ·{' '}
                        {record.classroom_name}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(record.session_date)} · Tiết{' '}
                        {record.lesson_index} · {record.semester_name}
                      </p>
                      {record.note && (
                        <p className="mt-2 text-sm text-slate-600">
                          {record.note}
                        </p>
                      )}
                    </div>
                    <span
                      className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyles[record.status]}`}
                    >
                      {attendanceStatusLabels[record.status]}
                    </span>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </StudentPortalLayout>
  );
}

