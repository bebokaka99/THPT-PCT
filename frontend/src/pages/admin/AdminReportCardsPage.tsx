import { TranscriptLookupPanel } from '../../components/academic/TranscriptLookupPanel';
import { AdminLayout } from '../../components/layout/AdminLayout';

export function AdminReportCardsPage() {
  return (
    <AdminLayout>
      <div className="grid gap-6">
        <header className="no-print border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold text-cyan-700">Học vụ</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Phiếu điểm học sinh</h1>
          <p className="mt-2 text-sm text-slate-600">
            Tra cứu, chốt snapshot và in phiếu kết quả theo lớp, học kỳ.
          </p>
        </header>
        <TranscriptLookupPanel allowSnapshot />
      </div>
    </AdminLayout>
  );
}
