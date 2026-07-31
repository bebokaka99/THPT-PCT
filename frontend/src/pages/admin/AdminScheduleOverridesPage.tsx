import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, CalendarClock, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { archiveScheduleOverride, getAdminOverrides, publishScheduleOverride } from '../../services/scheduleOverride.service';
import { useAuth } from '../../stores/auth-context';
import type { ScheduleOverrideStatus } from '../../types/schedule-override';

function vietnamDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()); }

export function AdminScheduleOverridesPage() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(vietnamDate);
  const [status, setStatus] = useState<ScheduleOverrideStatus | ''>('proposed');
  const query = useQuery({
    queryKey: ['admin', 'schedule-overrides', date, status],
    enabled: Boolean(accessToken),
    queryFn: async () => (await getAdminOverrides(accessToken!, { date, status: status || undefined })).data,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'schedule-overrides'] });
  const publish = useMutation({ mutationFn: (id: number) => publishScheduleOverride(accessToken!, id), onSuccess: refresh });
  const archive = useMutation({ mutationFn: (id: number) => archiveScheduleOverride(accessToken!, id), onSuccess: refresh });

  return <AdminLayout><header className="border-b border-slate-200 pb-6"><p className="text-sm font-semibold text-emerald-700">Điều phối học vụ</p><h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Duyệt thay đổi lịch</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Kiểm tra đề xuất dạy thay, đổi tiết, đổi phòng và báo nghỉ trước khi công bố.</p></header><section className="mt-6 flex flex-wrap items-end gap-3 border border-slate-200 bg-white p-4 shadow-sm"><label className="text-sm font-semibold text-slate-700">Ngày<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 block rounded-md border border-slate-300 px-3 py-2 font-normal" /></label><label className="text-sm font-semibold text-slate-700">Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value as ScheduleOverrideStatus | '')} className="mt-1 block rounded-md border border-slate-300 bg-white px-3 py-2 font-normal"><option value="">Tất cả</option><option value="draft">Draft</option><option value="proposed">Đề xuất</option><option value="published">Đã công bố</option><option value="archived">Đã lưu trữ</option></select></label></section>{query.isLoading ? <p className="mt-6 text-sm text-slate-500">Đang tải đề xuất...</p> : query.isError ? <p className="mt-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700">Không thể tải đề xuất thay đổi lịch.</p> : (query.data?.length ?? 0) === 0 ? <section className="mt-6 border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><CalendarClock className="mx-auto h-9 w-9 text-slate-400" /><h2 className="mt-3 font-bold text-slate-950">Không có đề xuất phù hợp</h2><p className="mt-2 text-sm text-slate-500">Các đề xuất mới từ giáo viên sẽ xuất hiện tại đây.</p></section> : <section className="mt-6 grid gap-3">{query.data?.map((item) => <article key={item.id} className="border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold uppercase text-amber-800">{item.status}</span><span className="text-xs text-slate-500">{item.override_date}</span></div><h2 className="mt-2 text-lg font-bold text-slate-950">{item.classroom_name} · {item.subject_name}</h2><p className="mt-1 text-sm text-slate-600">{item.override_type} · Tiết {item.original_lesson_index} · {item.original_shift_name}</p><p className="mt-2 text-sm text-slate-700">{item.reason}</p><p className="mt-2 text-xs text-slate-500">Đề xuất bởi {item.created_by_name}{item.substitute_teacher_name ? ` · Giáo viên thay: ${item.substitute_teacher_name}` : ''}{item.room ? ` · Phòng: ${item.room}` : ''}</p></div><div className="flex shrink-0 gap-2">{(item.status === 'draft' || item.status === 'proposed') && <button type="button" onClick={() => publish.mutate(item.id)} disabled={publish.isPending} className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />Công bố</button>}{item.status !== 'archived' && <button type="button" onClick={() => archive.mutate(item.id)} disabled={archive.isPending} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"><Archive className="h-4 w-4" />Lưu trữ</button>}</div></div></article>)}</section>}</AdminLayout>;
}
