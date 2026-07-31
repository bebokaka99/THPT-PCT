import { StudentRequestReviewPanel } from '../../components/academic/StudentRequestReviewPanel';
import { TeacherPortalLayout } from '../../components/layout/TeacherPortalLayout';

export function TeacherStudentRequestsPage() {
  return (
    <TeacherPortalLayout>
      <div className="grid gap-6">
        <header>
          <p className="text-sm font-semibold text-emerald-700">
            Công tác chủ nhiệm
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            Đơn học sinh cần xử lý
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Chỉ hiển thị đơn thuộc lớp đang chủ nhiệm và loại đơn giao cho giáo
            viên chủ nhiệm.
          </p>
        </header>
        <StudentRequestReviewPanel />
      </div>
    </TeacherPortalLayout>
  );
}
