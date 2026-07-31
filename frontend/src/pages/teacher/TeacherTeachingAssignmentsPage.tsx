import { useQuery } from '@tanstack/react-query';
import { BookOpenCheck, School, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TeacherPortalLayout } from '../../components/layout/TeacherPortalLayout';
import { getMyTeachingAssignments } from '../../services/teachingAssignment.service';
import { useAuth } from '../../stores/auth-context';

export function TeacherTeachingAssignmentsPage() {
  const { accessToken, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const query = params.get('q')?.trim() ?? '';
  const [search, setSearch] = useState(query);
  const assignments = useQuery({
    queryKey: ['teacher', 'teaching-assignments', user?.id, query],
    queryFn: () =>
      getMyTeachingAssignments(accessToken!, {
        page: 1,
        limit: 100,
        q: query || undefined,
      }),
    enabled: Boolean(accessToken),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = search.trim();
    setParams(value ? { q: value } : {});
  }

  const rows = assignments.data?.data ?? [];

  return (
    <TeacherPortalLayout>
      <header className="border-b border-slate-200 pb-6">
        <p className="text-sm font-semibold text-emerald-700">
          Phân công chuyên môn
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
          Lớp giảng dạy
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Danh sách môn, lớp và học kỳ được nhà trường phân công cho tài khoản
          của thầy/cô. Danh sách này độc lập với lớp chủ nhiệm.
        </p>
      </header>

      <form
        onSubmit={submit}
        className="mt-6 flex max-w-xl gap-2 border border-slate-200 bg-white p-2 shadow-sm"
      >
        <label className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo lớp, môn hoặc học kỳ"
            className="w-full rounded-md border-0 py-2 pl-9 pr-3 text-sm outline-none"
          />
        </label>
        <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Tìm
        </button>
      </form>

      {assignments.isLoading ? (
        <div className="mt-6 h-36 animate-pulse border border-slate-200 bg-white" />
      ) : assignments.isError ? (
        <p className="mt-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Không thể tải phân công giảng dạy.
        </p>
      ) : rows.length === 0 ? (
        <div className="mt-6 border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <BookOpenCheck className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 font-bold text-slate-900">
            Chưa có phân công giảng dạy
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Vui lòng liên hệ quản trị viên hoặc tổ chuyên môn.
          </p>
        </div>
      ) : (
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {rows.map((item) => (
            <article
              key={item.id}
              className="border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                  <School className="h-5 w-5" />
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    item.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {item.status === 'active' ? 'Đang hiệu lực' : 'Đã kết thúc'}
                </span>
              </div>
              <h2 className="mt-4 text-xl font-bold text-slate-950">
                {item.subject_name}
              </h2>
              <p className="mt-1 text-sm font-semibold text-emerald-700">
                {item.classroom_name} · {item.semester_name}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
                <div>
                  <dt className="text-slate-500">Năm học</dt>
                  <dd className="mt-1 font-semibold">
                    {item.academic_year_name}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Vai trò</dt>
                  <dd className="mt-1 font-semibold">
                    {item.role === 'primary'
                      ? 'Giáo viên chính'
                      : 'Phối hợp giảng dạy'}
                  </dd>
                </div>
              </dl>
              {item.note && (
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  {item.note}
                </p>
              )}
            </article>
          ))}
        </section>
      )}
    </TeacherPortalLayout>
  );
}
