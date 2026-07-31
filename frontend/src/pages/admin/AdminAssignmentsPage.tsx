import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Search, Users } from 'lucide-react';
import { useState } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getAssignments } from '../../services/assignment.service';
import { useAuth } from '../../stores/auth-context';
import type { AssignmentStatus } from '../../types/assignment';

function dateTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function AdminAssignmentsPage() {
  const { accessToken } = useAuth();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<AssignmentStatus | ''>('');
  const assignments = useQuery({
    queryKey: ['admin', 'assignments', q, status],
    queryFn: () =>
      getAssignments(accessToken!, {
        page: 1,
        limit: 100,
        q: q.trim() || undefined,
        status: status || undefined,
      }),
    enabled: Boolean(accessToken),
  });
  const submitted = assignments.data?.data.reduce(
    (total, item) => total + item.submission_count,
    0,
  );

  return (
    <AdminLayout>
      <div className="grid min-w-0 gap-6">
        <header className="border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-violet-50 text-violet-700">
              <ClipboardList className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-violet-700">
                Giám sát học tập
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">
                Bài tập toàn trường
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Theo dõi bài đã giao và tiến độ nộp theo lớp, môn, giáo viên.
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2">
          <article className="border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Tổng bài tập
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-950">
              {assignments.data?.meta.total ?? 0}
            </p>
          </article>
          <article className="border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Lượt nộp trong kết quả
            </p>
            <p className="mt-2 text-3xl font-bold text-violet-700">
              {submitted ?? 0}
            </p>
          </article>
        </section>

        <section className="border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Tìm tiêu đề, môn học..."
                className="w-full rounded-md border border-slate-300 py-2.5 pl-9 pr-3 text-sm"
              />
            </label>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as AssignmentStatus | '')
              }
              className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="draft">Bản nháp</option>
              <option value="published">Đang giao</option>
              <option value="closed">Đã đóng</option>
            </select>
          </div>
        </section>

        <section className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          {assignments.isLoading ? (
            <div className="h-40 animate-pulse bg-slate-50" />
          ) : assignments.isError ? (
            <p className="p-6 text-sm text-red-700">
              Không thể tải dữ liệu bài tập.
            </p>
          ) : (assignments.data?.data.length ?? 0) === 0 ? (
            <p className="p-10 text-center text-sm text-slate-500">
              Không có bài tập phù hợp.
            </p>
          ) : (
            <div className="max-w-full overflow-x-auto">
              <table className="min-w-[960px] divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Bài tập</th>
                    <th className="px-4 py-3">Lớp / môn</th>
                    <th className="px-4 py-3">Giáo viên</th>
                    <th className="px-4 py-3">Hạn nộp</th>
                    <th className="px-4 py-3">Tiến độ</th>
                    <th className="px-4 py-3">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments.data?.data.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-semibold text-slate-950">
                        {item.title}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.classroom_name} · {item.subject_name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.teacher_name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {dateTime(item.due_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-violet-700">
                          <Users className="h-4 w-4" />
                          {item.submission_count}/{item.student_count}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {item.status === 'draft'
                            ? 'Bản nháp'
                            : item.status === 'published'
                              ? 'Đang giao'
                              : 'Đã đóng'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
