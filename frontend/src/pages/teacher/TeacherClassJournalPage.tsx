import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpenCheck, CheckCircle2, Clock3, Save, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { TeacherPortalLayout } from '../../components/layout/TeacherPortalLayout';
import * as journalApi from '../../services/classJournal.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type { ClassJournalInput, ClassJournalOption, ClassJournalStatus } from '../../types/class-journal';

function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()); }
const labels: Record<ClassJournalStatus, string> = { draft: 'Bản nháp', completed: 'Đã xác nhận', cancelled: 'Tiết hủy' };

export function TeacherClassJournalPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const client = useQueryClient();
  const [date, setDate] = useState(today);
  const [selected, setSelected] = useState<ClassJournalOption | null>(null);
  const [form, setForm] = useState({ lesson_content: '', class_comment: '', progress_note: '', homework: '', status: 'draft' as ClassJournalStatus, attendance_session_id: '' });
  const options = useQuery({ queryKey: ['class-journal-options', date], enabled: Boolean(accessToken), queryFn: () => journalApi.getClassJournalOptions(accessToken!, date) });
  const journals = useQuery({ queryKey: ['class-journals', 'teacher', date], enabled: Boolean(accessToken), queryFn: () => journalApi.getClassJournals(accessToken!, { from: date, to: date }) });
  const existing = useMemo(() => selected ? journals.data?.data.find((item) => item.timetable_item_id === selected.timetable_item_id) : undefined, [journals.data?.data, selected]);

  useEffect(() => {
    if (!selected) return;
    setForm({ lesson_content: existing?.lesson_content ?? '', class_comment: existing?.class_comment ?? '', progress_note: existing?.progress_note ?? '', homework: existing?.homework ?? '', status: existing?.status ?? (selected.is_cancelled ? 'cancelled' : 'draft'), attendance_session_id: existing?.attendance_session_id ? String(existing.attendance_session_id) : '' });
  }, [existing, selected]);

  const save = useMutation({
    mutationFn: (input: ClassJournalInput) => existing ? journalApi.updateClassJournal(accessToken!, existing.id, input) : journalApi.createClassJournal(accessToken!, input),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['class-journals', 'teacher'] }); toast.success('Đã lưu sổ đầu bài.'); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể lưu sổ đầu bài.'),
  });

  function choose(item: ClassJournalOption) { setSelected(item); }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    save.mutate({ timetable_item_id: selected.timetable_item_id, journal_date: date, lesson_content: form.lesson_content.trim() || null, class_comment: form.class_comment.trim() || null, progress_note: form.progress_note.trim() || null, homework: form.homework.trim() || null, attendance_session_id: form.attendance_session_id ? Number(form.attendance_session_id) : null, status: form.status });
  }

  return <TeacherPortalLayout><div className="grid gap-6"><header className="border-b border-slate-200 pb-6"><p className="text-sm font-semibold text-emerald-700">Học vụ · Sổ đầu bài</p><h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Ghi nhận tiết dạy</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Chọn tiết theo thời khóa biểu hiệu lực. Nếu có dạy thay hoặc đổi tiết, hệ thống xác định giáo viên và vị trí thực tế trước khi cho ghi sổ.</p></header><section className="flex flex-wrap items-end gap-3 border border-slate-200 bg-white p-4 shadow-sm"><label className="text-sm font-semibold text-slate-700">Ngày học<input type="date" value={date} onChange={(event) => { setDate(event.target.value); setSelected(null); }} className="mt-1 block rounded-md border border-slate-300 px-3 py-2 font-normal" /></label><p className="text-sm text-slate-500">Chỉ các tiết thuộc phân công hiệu lực của bạn mới xuất hiện.</p></section><div className="grid gap-6 xl:grid-cols-[minmax(18rem,.8fr)_minmax(0,1.2fr)]"><section><h2 className="mb-3 text-lg font-bold text-slate-950">Tiết trong ngày</h2>{options.isLoading ? <p className="border border-slate-200 bg-white p-6 text-sm text-slate-500">Đang tải thời khóa biểu...</p> : options.isError ? <p className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">Không thể tải tiết dạy.</p> : (options.data?.data.length ?? 0) === 0 ? <div className="border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Không có tiết dạy hiệu lực trong ngày này.</div> : <div className="grid gap-3">{options.data?.data.map((item) => { const journal = journals.data?.data.find((entry) => entry.timetable_item_id === item.timetable_item_id); return <button type="button" key={item.timetable_item_id} onClick={() => choose(item)} className={`border bg-white p-4 text-left shadow-sm transition ${selected?.timetable_item_id === item.timetable_item_id ? 'border-emerald-600 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-emerald-300'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-slate-500">Tiết {item.lesson_index} · {item.shift_name}</p><p className="mt-1 font-bold text-slate-950">{item.classroom_name}</p><p className="mt-1 text-sm text-emerald-700">{item.subject_name}</p></div>{journal ? journal.status === 'completed' ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : journal.status === 'cancelled' ? <XCircle className="h-5 w-5 text-red-600" /> : <Clock3 className="h-5 w-5 text-amber-600" /> : <span className="text-xs text-slate-400">Chưa ghi</span>}</div></button>; })}</div>}</section><section>{selected ? <form onSubmit={submit} className="border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4"><div><p className="text-xs font-bold uppercase text-slate-500">{selected.classroom_name} · Tiết {selected.lesson_index}</p><h2 className="mt-1 text-xl font-bold text-slate-950">{selected.subject_name}</h2><p className="mt-1 text-sm text-slate-500">Giáo viên hiệu lực: {selected.teacher_name || 'Chưa xác định'}{selected.override_type ? ` · ${selected.override_type}` : ''}</p></div><BookOpenCheck className="h-6 w-6 text-emerald-700" /></div><div className="mt-5 grid gap-4"><Area label="Nội dung đã dạy" value={form.lesson_content} onChange={(value) => setForm({ ...form, lesson_content: value })} rows={5} placeholder="Chủ đề, bài, hoạt động chính..." /><Area label="Nhận xét lớp" value={form.class_comment} onChange={(value) => setForm({ ...form, class_comment: value })} rows={3} placeholder="Tình hình học tập, kỷ luật, sự cố nếu có..." /><div className="grid gap-4 md:grid-cols-2"><Area label="Tiến độ chương trình" value={form.progress_note} onChange={(value) => setForm({ ...form, progress_note: value })} rows={3} placeholder="Ví dụ: Hoàn thành bài 12/18" /><Area label="Bài tập / dặn dò" value={form.homework} onChange={(value) => setForm({ ...form, homework: value })} rows={3} placeholder="Nội dung giao học sinh" /></div><label className="text-sm font-semibold text-slate-700">Trạng thái<select value={form.status} disabled={selected.is_cancelled} onChange={(event) => setForm({ ...form, status: event.target.value as ClassJournalStatus })} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal disabled:bg-slate-100"><option value="draft">Bản nháp</option><option value="completed">Đã xác nhận</option><option value="cancelled">Tiết hủy</option></select></label><button disabled={save.isPending} className="inline-flex w-fit items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Save className="h-4 w-4" />{save.isPending ? 'Đang lưu...' : existing ? 'Lưu cập nhật' : 'Lưu sổ đầu bài'}</button></div></form> : <div className="border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">Chọn một tiết bên trái để ghi nhận nội dung.</div>}</section></div></div></TeacherPortalLayout>;
}

function Area({ label, value, onChange, rows, placeholder }: { label: string; value: string; onChange: (value: string) => void; rows: number; placeholder?: string }) { return <label className="grid gap-1.5 text-sm font-semibold text-slate-700">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} placeholder={placeholder} className="rounded-md border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-500" /></label>; }
