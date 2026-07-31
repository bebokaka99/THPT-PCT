import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleSlash2, Printer, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ReportCardView } from '../../components/academic/ReportCardView';
import { StudentPortalLayout } from '../../components/layout/StudentPortalLayout';
import { getAcademicPeriods } from '../../services/academicPeriod.service';
import { getMyGrades } from '../../services/gradebook.service';
import { getMyTranscript } from '../../services/transcript.service';
import { useAuth } from '../../stores/auth-context';
import type { StudentPublishedGrade } from '../../types/gradebook';

function scoreValue(score: StudentPublishedGrade['scores'][number]) {
  if (score.state === 'absent') return 'Vắng';
  if (score.state === 'exempt') return 'Miễn';
  if (score.state === 'unscored' || score.score === null) return '—';
  return score.score.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

function ComponentScores({ grade }: { grade: StudentPublishedGrade }) {
  return (
    <div className="flex min-w-[340px] flex-wrap gap-2">
      {grade.scores.map((score) => (
        <div key={score.column_id} className="min-w-[86px] border border-slate-200 bg-slate-50 px-3 py-2 text-center">
          <p className="truncate text-[11px] font-semibold text-slate-500" title={score.label}>{score.label}</p>
          <p className={`mt-1 text-base font-bold ${score.state === 'scored' ? 'text-slate-950' : 'text-slate-400'}`}>
            {scoreValue(score)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function StudentGradesPage() {
  const { accessToken, user } = useAuth();
  const [semesterId, setSemesterId] = useState('');
  const periods = useQuery({
    queryKey: ['student', 'grade-periods'],
    queryFn: () => getAcademicPeriods(accessToken!),
    enabled: Boolean(accessToken),
  });
  const grades = useQuery({
    queryKey: ['student', 'published-grades', user?.id],
    queryFn: () => getMyGrades(accessToken!),
    enabled: Boolean(accessToken),
  });
  const semesters = useMemo(
    () => (periods.data ?? []).flatMap((year) =>
      year.semesters.map((semester) => ({ ...semester, year_name: year.name })),
    ),
    [periods.data],
  );
  const transcript = useQuery({
    queryKey: ['student', 'transcript', user?.id, semesterId],
    queryFn: () => getMyTranscript(accessToken!, semesterId ? Number(semesterId) : undefined),
    enabled: Boolean(accessToken),
  });
  const visibleGrades = (grades.data?.data ?? []).filter(
    (grade) => !semesterId || grade.semester_id === Number(semesterId),
  );

  return (
    <StudentPortalLayout>
      <div className="grid gap-6">
        <header className="no-print flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-sm font-semibold text-blue-700">Kết quả học tập</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Bảng điểm học kỳ</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Hiển thị đầy đủ các lần đánh giá thường xuyên, giữa kỳ, cuối kỳ và điểm tổng kết đã được duyệt.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={semesterId} onChange={(event) => setSemesterId(event.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">Học kỳ gần nhất có kết quả</option>
              {semesters.map((item) => <option key={item.id} value={item.id}>{item.year_name} - {item.name}</option>)}
            </select>
            <button type="button" disabled={!transcript.data?.data} onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md bg-blue-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              <Printer className="h-4 w-4" /> In / Lưu PDF
            </button>
          </div>
        </header>

        <section className="no-print border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-bold text-slate-950">Chi tiết điểm thành phần</h2>
              <p className="mt-1 text-sm text-slate-500">Số cột điểm thay đổi theo cấu hình đánh giá của từng môn.</p>
            </div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Chỉ hiển thị sổ điểm đã duyệt hoặc khóa</span>
          </div>

          {grades.isLoading ? (
            <div className="h-40 animate-pulse bg-slate-50" />
          ) : grades.isError ? (
            <p className="p-6 text-sm text-red-700">Không thể tải chi tiết bảng điểm.</p>
          ) : visibleGrades.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <CircleSlash2 className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">Chưa có sổ điểm được công bố trong học kỳ này.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr><th className="px-5 py-3">Môn học</th><th className="px-5 py-3">Điểm thành phần</th><th className="px-5 py-3 text-center">Tổng kết</th><th className="px-5 py-3">Giáo viên</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleGrades.map((grade) => (
                    <tr key={grade.id} className="align-top">
                      <td className="px-5 py-4"><p className="font-bold text-slate-950">{grade.subject_name}</p><p className="mt-1 text-xs text-slate-500">{grade.classroom_name} · {grade.semester_name}</p></td>
                      <td className="px-5 py-4"><ComponentScores grade={grade} /></td>
                      <td className="px-5 py-4 text-center"><span className="inline-flex h-12 min-w-14 items-center justify-center rounded-md bg-blue-50 px-3 text-xl font-bold text-blue-800">{grade.final_score ?? '—'}</span></td>
                      <td className="px-5 py-4 text-slate-600">{grade.teacher_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {transcript.isLoading ? (
          <p className="border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Đang lập phiếu kết quả...</p>
        ) : transcript.isError ? (
          <section className="border border-slate-200 bg-white p-8 text-center shadow-sm">
            <ShieldCheck className="mx-auto h-10 w-10 text-blue-200" />
            <h2 className="mt-3 font-bold text-slate-950">Chưa có kết quả được công bố</h2>
            <p className="mt-2 text-sm text-slate-600">Điểm nháp và điểm đang chờ duyệt không xuất hiện tại đây.</p>
          </section>
        ) : transcript.data?.data ? (
          <section className="border border-slate-200 bg-white shadow-sm"><ReportCardView transcript={transcript.data.data} /></section>
        ) : null}
      </div>
    </StudentPortalLayout>
  );
}
