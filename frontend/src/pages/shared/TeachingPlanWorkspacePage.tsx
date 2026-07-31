import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, CheckCircle2, ClipboardCheck, FilePenLine, Loader2, Send, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { TeacherPortalLayout } from '../../components/layout/TeacherPortalLayout';
import {
  approveTeachingPlan,
  archiveTeachingPlan,
  createTeachingPlan,
  deleteTeachingPlan,
  getTeachingPlanOptions,
  getTeachingPlanSummary,
  getTeachingPlans,
  rejectTeachingPlan,
  submitTeachingPlan,
  updateTeachingPlan,
} from '../../services/teachingPlan.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type { TeachingPlan, TeachingPlanStatus } from '../../types/teaching-plan';

const statusLabels: Record<TeachingPlanStatus, string> = {
  draft: 'Bản nháp', submitted: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Cần chỉnh sửa', archived: 'Đã lưu trữ',
};
const statusStyles: Record<TeachingPlanStatus, string> = {
  draft: 'bg-slate-100 text-slate-700', submitted: 'bg-amber-100 text-amber-800', approved: 'bg-emerald-100 text-emerald-800', rejected: 'bg-red-100 text-red-700', archived: 'bg-blue-100 text-blue-700',
};

export function TeachingPlanWorkspacePage({ mode }: { mode: 'admin' | 'teacher' }) {
  const { accessToken, user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<TeachingPlanStatus | ''>('');
  const [editing, setEditing] = useState<TeachingPlan | null>(null);
  const [assignmentId, setAssignmentId] = useState('');
  const [title, setTitle] = useState('');
  const [objectives, setObjectives] = useState('');
  const [content, setContent] = useState('');
  const [resources, setResources] = useState('');
  const [weekNumber, setWeekNumber] = useState('');

  const listQuery = useQuery({
    queryKey: ['teaching-plans', user?.id, mode, status],
    queryFn: () => getTeachingPlans(accessToken!, { status: status || undefined }),
    enabled: Boolean(accessToken && user),
  });
  const optionsQuery = useQuery({
    queryKey: ['teaching-plan-options', user?.id, mode],
    queryFn: () => getTeachingPlanOptions(accessToken!),
    enabled: Boolean(accessToken && user),
  });
  const summaryQuery = useQuery({
    queryKey: ['teaching-plan-summary'],
    queryFn: () => getTeachingPlanSummary(accessToken!),
    enabled: Boolean(accessToken && user && mode === 'admin'),
  });

  const refresh = async () => queryClient.invalidateQueries({ queryKey: ['teaching-plans'] });
  const saveMutation = useMutation({
    mutationFn: () => editing
      ? updateTeachingPlan(accessToken!, editing.id, { title: title.trim(), objectives: objectives.trim() || null, content: content.trim() || null, resources: resources.trim() || null, week_number: weekNumber ? Number(weekNumber) : null })
      : createTeachingPlan(accessToken!, { teaching_assignment_id: Number(assignmentId), title: title.trim(), objectives: objectives.trim() || null, content: content.trim() || null, resources: resources.trim() || null, week_number: weekNumber ? Number(weekNumber) : null }),
    onSuccess: async () => { await refresh(); resetForm(); toast.success(editing ? 'Đã tạo phiên bản kế hoạch mới.' : 'Đã tạo kế hoạch giảng dạy.'); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể lưu kế hoạch.'),
  });
  const actionMutation = useMutation({
    mutationFn: async ({ action, plan }: { action: 'submit' | 'approve' | 'reject' | 'archive' | 'delete'; plan: TeachingPlan }) => {
      if (action === 'submit') return submitTeachingPlan(accessToken!, plan.id);
      if (action === 'approve') return approveTeachingPlan(accessToken!, plan.id);
      if (action === 'reject') {
        const reason = window.prompt('Nhập lý do cần giáo viên chỉnh sửa:')?.trim();
        if (!reason) throw new Error('Cần nhập lý do từ chối.');
        return rejectTeachingPlan(accessToken!, plan.id, reason);
      }
      if (action === 'archive') return archiveTeachingPlan(accessToken!, plan.id);
      if (!window.confirm(`Xóa kế hoạch “${plan.title}”?`)) throw new Error('CANCELLED');
      return deleteTeachingPlan(accessToken!, plan.id);
    },
    onSuccess: async () => { await refresh(); toast.success('Đã cập nhật trạng thái kế hoạch.'); },
    onError: (error) => { if (error instanceof Error && error.message === 'CANCELLED') return; toast.error(error instanceof Error ? error.message : 'Không thể cập nhật kế hoạch.'); },
  });

  function resetForm() { setEditing(null); setAssignmentId(''); setTitle(''); setObjectives(''); setContent(''); setResources(''); setWeekNumber(''); }
  function editPlan(plan: TeachingPlan) { setEditing(plan); setAssignmentId(String(plan.teaching_assignment_id)); setTitle(plan.title); setObjectives(plan.objectives ?? ''); setContent(plan.content ?? ''); setResources(plan.resources ?? ''); setWeekNumber(plan.week_number ? String(plan.week_number) : ''); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function submitForm(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || (!editing && !assignmentId)) { toast.error('Vui lòng chọn phân công và nhập tên kế hoạch.'); return; }
    saveMutation.mutate();
  }

  const body = <div className="space-y-6">
    <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-7xl px-4 py-8"><p className="text-sm font-semibold text-blue-700">Học vụ · Kế hoạch giảng dạy</p><h1 className="mt-1 text-3xl font-bold text-slate-950">{mode === 'teacher' ? 'Kế hoạch của tôi' : 'Duyệt kế hoạch giảng dạy'}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Kế hoạch bám theo lớp, môn và học kỳ đã phân công. Bản được duyệt không thể sửa âm thầm.</p></div></section>
    <div className="mx-auto grid max-w-7xl gap-6 px-4 xl:grid-cols-[minmax(20rem,.8fr)_minmax(0,1.2fr)]">
      {mode === 'teacher' && (
        <form onSubmit={submitForm} className="h-fit border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h2 className="font-bold text-slate-950">{editing ? `Sửa kế hoạch v${editing.version_number}` : 'Tạo kế hoạch'}</h2>
            {editing && <button type="button" onClick={resetForm} className="text-sm font-semibold text-slate-500">Hủy sửa</button>}
          </div>
          <div className="mt-4 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              Phân công giảng dạy
              <select disabled={Boolean(editing)} value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal disabled:bg-slate-100">
                <option value="">Chọn lớp · môn · học kỳ</option>
                {(optionsQuery.data?.data.assignments ?? []).map((item) => <option key={item.id} value={item.id}>{item.classroom_name} · {item.subject_name} · {item.semester_name}</option>)}
              </select>
            </label>
            <Field label="Tên kế hoạch" value={title} onChange={setTitle} />
            <label className="block text-sm font-semibold text-slate-700">
              Tuần học (1-53, không bắt buộc)
              <input type="number" min={1} max={53} value={weekNumber} onChange={(event) => setWeekNumber(event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500" />
            </label>
            <Area label="Mục tiêu" value={objectives} onChange={setObjectives} rows={3} />
            <Area label="Nội dung/tiến độ dự kiến" value={content} onChange={setContent} rows={6} />
            <Area label="Học liệu và tài nguyên" value={resources} onChange={setResources} rows={3} />
            <button disabled={saveMutation.isPending} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePenLine className="h-4 w-4" />}
              {editing ? 'Lưu thành phiên bản mới' : 'Lưu bản nháp'}
            </button>
          </div>
        </form>
      )}
      <section className={mode === 'admin' ? 'xl:col-span-2' : ''}>{mode === 'admin' && (summaryQuery.data?.data.length ?? 0) > 0 && <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{summaryQuery.data!.data.map((item) => <div key={item.subject_group} className="border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase text-slate-500">{item.subject_group}</p><p className="mt-1 text-2xl font-bold text-slate-950">{item.approved}/{item.total}</p><p className="mt-1 text-xs text-slate-500">Đã duyệt · Chờ duyệt {item.submitted} · Cần sửa {item.rejected}</p></div>)}</div>}<div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-slate-950">Danh sách kế hoạch</h2><select value={status} onChange={(e) => setStatus(e.target.value as TeachingPlanStatus | '')} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>{listQuery.isLoading && <div className="border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Đang tải kế hoạch...</div>}{listQuery.isError && <div className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">Không thể tải danh sách kế hoạch.</div>}<div className="space-y-4">{(listQuery.data?.data ?? []).map((plan) => <article key={plan.id} className="border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-950">{plan.title}</h3><span className={`rounded-full px-2 py-1 text-xs font-bold ${statusStyles[plan.status]}`}>{statusLabels[plan.status]}</span><span className="text-xs font-semibold text-slate-400">v{plan.version_number}</span></div><p className="mt-2 text-sm font-semibold text-blue-700">{plan.classroom_name} · {plan.subject_name} · {plan.semester_name}</p><p className="mt-1 text-xs text-slate-500">{plan.teacher_name} · {plan.academic_year_name}</p></div><div className="flex flex-wrap gap-2">{mode === 'teacher' && ['draft', 'rejected'].includes(plan.status) && <><Action icon={FilePenLine} label="Sửa" onClick={() => editPlan(plan)} /><Action icon={Send} label="Gửi duyệt" onClick={() => actionMutation.mutate({ action: 'submit', plan })} primary /><Action icon={Trash2} label="Xóa" onClick={() => actionMutation.mutate({ action: 'delete', plan })} danger /></>}{mode === 'admin' && plan.status === 'submitted' && <><Action icon={CheckCircle2} label="Duyệt" onClick={() => actionMutation.mutate({ action: 'approve', plan })} primary /><Action icon={XCircle} label="Yêu cầu sửa" onClick={() => actionMutation.mutate({ action: 'reject', plan })} danger /></>}{mode === 'admin' && ['approved', 'rejected'].includes(plan.status) && <Action icon={Archive} label="Lưu trữ" onClick={() => actionMutation.mutate({ action: 'archive', plan })} />}</div></div>{plan.objectives && <div className="mt-4 rounded-md bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">Mục tiêu</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{plan.objectives}</p></div>}{plan.content && <p className="mt-4 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">{plan.content}</p>}{plan.review_comment && <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Phản hồi reviewer:</strong> {plan.review_comment}</div>}</article>)}{!listQuery.isLoading && (listQuery.data?.data.length ?? 0) === 0 && <div className="border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Chưa có kế hoạch phù hợp bộ lọc.</div>}</div></section>
    </div>
  </div>;
  return mode === 'admin' ? <AdminLayout>{body}</AdminLayout> : <TeacherPortalLayout>{body}</TeacherPortalLayout>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-semibold text-slate-700">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500" /></label>; }
function Area({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: number }) { return <label className="block text-sm font-semibold text-slate-700">{label}<textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500" /></label>; }
function Action({ icon: Icon, label, onClick, primary, danger }: { icon: typeof ClipboardCheck; label: string; onClick: () => void; primary?: boolean; danger?: boolean }) { return <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-bold ${primary ? 'border-blue-700 bg-blue-700 text-white' : danger ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}><Icon className="h-3.5 w-3.5" />{label}</button>; }
