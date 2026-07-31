import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, CheckCircle2, Send, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  createScheduleOverride,
  getClassroomDailySchedule,
  getClassroomOverrides,
} from '../../services/scheduleOverride.service';
import type { DailyScheduleItem, ScheduleOverrideType } from '../../types/schedule-override';

const vietnamDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

function typeLabel(type: ScheduleOverrideType) {
  return {
    substitute: 'Dạy thay',
    reschedule: 'Đổi tiết',
    room_change: 'Đổi phòng',
    cancelled: 'Báo nghỉ',
  }[type];
}

function itemLabel(item: DailyScheduleItem) {
  return `${item.shift_name} - Tiết ${item.lesson_index}: ${item.subject_name}`;
}

export function DailySchedulePanel({
  classroomId,
  token,
  canManage = false,
}: {
  classroomId: number;
  token: string;
  canManage?: boolean;
}) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(vietnamDate);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [overrideType, setOverrideType] = useState<ScheduleOverrideType>('room_change');
  const [reason, setReason] = useState('');
  const [room, setRoom] = useState('');
  const [substituteId, setSubstituteId] = useState('');
  const [newDay, setNewDay] = useState('');
  const [newShift, setNewShift] = useState('');
  const [newLesson, setNewLesson] = useState('');

  const daily = useQuery({
    queryKey: ['daily-schedule', classroomId, date],
    queryFn: async () => (await getClassroomDailySchedule(token, classroomId, date)).data,
  });
  const overrides = useQuery({
    queryKey: ['schedule-overrides', classroomId, date],
    queryFn: async () => (await getClassroomOverrides(token, classroomId, date)).data,
  });
  const createMutation = useMutation({
    mutationFn: () => createScheduleOverride(token, classroomId, {
      timetable_item_id: Number(selectedItemId),
      override_date: date,
      override_type: overrideType,
      reason: reason.trim(),
      room: overrideType === 'room_change' ? room.trim() : null,
      substitute_teacher_user_id: overrideType === 'substitute' ? Number(substituteId) : null,
      new_day_of_week: overrideType === 'reschedule' ? Number(newDay) : null,
      new_shift_id: overrideType === 'reschedule' ? Number(newShift) : null,
      new_lesson_index: overrideType === 'reschedule' ? Number(newLesson) : null,
    }),
    onSuccess: () => {
      setReason(''); setRoom(''); setSubstituteId(''); setNewDay(''); setNewShift(''); setNewLesson('');
      queryClient.invalidateQueries({ queryKey: ['schedule-overrides', classroomId] });
    },
  });

  const items = daily.data?.data ?? [];
  const selectableItems = useMemo(() => items.filter((item) => !item.is_cancelled), [items]);
  const isReady = Boolean(selectedItemId && reason.trim() && (
    (overrideType === 'room_change' && room.trim())
    || (overrideType === 'substitute' && Number(substituteId) > 0)
    || (overrideType === 'reschedule' && Number(newDay) >= 1 && Number(newDay) <= 7 && Number(newShift) > 0 && Number(newLesson) > 0)
    || overrideType === 'cancelled'
  ));

  return (
    <div className="grid gap-6">
      <section className="border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Lịch trong ngày</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Theo dõi thay đổi theo ngày</h2>
          </div>
          <label className="text-sm font-semibold text-slate-700">
            Ngày
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 block rounded-md border border-slate-300 px-3 py-2 font-normal" />
          </label>
        </div>
        {daily.isLoading ? <p className="mt-5 text-sm text-slate-500">Đang tải lịch...</p> : daily.isError ? <p className="mt-5 text-sm text-red-700">Không thể tải lịch trong ngày.</p> : items.length === 0 ? <p className="mt-5 border border-dashed border-slate-300 p-5 text-sm text-slate-500">Không có tiết học đã công bố trong ngày này.</p> : (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {items.map((item) => (
              <article key={item.timetable_item_id} className={`border p-4 ${item.is_cancelled ? 'border-red-200 bg-red-50' : item.override_id ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">{item.subject_name}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.shift_name} · Tiết {item.lesson_index} · {item.classroom_name}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.teacher_name || 'Chưa có giáo viên'} {item.room ? `· Phòng ${item.room}` : ''}</p>
                  </div>
                  {item.is_cancelled ? <XCircle className="h-5 w-5 text-red-600" /> : item.override_id ? <AlertTriangle className="h-5 w-5 text-amber-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                </div>
                {item.override_id && <p className="mt-3 text-xs font-semibold text-amber-800">Đã áp dụng thay đổi: {typeLabel(item.override_type!)}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      {canManage && (
        <section className="border border-emerald-200 bg-emerald-50/50 p-5">
          <div className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-emerald-700" /><h2 className="font-bold text-slate-950">Đề xuất thay đổi lịch</h2></div>
          <p className="mt-1 text-sm text-slate-600">Giáo viên gửi đề xuất. Quản trị viên sẽ kiểm tra xung đột và công bố.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">Tiết gốc
              <select value={selectedItemId} onChange={(event) => setSelectedItemId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
                <option value="">Chọn tiết cần thay đổi</option>
                {selectableItems.map((item) => <option key={item.timetable_item_id} value={item.timetable_item_id}>{itemLabel(item)}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">Loại thay đổi
              <select value={overrideType} onChange={(event) => setOverrideType(event.target.value as ScheduleOverrideType)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
                <option value="room_change">Đổi phòng</option><option value="substitute">Dạy thay</option><option value="reschedule">Đổi tiết</option><option value="cancelled">Báo nghỉ</option>
              </select>
            </label>
            {overrideType === 'room_change' && <label className="text-sm font-semibold text-slate-700">Phòng mới<input value={room} onChange={(event) => setRoom(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal" placeholder="Ví dụ: B203" /></label>}
            {overrideType === 'substitute' && <label className="text-sm font-semibold text-slate-700">ID giáo viên thay thế<input type="number" min="1" value={substituteId} onChange={(event) => setSubstituteId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal" placeholder="ID tài khoản giáo viên" /></label>}
            {overrideType === 'reschedule' && <div className="grid grid-cols-3 gap-2"><label className="text-sm font-semibold text-slate-700">Thứ<input type="number" min="1" max="7" value={newDay} onChange={(event) => setNewDay(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 font-normal" /></label><label className="text-sm font-semibold text-slate-700">Ca ID<input type="number" min="1" value={newShift} onChange={(event) => setNewShift(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 font-normal" /></label><label className="text-sm font-semibold text-slate-700">Tiết<input type="number" min="1" value={newLesson} onChange={(event) => setNewLesson(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 font-normal" /></label></div>}
            <label className="text-sm font-semibold text-slate-700 md:col-span-2">Lý do<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal" placeholder="Nêu lý do để quản trị viên kiểm tra" /></label>
          </div>
          <button type="button" disabled={!isReady || createMutation.isPending} onClick={() => createMutation.mutate()} className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{createMutation.isPending ? 'Đang gửi...' : 'Gửi đề xuất'}</button>
          {createMutation.isError && <p className="mt-3 text-sm text-red-700">Không thể gửi đề xuất. Kiểm tra assignment, ngày và xung đột lịch.</p>}
          {createMutation.isSuccess && <p className="mt-3 text-sm font-semibold text-emerald-800">Đã gửi đề xuất, chờ quản trị viên công bố.</p>}
        </section>
      )}

      {canManage && (overrides.data?.length ?? 0) > 0 && (
        <section className="border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-950">Đề xuất trong ngày</h2><div className="mt-3 grid gap-2">{overrides.data?.map((override) => <div key={override.id} className="flex flex-col gap-1 border-b border-slate-100 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span><strong>{typeLabel(override.override_type)}</strong> · {override.subject_name} · {override.reason}</span><span className="text-xs font-semibold uppercase text-amber-700">{override.status}</span></div>)}</div></section>
      )}
    </div>
  );
}
