import { TranscriptLookupPanel } from '../../components/academic/TranscriptLookupPanel';
import { TeacherPortalLayout } from '../../components/layout/TeacherPortalLayout';

export function TeacherReportCardsPage() {
  return (
    <TeacherPortalLayout>
      <div className="grid gap-6">
        <header className="no-print border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold text-emerald-700">Học vụ</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Phiếu kết quả học tập</h1>
          <p className="mt-2 text-sm text-slate-600">
            Giáo viên chủ nhiệm xem toàn lớp; giáo viên bộ môn chỉ thấy môn được phân công.
          </p>
        </header>
        <TranscriptLookupPanel />
      </div>
    </TeacherPortalLayout>
  );
}
