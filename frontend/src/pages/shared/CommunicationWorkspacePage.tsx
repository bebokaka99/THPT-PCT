import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CheckCircle2, Loader2, Send, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { TeacherPortalLayout } from '../../components/layout/TeacherPortalLayout';
import { getCommunicationOptions, createNotification, getNotificationReport, getSentNotifications } from '../../services/notification.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type { NotificationPriority, NotificationTargetRole, NotificationTargetScope, NotificationType } from '../../types/notification';

const card = 'border border-slate-200 bg-white p-5 shadow-sm';

export function CommunicationWorkspacePage({ mode }: { mode: 'admin' | 'teacher' }) {
  const { accessToken, user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<NotificationType>('school');
  const [scope, setScope] = useState<NotificationTargetScope>(mode === 'teacher' ? 'classroom' : 'school');
  const [targetRole, setTargetRole] = useState<NotificationTargetRole>(mode === 'teacher' ? 'student' : 'all');
  const [priority, setPriority] = useState<NotificationPriority>('normal');
  const [classroomId, setClassroomId] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [userIds, setUserIds] = useState<number[]>([]);
  const [relatedUrl, setRelatedUrl] = useState('');
  const [requiresAck, setRequiresAck] = useState(false);
  const [reportId, setReportId] = useState<number | null>(null);

  const optionsQuery = useQuery({
    queryKey: ['communication-options', user?.id, mode],
    queryFn: () => getCommunicationOptions(accessToken!),
    enabled: Boolean(accessToken && user),
  });
  const sentQuery = useQuery({
    queryKey: ['sent-notifications', user?.id, mode],
    queryFn: () => getSentNotifications(accessToken!),
    enabled: Boolean(accessToken && user),
  });
  const reportQuery = useQuery({
    queryKey: ['notification-report', reportId],
    queryFn: () => getNotificationReport(accessToken!, reportId!),
    enabled: Boolean(accessToken && reportId),
  });
  const createMutation = useMutation({
    mutationFn: () => createNotification(accessToken!, {
      title: title.trim(), message: message.trim(), type, target_role: targetRole,
      target_scope: scope, priority, classroom_id: classroomId ? Number(classroomId) : null,
      grade_level: gradeLevel ? Number(gradeLevel) : null, user_ids: scope === 'users' ? userIds : [],
      related_url: relatedUrl.trim() || null, requires_acknowledgement: requiresAck,
      idempotency_key: `manual-${user?.id}-${Date.now()}`,
    }),
    onSuccess: () => {
      setTitle(''); setMessage(''); setRelatedUrl(''); setUserIds([]); setRequiresAck(false);
      toast.success('Đã gửi thông báo đến đúng phạm vi người nhận.');
      void queryClient.invalidateQueries({ queryKey: ['sent-notifications'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể gửi thông báo.'),
  });
  const options = optionsQuery.data?.data;
  const sent = sentQuery.data?.data ?? [];
  const availableScope = mode === 'teacher' ? (['classroom'] as NotificationTargetScope[]) : ['school', 'role', 'grade', 'classroom', 'users'];
  const scopeLabel = useMemo(() => ({ school: 'Toàn trường', role: 'Theo vai trò', grade: 'Theo khối', classroom: 'Theo lớp', users: 'Danh sách tài khoản' }[scope]), [scope]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !message.trim()) { toast.error('Vui lòng nhập tiêu đề và nội dung thông báo.'); return; }
    createMutation.mutate();
  }

  function changeScope(next: NotificationTargetScope) {
    setScope(next); setClassroomId(''); setGradeLevel(''); setUserIds([]);
    if (next === 'school') setTargetRole('all');
  }

  function toggleUser(id: number) {
    setUserIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  const content = (
    <div className="space-y-6">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <p className="text-sm font-semibold text-blue-700">Trung tâm giao tiếp</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Gửi thông báo</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Chọn đúng phạm vi người nhận, mức ưu tiên và theo dõi tỷ lệ đã đọc hoặc xác nhận.</p>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,.9fr)]">
        <form className={`${card} space-y-5`} onSubmit={submit}>
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4"><Send className="h-5 w-5 text-blue-700" /><h2 className="font-bold text-slate-950">Thông báo mới</h2></div>
          <label className="block text-sm font-semibold text-slate-700">Tiêu đề<input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500" maxLength={255} /></label>
          <label className="block text-sm font-semibold text-slate-700">Nội dung<textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">Loại<select value={type} onChange={(e) => setType(e.target.value as NotificationType)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal"><option value="school">Nhà trường</option><option value="classroom">Lớp học</option><option value="document">Tài liệu</option><option value="event">Sự kiện</option><option value="system">Hệ thống</option></select></label>
            <label className="block text-sm font-semibold text-slate-700">Ưu tiên<select value={priority} onChange={(e) => setPriority(e.target.value as NotificationPriority)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal"><option value="normal">Bình thường</option><option value="important">Quan trọng</option><option value="urgent">Khẩn</option></select></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">Phạm vi<select value={scope} onChange={(e) => changeScope(e.target.value as NotificationTargetScope)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal">{availableScope.map((item) => <option key={item} value={item}>{item === scope ? scopeLabel : ({ school: 'Toàn trường', role: 'Theo vai trò', grade: 'Theo khối', classroom: 'Theo lớp', users: 'Danh sách tài khoản' }[item])}</option>)}</select></label>
            {scope !== 'school' && <label className="block text-sm font-semibold text-slate-700">Vai trò nhận<select value={targetRole} onChange={(e) => setTargetRole(e.target.value as NotificationTargetRole)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal"><option value="all">Tất cả đối tượng</option><option value="student">Học sinh</option><option value="guardian">Phụ huynh</option><option value="teacher">Giáo viên</option><option value="admin">Quản trị viên</option></select></label>}
          </div>
          {scope === 'classroom' && <label className="block text-sm font-semibold text-slate-700">Lớp nhận thông báo<select value={classroomId} onChange={(e) => setClassroomId(e.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal"><option value="">Chọn lớp</option>{(options?.classrooms ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.school_year}</option>)}</select></label>}
          {scope === 'grade' && <label className="block text-sm font-semibold text-slate-700">Khối<select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal"><option value="">Chọn khối</option>{(options?.grades ?? [10, 11, 12]).map((grade) => <option key={grade} value={grade}>Khối {grade}</option>)}</select></label>}
          {scope === 'users' && <div><p className="text-sm font-semibold text-slate-700">Danh sách người nhận</p><div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-slate-200 p-2">{(options?.users ?? []).map((item) => <label key={item.id} className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700"><input type="checkbox" checked={userIds.includes(item.id)} onChange={() => toggleUser(item.id)} />{item.full_name} <span className="text-xs text-slate-400">{item.role ?? item.email}</span></label>)}</div></div>}
          <label className="block text-sm font-semibold text-slate-700">Liên kết liên quan<input value={relatedUrl} onChange={(e) => setRelatedUrl(e.target.value)} placeholder="/student/classes/12 hoặc https://..." className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500" /></label>
          <label className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><input type="checkbox" checked={requiresAck} onChange={(e) => setRequiresAck(e.target.checked)} className="mt-0.5" /><span><strong>Yêu cầu xác nhận</strong><br /><span className="text-xs">Người nhận phải bấm “Đã xác nhận”; thao tác này khác với việc mở thông báo.</span></span></label>
          <button type="submit" disabled={createMutation.isPending || optionsQuery.isLoading} className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">{createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Gửi thông báo</button>
        </form>

        <section className={`${card} h-fit`}><div className="flex items-center gap-3 border-b border-slate-100 pb-4"><BellRing className="h-5 w-5 text-emerald-700" /><h2 className="font-bold text-slate-950">Đã gửi gần đây</h2></div><div className="mt-4 space-y-3">{sentQuery.isLoading && <p className="text-sm text-slate-500">Đang tải...</p>}{!sentQuery.isLoading && sent.length === 0 && <p className="text-sm text-slate-500">Chưa có thông báo.</p>}{sent.map((item) => <article key={item.id} className="rounded-md border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{item.title}</p><p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.message}</p></div>{item.priority === 'urgent' && <ShieldAlert className="h-5 w-5 shrink-0 text-red-600" />}</div><div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>{item.target_scope}</span><span>·</span><span>{new Date(item.created_at).toLocaleString('vi-VN')}</span><button type="button" onClick={() => setReportId(item.id)} className="ml-auto font-bold text-blue-700 hover:underline">Xem báo cáo</button></div></article>)}</div></section>
      </div>
      {reportId && <section className={`${card} mx-auto max-w-7xl px-4`}><div className="flex items-center justify-between"><h2 className="font-bold text-slate-950">Báo cáo thông báo #{reportId}</h2><button type="button" onClick={() => setReportId(null)} className="text-sm font-semibold text-slate-500">Đóng</button></div>{reportQuery.isLoading && <p className="mt-4 text-sm text-slate-500">Đang tải báo cáo...</p>}{reportQuery.data?.data && <div className="mt-4 grid gap-3 sm:grid-cols-4"><Metric label="Người nhận" value={reportQuery.data.data.recipients} /><Metric label="Đã gửi" value={reportQuery.data.data.delivered} /><Metric label="Đã đọc" value={`${reportQuery.data.data.read} (${reportQuery.data.data.read_rate}%)`} /><Metric label="Đã xác nhận" value={`${reportQuery.data.data.acknowledged} (${reportQuery.data.data.acknowledgement_rate}%)`} /></div>}</section>}
    </div>
  );
  return mode === 'admin' ? <AdminLayout>{content}</AdminLayout> : <TeacherPortalLayout>{content}</TeacherPortalLayout>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-md bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-950">{value}</p></div>;
}
