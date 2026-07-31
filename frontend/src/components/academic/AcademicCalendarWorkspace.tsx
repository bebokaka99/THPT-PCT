import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, CalendarDays, CheckCircle2, Download, List, Plus, Printer, Search, Trash2, TriangleAlert } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import {
  archiveAcademicCalendarEntry,
  createAcademicCalendarEntry,
  deleteAcademicCalendarEntry,
  getAcademicCalendar,
  previewAcademicCalendarConflicts,
  publishAcademicCalendarEntry,
} from '../../services/academicCalendar.service';
import { getAcademicPeriods } from '../../services/academicPeriod.service';
import { getMyTeachingAssignments, getTeachingAssignments } from '../../services/teachingAssignment.service';
import { useAuth } from '../../stores/auth-context';
import type { AcademicCalendarConflict, AcademicCalendarEntry, AcademicCalendarEntryStatus, AcademicCalendarEntryType, AcademicCalendarInput } from '../../types/academic-calendar';

type PortalRole = 'admin' | 'teacher' | 'student' | 'guardian';
type Props = { role: PortalRole; studentId?: number; studentName?: string };

const labels: Record<AcademicCalendarEntryType, string> = {
  test: 'Kiểm tra', exam: 'Thi', make_up: 'Học bù', no_school: 'Nghỉ học', deadline: 'Hạn học vụ',
};
const colors: Record<AcademicCalendarEntryType, string> = {
  test: 'border-blue-200 bg-blue-50 text-blue-800', exam: 'border-red-200 bg-red-50 text-red-800',
  make_up: 'border-emerald-200 bg-emerald-50 text-emerald-800', no_school: 'border-amber-200 bg-amber-50 text-amber-800',
  deadline: 'border-violet-200 bg-violet-50 text-violet-800',
};

function dateTime(value: string, allDay = false) {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'medium', timeStyle: allDay ? undefined : 'short' }).format(new Date(value));
}

function zoned(localValue: string) {
  return `${localValue.length === 16 ? `${localValue}:00` : localValue}+07:00`;
}

function vietnamDateKey(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function exportIcs(entries: AcademicCalendarEntry[]) {
  const stamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//THPT PCT//Academic Calendar//VI'];
  entries.forEach((entry) => lines.push('BEGIN:VEVENT', `UID:academic-${entry.id}@pct.local`, `DTSTAMP:${stamp(entry.updated_at)}`, `DTSTART:${stamp(entry.starts_at)}`, `DTEND:${stamp(entry.ends_at)}`, `SUMMARY:${escapeIcs(entry.title)}`, `DESCRIPTION:${escapeIcs(entry.description ?? '')}`, `LOCATION:${escapeIcs(entry.room ?? entry.classroom_name ?? '')}`, 'END:VEVENT'));
  lines.push('END:VCALENDAR');
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'lich-hoc-vu.ics'; link.click(); URL.revokeObjectURL(url);
}

function CalendarMonth({ entries }: { entries: AcademicCalendarEntry[] }) {
  const firstKey = entries[0] ? vietnamDateKey(entries[0].starts_at) : vietnamDateKey(new Date().toISOString());
  const [year, monthNumber] = firstKey.split('-').map(Number); const month = monthNumber - 1;
  const firstDay = new Date(year, month, 1); const days = new Date(year, month + 1, 0).getDate();
  const offset = (firstDay.getDay() + 6) % 7;
  const cells = Array.from({ length: offset + days }, (_, index) => index < offset ? null : index - offset + 1);
  return <section className="overflow-x-auto border border-slate-200 bg-white p-3 shadow-sm">
    <h2 className="mb-3 font-bold text-slate-950">Tháng {month + 1}/{year}</h2>
    <div className="grid min-w-[720px] grid-cols-7 border-l border-t border-slate-200 text-xs">
      {['Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7','CN'].map((day) => <div key={day} className="border-b border-r border-slate-200 bg-slate-50 p-2 font-bold text-slate-600">{day}</div>)}
      {cells.map((day, index) => {
        const dateKey = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
        const items = day ? entries.filter((entry) => vietnamDateKey(entry.starts_at) === dateKey) : [];
        return <div key={`${index}-${day}`} className="min-h-28 border-b border-r border-slate-200 p-2"><span className="font-bold text-slate-500">{day}</span>{items.map((entry) => <div key={entry.id} className={`mt-1 border px-2 py-1 font-semibold ${colors[entry.entry_type]}`}>{entry.title}</div>)}</div>;
      })}
    </div>
  </section>;
}

export function AcademicCalendarWorkspace({ role, studentId, studentName }: Props) {
  const { accessToken } = useAuth(); const queryClient = useQueryClient();
  const canCreate = role === 'admin' || role === 'teacher';
  const [q, setQ] = useState(''); const [type, setType] = useState<AcademicCalendarEntryType | ''>('');
  const [status, setStatus] = useState<AcademicCalendarEntryStatus | ''>(''); const [view, setView] = useState<'list' | 'calendar'>('list');
  const [showForm, setShowForm] = useState(false); const [message, setMessage] = useState(''); const [conflicts, setConflicts] = useState<AcademicCalendarConflict[]>([]);
  const [form, setForm] = useState({ entry_type: 'test' as AcademicCalendarEntryType, title: '', description: '', assignmentId: '', academicYearId: '', startsAt: '', endsAt: '', allDay: false, room: '' });
  const list = useQuery({ queryKey: ['academic-calendar', role, studentId, q, type, status], queryFn: () => getAcademicCalendar(accessToken!, { q: q.trim() || undefined, entry_type: type || undefined, status: (role === 'admin' || role === 'teacher') ? status || undefined : undefined, student_id: studentId, limit: 100 }), enabled: Boolean(accessToken && (role !== 'guardian' || studentId)) });
  const assignments = useQuery({ queryKey: ['academic-calendar', 'assignments', role], queryFn: () => role === 'admin' ? getTeachingAssignments(accessToken!, { status: 'active', limit: 100 }) : getMyTeachingAssignments(accessToken!, { status: 'active', limit: 100 }), enabled: Boolean(accessToken && canCreate) });
  const periods = useQuery({ queryKey: ['academic-calendar', 'periods'], queryFn: () => getAcademicPeriods(accessToken!), enabled: Boolean(accessToken && role === 'admin') });
  const input = useMemo<AcademicCalendarInput | null>(() => {
    if (!form.title.trim() || !form.startsAt || !form.endsAt) return null;
    const schoolwide = ['no_school', 'deadline'].includes(form.entry_type);
    if (schoolwide ? !form.academicYearId : !form.assignmentId) return null;
    return { entry_type: form.entry_type, title: form.title.trim(), description: form.description.trim() || null, teaching_assignment_id: schoolwide ? null : Number(form.assignmentId) || undefined, academic_year_id: schoolwide ? Number(form.academicYearId) || undefined : undefined, starts_at: zoned(form.startsAt), ends_at: zoned(form.endsAt), all_day: form.allDay, room: schoolwide ? null : form.room.trim() || null };
  }, [form]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['academic-calendar'] });
  const create = useMutation({ mutationFn: () => createAcademicCalendarEntry(accessToken!, input!), onSuccess: async ({ data }) => { setMessage(role === 'teacher' ? 'Đã gửi đề xuất để admin duyệt.' : 'Đã lưu lịch nháp.'); setShowForm(false); setConflicts([]); setForm((old) => ({ ...old, title: '', description: '' })); await refresh(); return data; }, onError: (error: Error) => setMessage(error.message) });
  const publish = useMutation({ mutationFn: (id: number) => publishAcademicCalendarEntry(accessToken!, id), onSuccess: async () => { setMessage('Đã công bố và gửi thông báo.'); await refresh(); }, onError: (error: Error) => setMessage(error.message) });
  const archive = useMutation({ mutationFn: (id: number) => archiveAcademicCalendarEntry(accessToken!, id), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: number) => deleteAcademicCalendarEntry(accessToken!, id), onSuccess: refresh });
  const preview = useMutation({ mutationFn: () => previewAcademicCalendarConflicts(accessToken!, input!), onSuccess: ({ data }) => { setConflicts(data); setMessage(data.length ? `Phát hiện ${data.length} xung đột.` : 'Không phát hiện xung đột.'); } });
  function submit(event: FormEvent) { event.preventDefault(); if (!input) { setMessage('Vui lòng nhập đủ tiêu đề và thời gian.'); return; } create.mutate(); }
  const entries = list.data?.data ?? [];

  return <div className="grid min-w-0 gap-5">
    <header className="border-b border-slate-200 pb-5 print:border-0"><p className="text-sm font-semibold text-blue-700">Điều hành học vụ</p><div className="mt-1 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Lịch kiểm tra & học vụ</h1><p className="mt-2 text-sm text-slate-600">{studentName ? `Lịch đã công bố của ${studentName}.` : 'Theo dõi lịch kiểm tra, thi, học bù, nghỉ học và hạn học vụ.'}</p></div>{canCreate && <button type="button" onClick={() => setShowForm((value) => !value)} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4" />{role === 'teacher' ? 'Tạo đề xuất' : 'Tạo lịch'}</button>}</div></header>
    {message && <p className={`border p-3 text-sm ${message.includes('xung đột') || message.includes('required') ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>{message}</p>}
    {showForm && canCreate && <form onSubmit={submit} className="grid gap-4 border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
      <div className="md:col-span-2"><h2 className="font-bold text-slate-950">{role === 'teacher' ? 'Đề xuất lịch trong phân công' : 'Tạo lịch nháp'}</h2><p className="mt-1 text-xs text-slate-500">Múi giờ cố định Asia/Ho_Chi_Minh. Chỉ admin mới công bố.</p></div>
      <label className="grid gap-1 text-sm font-semibold text-slate-700">Loại lịch<select value={form.entry_type} onChange={(e) => setForm({ ...form, entry_type: e.target.value as AcademicCalendarEntryType })} className="rounded-md border border-slate-300 px-3 py-2.5">{(role === 'teacher' ? ['test','exam','make_up'] : Object.keys(labels)).map((item) => <option key={item} value={item}>{labels[item as AcademicCalendarEntryType]}</option>)}</select></label>
      {['no_school','deadline'].includes(form.entry_type) && role === 'admin' ? <label className="grid gap-1 text-sm font-semibold text-slate-700">Năm học<select required value={form.academicYearId} onChange={(e) => setForm({ ...form, academicYearId: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2.5"><option value="">Chọn năm học</option>{periods.data?.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label> : <label className="grid gap-1 text-sm font-semibold text-slate-700">Phân công giảng dạy<select required value={form.assignmentId} onChange={(e) => setForm({ ...form, assignmentId: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2.5"><option value="">Chọn lớp - môn - giáo viên</option>{assignments.data?.data.map((item) => <option key={item.id} value={item.id}>{item.classroom_name} · {item.subject_name} · {item.teacher_name}</option>)}</select></label>}
      <label className="grid gap-1 text-sm font-semibold text-slate-700 md:col-span-2">Tiêu đề<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2.5" /></label>
      <label className="grid gap-1 text-sm font-semibold text-slate-700">Bắt đầu<input required type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2.5" /></label>
      <label className="grid gap-1 text-sm font-semibold text-slate-700">Kết thúc<input required type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2.5" /></label>
      {!['no_school','deadline'].includes(form.entry_type) && <label className="grid gap-1 text-sm font-semibold text-slate-700">Phòng<input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2.5" /></label>}
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} />Cả ngày</label>
      <label className="grid gap-1 text-sm font-semibold text-slate-700 md:col-span-2">Mô tả<textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2.5" /></label>
      {conflicts.length > 0 && <div className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 md:col-span-2">{conflicts.map((item) => <p key={`${item.source}-${item.conflicting_id}`} className="mt-1">• {item.message}</p>)}</div>}
      <div className="flex flex-wrap gap-2 md:col-span-2"><button type="button" disabled={!input || preview.isPending} onClick={() => preview.mutate()} className="inline-flex items-center gap-2 rounded-md border border-amber-300 px-4 py-2 text-sm font-bold text-amber-800"><TriangleAlert className="h-4 w-4" />Kiểm tra xung đột</button><button disabled={!input || create.isPending} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white">{create.isPending ? 'Đang lưu...' : role === 'teacher' ? 'Gửi đề xuất' : 'Lưu bản nháp'}</button></div>
    </form>}
    <section className="flex flex-wrap items-center gap-2 border border-slate-200 bg-white p-3 shadow-sm print:hidden"><label className="relative min-w-56 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm lịch..." className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm" /></label><select value={type} onChange={(e) => setType(e.target.value as AcademicCalendarEntryType | '')} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="">Tất cả loại</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{(role === 'admin' || role === 'teacher') && <select value={status} onChange={(e) => setStatus(e.target.value as AcademicCalendarEntryStatus | '')} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="">Tất cả trạng thái</option><option value="draft">Nháp</option><option value="proposed">Đề xuất</option><option value="published">Đã công bố</option><option value="archived">Lưu trữ</option></select>}<button type="button" onClick={() => setView(view === 'list' ? 'calendar' : 'list')} title="Đổi kiểu hiển thị" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300">{view === 'list' ? <CalendarDays className="h-4 w-4" /> : <List className="h-4 w-4" />}</button><button type="button" onClick={() => exportIcs(entries)} title="Xuất lịch ICS" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300"><Download className="h-4 w-4" /></button><button type="button" onClick={() => window.print()} title="In lịch" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300"><Printer className="h-4 w-4" /></button></section>
    {list.isLoading ? <div className="h-48 animate-pulse border border-slate-200 bg-white" /> : list.isError ? <p className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">Không thể tải lịch học vụ.</p> : entries.length === 0 ? <div className="border border-dashed border-slate-300 bg-white p-10 text-center"><CalendarDays className="mx-auto h-9 w-9 text-slate-300" /><h2 className="mt-3 font-bold text-slate-950">Chưa có lịch phù hợp</h2><p className="mt-1 text-sm text-slate-500">Lịch đã công bố hoặc đề xuất sẽ xuất hiện tại đây.</p></div> : view === 'calendar' ? <CalendarMonth entries={entries} /> : <section className="grid gap-3">{entries.map((entry) => <article key={entry.id} className="border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className={`border px-2 py-1 text-xs font-bold ${colors[entry.entry_type]}`}>{labels[entry.entry_type]}</span><span className="text-xs font-semibold uppercase text-slate-400">{entry.status}</span></div><h2 className="mt-3 text-lg font-bold text-slate-950">{entry.title}</h2><p className="mt-1 text-sm font-semibold text-blue-700">{entry.classroom_name ?? 'Toàn trường'}{entry.subject_name ? ` · ${entry.subject_name}` : ''}</p><p className="mt-2 text-sm text-slate-600">{dateTime(entry.starts_at, entry.all_day)} → {dateTime(entry.ends_at, entry.all_day)}{entry.room ? ` · Phòng ${entry.room}` : ''}</p>{entry.description && <p className="mt-2 text-sm leading-6 text-slate-600">{entry.description}</p>}</div>{role === 'admin' && <div className="flex gap-2 print:hidden">{['draft','proposed'].includes(entry.status) && <button type="button" title="Công bố" onClick={() => publish.mutate(entry.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-600 text-white"><CheckCircle2 className="h-4 w-4" /></button>}{entry.status === 'published' && <button type="button" title="Lưu trữ" onClick={() => archive.mutate(entry.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300"><Archive className="h-4 w-4" /></button>}{['draft','proposed'].includes(entry.status) && <button type="button" title="Xóa" onClick={() => window.confirm('Xóa lịch này?') && remove.mutate(entry.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 text-red-700"><Trash2 className="h-4 w-4" /></button>}</div>}</div></article>)}</section>}
  </div>;
}
