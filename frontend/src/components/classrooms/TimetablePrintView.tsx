import { CalendarDays, Printer } from 'lucide-react';
import type { Classroom, Timetable, TimetableItem } from '../../types/classroom';

const days = [
  { value: 1, label: 'Thứ 2' },
  { value: 2, label: 'Thứ 3' },
  { value: 3, label: 'Thứ 4' },
  { value: 4, label: 'Thứ 5' },
  { value: 5, label: 'Thứ 6' },
  { value: 6, label: 'Thứ 7' },
];

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function TimetableCell({ item }: { item?: TimetableItem }) {
  if (!item) return <span className="text-slate-300">—</span>;
  return (
    <div className="leading-snug">
      <p className="font-bold text-slate-950">{item.subject_name}</p>
      {item.teacher_name && <p className="mt-1 text-xs text-slate-500">{item.teacher_name}</p>}
      {item.room && <p className="mt-0.5 text-xs text-slate-500">Phòng {item.room}</p>}
      {item.note && <p className="mt-1 text-xs italic text-amber-700">{item.note}</p>}
    </div>
  );
}

function ShiftSchedule({ items, shiftId, shiftName }: { items: TimetableItem[]; shiftId: number; shiftName: string }) {
  const currentDay = new Date().getDay();
  const shiftItems = items.filter((item) => item.shift_id === shiftId);
  const maxLesson = Math.max(5, ...shiftItems.map((item) => item.lesson_index));
  const lessons = Array.from({ length: maxLesson }, (_, index) => index + 1);
  const itemBySlot = new Map(shiftItems.map((item) => [`${item.day_of_week}-${item.lesson_index}`, item]));

  return (
    <section className="border-t border-slate-200 first:border-t-0">
      <div className="bg-slate-50 px-5 py-3 text-sm font-bold text-blue-800">{shiftName}</div>
      <div className="timetable-desktop-view hidden overflow-x-auto md:block">
        <table className="timetable-print-table min-w-[780px] border-collapse text-sm">
          <thead><tr><th className="w-20 border-b border-r border-slate-200 bg-slate-50 p-3 text-left">Tiết</th>{days.map((day) => <th key={day.value} className={`border-b border-r border-slate-200 p-3 text-left last:border-r-0 ${currentDay === day.value ? 'bg-blue-50 text-blue-800' : 'bg-slate-50'}`}>{day.label}</th>)}</tr></thead>
          <tbody>{lessons.map((lesson) => <tr key={lesson}><td className="border-b border-r border-slate-200 p-3 align-top font-semibold text-slate-600">Tiết {lesson}</td>{days.map((day) => <td key={day.value} className={`border-b border-r border-slate-200 p-3 align-top last:border-r-0 ${currentDay === day.value ? 'bg-blue-50/40' : ''}`}><TimetableCell item={itemBySlot.get(`${day.value}-${lesson}`)} /></td>)}</tr>)}</tbody>
        </table>
      </div>
      <div className="timetable-mobile-view grid gap-4 p-4 md:hidden">
        {days.map((day) => {
          const dayItems = shiftItems.filter((item) => item.day_of_week === day.value).sort((left, right) => left.lesson_index - right.lesson_index);
          return (
            <section key={day.value} className={`border p-4 ${currentDay === day.value ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
              <h3 className="font-bold text-slate-950">{day.label}</h3>
              {dayItems.length === 0 ? <p className="mt-2 text-sm text-slate-400">Không có tiết học.</p> : <div className="mt-3 divide-y divide-slate-200">{dayItems.map((item) => <div key={item.id ?? `${item.lesson_index}-${item.subject_name}`} className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 py-3"><span className="text-xs font-semibold text-blue-700">Tiết {item.lesson_index}</span><TimetableCell item={item} /></div>)}</div>}
            </section>
          );
        })}
      </div>
    </section>
  );
}

export function TimetablePrintView({ classroom, timetable }: { classroom: Pick<Classroom, 'name'>; timetable: Timetable }) {
  const shifts = [...new Map(timetable.items.map((item) => [item.shift_id, item.shift_name ?? `Ca ${item.shift_id}`])).entries()];

  function handlePrint() {
    const cleanup = () => {
      document.body.classList.remove('printing-timetable');
      window.removeEventListener('afterprint', cleanup);
    };
    document.body.classList.add('printing-timetable');
    window.addEventListener('afterprint', cleanup);
    window.requestAnimationFrame(() => window.print());
  }

  return (
    <section className="timetable-print-root border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="timetable-print-school hidden text-center text-xs font-bold uppercase text-slate-700 print:block">Trường THPT Phan Chu Trinh - Phan Thiết</p>
            <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-blue-700 print:hidden" aria-hidden="true" /><h2 className="font-bold text-slate-950">{timetable.title}</h2><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">v{timetable.version_number}</span></div>
            <p className="mt-1 text-sm text-slate-500">Lớp {classroom.name} · Năm học {timetable.school_year}{timetable.semester ? ` · ${timetable.semester}` : ''}</p>
            <p className="mt-1 text-xs text-slate-400">Cập nhật: {formatUpdatedAt(timetable.updated_at)}</p>
          </div>
          <button type="button" onClick={handlePrint} className="timetable-print-actions inline-flex w-fit items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"><Printer className="h-4 w-4" aria-hidden="true" />In / Lưu PDF</button>
        </div>
      </div>
      {shifts.length > 0 ? shifts.map(([shiftId, shiftName]) => <ShiftSchedule key={shiftId} items={timetable.items} shiftId={shiftId} shiftName={shiftName} />) : <p className="p-6 text-sm text-slate-500">Thời khóa biểu chưa có tiết học.</p>}
      <p className="hidden border-t border-slate-200 pt-2 text-center text-[9px] text-slate-500 print:block">Thời khóa biểu được xuất từ Cổng thông tin THPT Phan Chu Trinh - Phan Thiết.</p>
    </section>
  );
}
