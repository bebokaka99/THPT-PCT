import { ConductManagementPanel } from '../../components/academic/ConductManagementPanel';
import { AdminLayout } from '../../components/layout/AdminLayout';

export function AdminConductPage() {
  return (
    <AdminLayout>
      <div className="grid gap-6">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold text-blue-700">Học vụ</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            Duyệt kết quả rèn luyện
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Kiểm tra nhận xét chủ nhiệm, duyệt hoặc khóa kết quả theo học kỳ.
          </p>
        </header>
        <ConductManagementPanel allowReview />
      </div>
    </AdminLayout>
  );
}
