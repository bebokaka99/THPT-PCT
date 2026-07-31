import { ConductManagementPanel } from '../../components/academic/ConductManagementPanel';
import { TeacherPortalLayout } from '../../components/layout/TeacherPortalLayout';

export function TeacherConductPage() {
  return (
    <TeacherPortalLayout>
      <div className="grid gap-6">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold text-emerald-700">Công tác chủ nhiệm</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            Hạnh kiểm và nhận xét học kỳ
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Nhập kết quả rèn luyện cho học sinh lớp chủ nhiệm và gửi nhà trường duyệt.
          </p>
        </header>
        <ConductManagementPanel />
      </div>
    </TeacherPortalLayout>
  );
}
