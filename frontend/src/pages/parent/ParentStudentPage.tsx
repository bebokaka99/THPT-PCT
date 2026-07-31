import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarCheck, Printer, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PublishedGradeExplorer } from '../../components/academic/PublishedGradeExplorer';
import { ReportCardView } from '../../components/academic/ReportCardView';
import { TimetablePrintView } from '../../components/classrooms/TimetablePrintView';
import { ParentPortalLayout } from '../../components/layout/ParentPortalLayout';
import { getGuardianStudentSummary } from '../../services/guardian.service';
import { getGuardianStudentGrades } from '../../services/gradebook.service';
import { useAuth } from '../../stores/auth-context';

const statusLabels = {
  present: 'Có mặt',
  excused: 'Vắng có phép',
  unexcused: 'Vắng không phép',
  late: 'Đi trễ',
} as const;

function queryId(value: string | null) {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : -1;
}

export function ParentStudentPage() {
  const { id } = useParams();
  const studentId = Number(id);
  const { accessToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const academicYearId = queryId(searchParams.get('academic_year_id'));
  const semesterId = queryId(searchParams.get('semester_id'));
  const subjectId = queryId(searchParams.get('subject_id'));
  const summary = useQuery({
    queryKey: ['guardian', 'student-summary', studentId, semesterId],
    queryFn: () => getGuardianStudentSummary(
      accessToken!,
      studentId,
      semesterId && semesterId > 0 ? semesterId : undefined,
    ),
    enabled: Boolean(accessToken && Number.isInteger(studentId) && studentId > 0),
    retry: false,
  });
  const grades = useQuery({
    queryKey: ['guardian', 'student-grades', studentId, academicYearId, semesterId, subjectId],
    queryFn: () => getGuardianStudentGrades(accessToken!, studentId, {
      academic_year_id: academicYearId,
      semester_id: semesterId,
      subject_id: subjectId,
    }),
    enabled: Boolean(accessToken && Number.isInteger(studentId) && studentId > 0),
    retry: false,
  });
  const options = grades.data?.filters;
  const semesters = useMemo(
    () => (options?.semesters ?? []).filter((item) => !academicYearId || item.academic_year_id === academicYearId),
    [academicYearId, options?.semesters],
  );
  const subjects = useMemo(() => {
    const available = (options?.subjects ?? []).filter(
      (item) => (!academicYearId || item.academic_year_id === academicYearId) && (!semesterId || item.semester_id === semesterId),
    );
    return [...new Map(available.map((item) => [item.id, item])).values()];
  }, [academicYearId, semesterId, options?.subjects]);

  function setFilter(name: 'academic_year_id' | 'semester_id' | 'subject_id', value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value); else next.delete(name);
    if (name === 'academic_year_id') {
      next.delete('semester_id');
      next.delete('subject_id');
    } else if (name === 'semester_id') {
      next.delete('subject_id');
      const option = options?.semesters.find((item) => item.id === Number(value));
      if (option) next.set('academic_year_id', String(option.academic_year_id));
    } else {
      const option = options?.subjects.find((item) => item.id === Number(value) && (!semesterId || item.semester_id === semesterId));
      if (option) {
        next.set('academic_year_id', String(option.academic_year_id));
        next.set('semester_id', String(option.semester_id));
      }
    }
    setSearchParams(next);
  }

  return (
    <ParentPortalLayout>
      <div className="grid gap-6">
        <header className="no-print flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <Link
              to="/parent"
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"
            >
              <ArrowLeft className="h-4 w-4" /> Danh sách học sinh
            </Link>
            <h1 className="mt-3 text-2xl font-bold text-slate-950 sm:text-3xl">
              {summary.data?.data.child.full_name || 'Thông tin học sinh'}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {summary.data?.data.child.classroom_name || 'Chưa xếp lớp'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!summary.data?.data.transcript || Boolean(subjectId)}
            className="inline-flex items-center gap-2 rounded-md bg-blue-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            <Printer className="h-4 w-4" /> In phiếu kết quả
          </button>
        </header>

        {summary.isLoading ? (
          <p className="border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Đang tải dữ liệu học sinh...
          </p>
        ) : summary.isError ? (
          <div className="border border-red-200 bg-red-50 p-8 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-red-300" />
            <h2 className="mt-3 font-bold text-red-900">
              Không có quyền xem học sinh này
            </h2>
            <p className="mt-2 text-sm text-red-700">
              Liên kết chưa được xác minh hoặc đã bị thu hồi.
            </p>
          </div>
        ) : summary.data?.data ? (
          <>
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ['Tổng buổi', summary.data.data.attendance.summary.total],
                ['Có mặt', summary.data.data.attendance.summary.present],
                ['Có phép', summary.data.data.attendance.summary.excused],
                ['Không phép', summary.data.data.attendance.summary.unexcused],
                ['Đi trễ', summary.data.data.attendance.summary.late],
              ].map(([label, value]) => (
                <div key={label} className="border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    {label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
                </div>
              ))}
            </section>

            <section className="no-print border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5">
                <h2 className="font-bold text-slate-950">Điểm thành phần theo môn</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Chỉ hiển thị sổ điểm đã được nhà trường duyệt hoặc khóa.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <select value={academicYearId && academicYearId > 0 ? academicYearId : ''} onChange={(event) => setFilter('academic_year_id', event.target.value)} aria-label="Năm học" className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm">
                    <option value="">Tất cả năm học</option>
                    {(options?.academic_years ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <select value={semesterId && semesterId > 0 ? semesterId : ''} onChange={(event) => setFilter('semester_id', event.target.value)} aria-label="Học kỳ" className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm">
                    <option value="">Tất cả học kỳ</option>
                    {semesters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <select value={subjectId && subjectId > 0 ? subjectId : ''} onChange={(event) => setFilter('subject_id', event.target.value)} aria-label="Môn học" className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm">
                    <option value="">Tổng quan tất cả môn</option>
                    {subjects.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
                  </select>
                </div>
              </div>
              <PublishedGradeExplorer grades={grades.data?.data ?? []} isLoading={grades.isLoading} isError={grades.isError} />
            </section>

            {!subjectId && <section className="border border-slate-200 bg-white shadow-sm">
              {summary.data.data.transcript ? (
                <ReportCardView transcript={summary.data.data.transcript} />
              ) : (
                <div className="p-8 text-center">
                  <h2 className="font-bold text-slate-950">
                    Chưa có phiếu kết quả được công bố
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Điểm nháp và kết quả chưa duyệt không hiển thị tại đây.
                  </p>
                </div>
              )}
            </section>}

            {summary.data.data.timetable && summary.data.data.child.classroom_name && (
              <TimetablePrintView
                classroom={{ name: summary.data.data.child.classroom_name }}
                timetable={summary.data.data.timetable}
              />
            )}

            <section className="border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-blue-700" />
                <h2 className="font-bold text-slate-950">Chuyên cần gần đây</h2>
              </div>
              {summary.data.data.attendance.data.length ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Ngày</th>
                        <th className="px-3 py-3">Môn</th>
                        <th className="px-3 py-3">Tiết</th>
                        <th className="px-3 py-3">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summary.data.data.attendance.data.slice(0, 20).map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-3">{item.session_date}</td>
                          <td className="px-3 py-3">
                            {item.subject_name || 'Sinh hoạt lớp'}
                          </td>
                          <td className="px-3 py-3">{item.lesson_index}</td>
                          <td className="px-3 py-3 font-semibold text-slate-700">
                            {statusLabels[item.status]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  Chưa có dữ liệu chuyên cần.
                </p>
              )}
            </section>
          </>
        ) : null}
      </div>
    </ParentPortalLayout>
  );
}
