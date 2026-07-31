import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpenCheck, CheckCircle2, Download, History, LockKeyhole, XCircle } from 'lucide-react';
import { useState } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import * as gradebookApi from '../../services/gradebook.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type { GradebookStatus } from '../../types/gradebook';

const labels: Record<GradebookStatus, string> = {
  draft: 'Bản nháp',
  submitted: 'Chờ duyệt',
  approved: 'Đã duyệt',
  locked: 'Đã khóa',
};

export function AdminGradebooksPage() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState<GradebookStatus | ''>('');
  const [auditId, setAuditId] = useState<number | null>(null);
  const gradebooks = useQuery({
    queryKey: ['admin', 'gradebooks', status],
    queryFn: () => gradebookApi.getGradebooks(accessToken!, { limit: 100, status: status || undefined }),
    enabled: Boolean(accessToken),
  });
  const requests = useQuery({
    queryKey: ['admin', 'gradebook-change-requests'],
    queryFn: () => gradebookApi.getGradebookChangeRequests(accessToken!),
    enabled: Boolean(accessToken),
  });
  const audit = useQuery({
    queryKey: ['admin', 'gradebook-workflow-audit', auditId],
    queryFn: () => gradebookApi.getGradebookWorkflowAudit(accessToken!, auditId!),
    enabled: Boolean(accessToken && auditId),
  });

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['admin', 'gradebooks'] }),
    queryClient.invalidateQueries({ queryKey: ['admin', 'gradebook-change-requests'] }),
    queryClient.invalidateQueries({ queryKey: ['admin', 'gradebook-workflow-audit'] }),
  ]);
  const workflow = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: 'approve' | 'reject' | 'lock' }) => {
      if (action === 'reject') {
        const reason = window.prompt('Lý do trả lại sổ điểm:')?.trim();
        if (!reason) throw new Error('Cần nhập lý do trả lại');
        return gradebookApi.rejectGradebook(accessToken!, id, reason);
      }
      return action === 'approve'
        ? gradebookApi.approveGradebook(accessToken!, id)
        : gradebookApi.lockGradebook(accessToken!, id);
    },
    onSuccess: async () => { await refresh(); toast.success('Đã cập nhật trạng thái sổ điểm.'); },
  });
  const reviewRequest = useMutation({
    mutationFn: async ({ id, decision }: { id: number; decision: 'approve' | 'reject' }) => {
      const reason = window.prompt(decision === 'approve' ? 'Ghi chú khi cho phép sửa:' : 'Lý do từ chối:')?.trim();
      if (!reason) throw new Error('Cần nhập ghi chú');
      return gradebookApi.reviewGradebookChangeRequest(accessToken!, id, decision, reason);
    },
    onSuccess: async () => { await refresh(); toast.success('Đã xử lý yêu cầu sửa điểm.'); },
  });

  function exportAudit() {
    if (!audit.data?.data.length) return;
    const rows = [['Thời gian', 'Người thực hiện', 'Hành động', 'Trạng thái cũ', 'Trạng thái mới', 'Lý do', 'Revision']];
    for (const item of audit.data.data) rows.push([
      item.created_at, item.actor_name ?? '', item.action, item.old_status, item.new_status, item.reason ?? '', String(item.revision),
    ]);
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `gradebook-${auditId}-audit.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <AdminLayout>
      <div className="grid gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-sm font-semibold text-cyan-700">Học vụ</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Duyệt và khóa sổ điểm</h1>
            <p className="mt-2 text-sm text-slate-600">Kiểm soát quy trình gửi duyệt, công bố và mở khóa có audit.</p>
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value as GradebookStatus | '')} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">Tất cả trạng thái</option>
            {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </header>

        {(requests.data?.data ?? []).filter((item) => item.status === 'pending').length > 0 && (
          <section className="border border-amber-200 bg-amber-50 p-4">
            <h2 className="font-bold text-amber-950">Yêu cầu sửa điểm chờ xử lý</h2>
            <div className="mt-3 grid gap-2">
              {requests.data?.data.filter((item) => item.status === 'pending').map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border border-amber-200 bg-white p-3">
                  <div><strong>{item.classroom_name} - {item.subject_name}</strong><p className="text-sm text-slate-600">{item.teacher_name}: {item.reason}</p></div>
                  <div className="flex gap-2">
                    <button onClick={() => reviewRequest.mutate({ id: item.id, decision: 'approve' })} className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Cho phép sửa</button>
                    <button onClick={() => reviewRequest.mutate({ id: item.id, decision: 'reject' })} className="rounded-md border border-red-300 px-3 py-2 text-xs font-bold text-red-700">Từ chối</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          {gradebooks.isLoading ? <p className="p-8 text-center text-sm text-slate-500">Đang tải sổ điểm...</p>
            : gradebooks.isError ? <p className="bg-red-50 p-4 text-sm text-red-700">Không thể tải danh sách sổ điểm.</p>
            : (gradebooks.data?.data.length ?? 0) === 0 ? (
              <div className="p-10 text-center"><BookOpenCheck className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 text-sm text-slate-500">Chưa có sổ điểm phù hợp.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Lớp / môn</th><th className="px-4 py-3">Giáo viên</th><th className="px-4 py-3">Tiến độ</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Thao tác</th></tr></thead>
                  <tbody className="divide-y divide-slate-200">
                    {gradebooks.data?.data.map((book) => (
                      <tr key={book.id}>
                        <td className="px-4 py-3"><strong className="block">{book.classroom_name}</strong><span className="text-slate-500">{book.subject_name} - {book.semester_name}</span></td>
                        <td className="px-4 py-3">{book.teacher_name}</td>
                        <td className="px-4 py-3 font-semibold">{book.scored_student_count}/{book.student_count}</td>
                        <td className="px-4 py-3"><span className="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800">{labels[book.status]}</span></td>
                        <td className="px-4 py-3"><div className="flex flex-wrap gap-2">
                          {book.status === 'submitted' && <>
                            <button title="Duyệt" onClick={() => workflow.mutate({ id: book.id, action: 'approve' })} className="rounded-md bg-emerald-700 p-2 text-white"><CheckCircle2 className="h-4 w-4" /></button>
                            <button title="Trả lại" onClick={() => workflow.mutate({ id: book.id, action: 'reject' })} className="rounded-md border border-red-300 p-2 text-red-700"><XCircle className="h-4 w-4" /></button>
                          </>}
                          {book.status === 'approved' && <button title="Khóa sổ" onClick={() => workflow.mutate({ id: book.id, action: 'lock' })} className="rounded-md bg-slate-800 p-2 text-white"><LockKeyhole className="h-4 w-4" /></button>}
                          <button title="Nhật ký" onClick={() => setAuditId(book.id)} className="rounded-md border border-slate-300 p-2 text-slate-700"><History className="h-4 w-4" /></button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </section>

        {auditId && (
          <section className="border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><h2 className="font-bold">Nhật ký workflow sổ #{auditId}</h2><button onClick={exportAudit} disabled={!audit.data?.data.length} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"><Download className="h-4 w-4" /> Xuất CSV</button></div>
            <div className="mt-3 grid gap-2">
              {audit.isLoading ? <p className="text-sm text-slate-500">Đang tải nhật ký...</p> : (audit.data?.data ?? []).map((item) => (
                <div key={item.id} className="grid gap-1 border-l-2 border-cyan-600 bg-slate-50 p-3 text-sm sm:grid-cols-[180px_1fr]">
                  <span className="text-slate-500">{new Date(item.created_at).toLocaleString('vi-VN')}</span>
                  <span><strong>{item.actor_name ?? 'Hệ thống'}</strong> - {item.action}: {labels[item.old_status]} → {labels[item.new_status]}{item.reason ? ` - ${item.reason}` : ''}</span>
                </div>
              ))}
              {!audit.isLoading && !audit.data?.data.length && <p className="text-sm text-slate-500">Chưa có thay đổi workflow.</p>}
            </div>
          </section>
        )}
        {(workflow.isError || reviewRequest.isError) && <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">{((workflow.error || reviewRequest.error) as Error).message}</p>}
      </div>
    </AdminLayout>
  );
}
