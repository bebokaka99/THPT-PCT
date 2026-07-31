import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, FilterX, Printer, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PublishedGradeExplorer } from '../../components/academic/PublishedGradeExplorer';
import { ReportCardView } from '../../components/academic/ReportCardView';
import { StudentPortalLayout } from '../../components/layout/StudentPortalLayout';
import { getMyGrades } from '../../services/gradebook.service';
import { getMyTranscript } from '../../services/transcript.service';
import { useAuth } from '../../stores/auth-context';

function queryId(value: string | null) {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : -1;
}

export function StudentGradesPage() {
  const { accessToken, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const academicYearId = queryId(searchParams.get('academic_year_id'));
  const semesterId = queryId(searchParams.get('semester_id'));
  const subjectId = queryId(searchParams.get('subject_id'));
  const gradeQuery = { academic_year_id: academicYearId, semester_id: semesterId, subject_id: subjectId };

  const grades = useQuery({
    queryKey: ['student', 'published-grades', user?.id, gradeQuery],
    queryFn: () => getMyGrades(accessToken!, gradeQuery),
    enabled: Boolean(accessToken),
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

  const transcript = useQuery({
    queryKey: ['student', 'transcript', user?.id, semesterId],
    queryFn: () => getMyTranscript(accessToken!, semesterId && semesterId > 0 ? semesterId : undefined),
    enabled: Boolean(accessToken && !subjectId),
    retry: false,
  });

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

  const selectedSubject = options?.subjects.find(
    (item) => item.id === subjectId && (!semesterId || item.semester_id === semesterId),
  );
  const visibleGrades = grades.data?.data ?? [];

  return (
    <StudentPortalLayout>
      <div className="grid gap-6">
        <header className="no-print flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-sm font-semibold text-blue-700">Kết quả học tập</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
              {selectedSubject ? `Điểm môn ${selectedSubject.name}` : 'Bảng điểm học kỳ'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Xem từng môn hoặc tổng quan tất cả môn với đầy đủ số lần đánh giá thường xuyên theo cấu hình thực tế.
            </p>
          </div>
          <button
            type="button"
            disabled={!transcript.data?.data || Boolean(subjectId)}
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-md bg-blue-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            <Printer className="h-4 w-4" /> In / Lưu PDF
          </button>
        </header>

        <section className="no-print border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Năm học
              <select value={academicYearId && academicYearId > 0 ? academicYearId : ''} onChange={(event) => setFilter('academic_year_id', event.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal">
                <option value="">Tất cả năm học</option>
                {(options?.academic_years ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Học kỳ
              <select value={semesterId && semesterId > 0 ? semesterId : ''} onChange={(event) => setFilter('semester_id', event.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal">
                <option value="">Tất cả học kỳ</option>
                {semesters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Môn học
              <select value={subjectId && subjectId > 0 ? subjectId : ''} onChange={(event) => setFilter('subject_id', event.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal">
                <option value="">Tổng quan tất cả môn</option>
                {subjects.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
              </select>
            </label>
          </div>
          {(academicYearId || semesterId || subjectId) && (
            <button type="button" onClick={() => setSearchParams({})} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900">
              <FilterX className="h-4 w-4" /> Xóa bộ lọc
            </button>
          )}
        </section>

        <section className="border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-bold text-slate-950">{selectedSubject ? `Chi tiết ${selectedSubject.name}` : 'Chi tiết điểm thành phần'}</h2>
              <p className="mt-1 text-sm text-slate-500">Mọi cột TX, giữa kỳ và cuối kỳ được lấy động từ sổ điểm.</p>
            </div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Chỉ sổ điểm đã duyệt hoặc khóa</span>
          </div>
          <PublishedGradeExplorer grades={visibleGrades} isLoading={grades.isLoading} isError={grades.isError} />
        </section>

        {!subjectId && (transcript.isLoading ? (
          <p className="border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Đang lập phiếu kết quả...</p>
        ) : transcript.isError ? (
          <section className="border border-slate-200 bg-white p-8 text-center shadow-sm">
            <ShieldCheck className="mx-auto h-10 w-10 text-blue-200" />
            <h2 className="mt-3 font-bold text-slate-950">Chưa có kết quả được công bố</h2>
            <p className="mt-2 text-sm text-slate-600">Điểm nháp và điểm đang chờ duyệt không xuất hiện tại đây.</p>
          </section>
        ) : transcript.data?.data ? (
          <section className="border border-slate-200 bg-white shadow-sm"><ReportCardView transcript={transcript.data.data} /></section>
        ) : null)}
      </div>
    </StudentPortalLayout>
  );
}
