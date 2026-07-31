import { useQuery } from '@tanstack/react-query';
import { Printer, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ReportCardView } from '../../components/academic/ReportCardView';
import { StudentPortalLayout } from '../../components/layout/StudentPortalLayout';
import { getAcademicPeriods } from '../../services/academicPeriod.service';
import { getMyTranscript } from '../../services/transcript.service';
import { useAuth } from '../../stores/auth-context';

export function StudentGradesPage() {
  const { accessToken, user } = useAuth();
  const [semesterId, setSemesterId] = useState('');
  const periods = useQuery({
    queryKey: ['student', 'grade-periods'],
    queryFn: () => getAcademicPeriods(accessToken!),
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

  return (
    <StudentPortalLayout>
      <div className="grid gap-6">
        <header className="no-print flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-sm font-semibold text-blue-700">Kết quả học tập</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
              Bảng điểm và phiếu kết quả
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Chỉ hiển thị điểm đã được nhà trường duyệt.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={semesterId}
              onChange={(event) => setSemesterId(event.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Học kỳ gần nhất có kết quả</option>
              {semesters.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.year_name} - {item.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!transcript.data?.data}
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-md bg-blue-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              <Printer className="h-4 w-4" /> In / Lưu PDF
            </button>
          </div>
        </header>

        {transcript.isLoading ? (
          <p className="border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Đang lập phiếu kết quả...
          </p>
        ) : transcript.isError ? (
          <section className="border border-slate-200 bg-white p-8 text-center shadow-sm">
            <ShieldCheck className="mx-auto h-10 w-10 text-blue-200" />
            <h2 className="mt-3 font-bold text-slate-950">Chưa có kết quả được công bố</h2>
            <p className="mt-2 text-sm text-slate-600">
              Điểm nháp và điểm đang chờ duyệt không xuất hiện tại đây.
            </p>
          </section>
        ) : transcript.data?.data ? (
          <section className="border border-slate-200 bg-white shadow-sm">
            <ReportCardView transcript={transcript.data.data} />
          </section>
        ) : null}
      </div>
    </StudentPortalLayout>
  );
}
