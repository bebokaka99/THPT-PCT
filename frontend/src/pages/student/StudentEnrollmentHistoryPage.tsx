import { useQuery } from '@tanstack/react-query';
import { History, School } from 'lucide-react';
import { StudentPortalLayout } from '../../components/layout/StudentPortalLayout';
import { getMyEnrollments } from '../../services/enrollment.service';
import { useAuth } from '../../stores/auth-context';
import type { EnrollmentStatus } from '../../types/enrollment';

const statusLabels: Record<EnrollmentStatus, string> = {
  active: 'Đang học',
  transferred: 'Đã chuyển lớp',
  reserved: 'Bảo lưu',
  withdrawn: 'Đã thôi học',
  graduated: 'Đã tốt nghiệp',
};

function formatDate(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN').format(
    new Date(`${value}T00:00:00`),
  );
}

export function StudentEnrollmentHistoryPage() {
  const { accessToken, user } = useAuth();
  const history = useQuery({
    queryKey: ['student', 'enrollment-history', user?.id],
    queryFn: () => getMyEnrollments(accessToken!),
    enabled: Boolean(accessToken),
  });

  return (
    <StudentPortalLayout>
      <header className="border-b border-slate-200 pb-6">
        <p className="text-sm font-semibold text-blue-700">Hồ sơ học vụ</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
          Lịch sử lớp học
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Theo dõi lớp học và trạng thái enrollment của em qua từng năm học.
        </p>
      </header>

      {history.isLoading && (
        <div className="mt-6 h-40 animate-pulse border border-slate-200 bg-white" />
      )}
      {history.isError && (
        <p className="mt-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Không thể tải lịch sử lớp học.
        </p>
      )}
      {!history.isLoading &&
        !history.isError &&
        history.data?.data.length === 0 && (
          <div className="mt-6 border border-dashed border-slate-300 bg-white p-10 text-center">
            <History className="mx-auto h-8 w-8 text-slate-400" />
            <h2 className="mt-3 font-bold text-slate-900">
              Chưa có lịch sử lớp học
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Vui lòng liên hệ quản trị viên nếu em đã được xếp lớp.
            </p>
          </div>
        )}

      <div className="mt-6 grid gap-4">
        {history.data?.data.map((item) => (
          <article
            key={item.id}
            className="border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                  <School className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-bold text-slate-950">
                    {item.classroom_name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Năm học {item.academic_year_name}
                  </p>
                </div>
              </div>
              <span
                className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                  item.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {statusLabels[item.status]}
              </span>
            </div>
            <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 text-sm text-slate-600 sm:grid-cols-2">
              <p>Ngày vào lớp: {formatDate(item.enrolled_at)}</p>
              <p>
                Ngày kết thúc:{' '}
                {item.ended_at ? formatDate(item.ended_at) : 'Chưa kết thúc'}
              </p>
            </div>
            {item.note && (
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {item.note}
              </p>
            )}
          </article>
        ))}
      </div>
    </StudentPortalLayout>
  );
}
