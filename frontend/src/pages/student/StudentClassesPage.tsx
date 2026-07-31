import { useQuery } from '@tanstack/react-query';
import { ArrowRight, School, Search, UsersRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { StudentPortalLayout } from '../../components/layout/StudentPortalLayout';
import { getClassrooms } from '../../services/classroom.service';
import { useAuth } from '../../stores/auth-context';

export function StudentClassesPage() {
  const { accessToken, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';
  const [searchValue, setSearchValue] = useState(query);
  const classroomsQuery = useQuery({
    queryKey: ['student', 'classrooms', user?.id, query],
    queryFn: () => getClassrooms(accessToken!, { page: 1, limit: 50, q: query }),
    enabled: Boolean(accessToken),
  });

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = searchValue.trim();
    setSearchParams(nextQuery ? { q: nextQuery } : {});
  }

  const classrooms = classroomsQuery.data?.data ?? [];

  return (
    <StudentPortalLayout>
      <header className="border-b border-slate-200 pb-6">
        <p className="text-sm font-semibold text-blue-700">Không gian lớp học</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Lớp học của em</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Truy cập thông báo, tài liệu, thời khóa biểu và danh sách thành viên
          của các lớp đã được nhà trường phân công.
        </p>
      </header>

      <form
        onSubmit={handleSearch}
        className="mt-6 flex max-w-xl gap-2 border border-slate-200 bg-white p-2 shadow-sm"
      >
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Tìm theo tên lớp hoặc năm học"
            className="w-full rounded-md border-0 py-2 pl-9 pr-3 text-sm outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Tìm
        </button>
      </form>

      {classroomsQuery.isLoading && (
        <p className="mt-6 border border-slate-200 bg-white p-5 text-sm text-slate-500">
          Đang tải lớp học...
        </p>
      )}

      {classroomsQuery.isError && (
        <p className="mt-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Không thể tải danh sách lớp học.
        </p>
      )}

      {!classroomsQuery.isLoading && !classroomsQuery.isError && classrooms.length === 0 && (
        <div className="mt-6 border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <School className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 font-bold text-slate-900">
            {query ? 'Không tìm thấy lớp phù hợp' : 'Chưa có lớp học nào được gán'}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {query
              ? 'Hãy thử một tên lớp hoặc năm học khác.'
              : 'Vui lòng liên hệ giáo viên chủ nhiệm hoặc quản trị viên.'}
          </p>
        </div>
      )}

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {classrooms.map((classroom) => (
          <article
            key={classroom.id}
            className="group border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                <School className="h-5 w-5" aria-hidden="true" />
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  classroom.is_active
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {classroom.is_active ? 'Đang hoạt động' : 'Đã kết thúc'}
              </span>
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-950">{classroom.name}</h2>
            <p className="mt-1 text-sm text-slate-500">Năm học {classroom.school_year}</p>
            {classroom.description && (
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                {classroom.description}
              </p>
            )}
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                <UsersRound className="h-4 w-4" />
                {classroom.student_count ?? 0} học sinh
              </span>
              <Link
                to={`/student/classes/${classroom.id}`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800"
              >
                Vào lớp
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
            </div>
          </article>
        ))}
      </section>
    </StudentPortalLayout>
  );
}
