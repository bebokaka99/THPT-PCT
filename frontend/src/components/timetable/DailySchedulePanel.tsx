import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, CheckCircle2, Send, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  createScheduleOverride,
  getClassroomDailySchedule,
  getClassroomOverrides,
  getGuardianStudentDailySchedule,
  getScheduleOverrideOptions,
} from '../../services/scheduleOverride.service';
import type { DailyScheduleItem, ScheduleOverrideType } from '../../types/schedule-override';

const vietnamDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
}).format(new Date());

const dayLabels: Record<number, string> = {
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy',
  7: 'Chủ Nhật',
};

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
  guardianStudentId,
}: {
  classroomId: number;
  token: string;
  canManage?: boolean;
  guardianStudentId?: number;
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
    queryKey: ['daily-schedule', classroomId, guardianStudentId ?? 'member', date],
    queryFn: async () => {
      const response = guardianStudentId
        ? await getGuardianStudentDailySchedule(token, guardianStudentId, date)
        : await getClassroomDailySchedule(token, classroomId, date);
      return response.data;
    },
  });
  const overrides = useQuery({
    queryKey: ['schedule-overrides', classroomId, date],
    queryFn: async () => (await getClassroomOverrides(token, classroomId, date)).data,
    enabled: canManage,
  });
  const options = useQuery({
    queryKey: ['schedule-override-options', classroomId, selectedItemId],
    queryFn: async () => (
      await getScheduleOverrideOptions(token, classroomId, Number(selectedItemId))
    ).data,
    enabled: canManage && Number(selectedItemId) > 0,
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
      setReason('');
      setRoom('');
      setSubstituteId('');
      queryClient.invalidateQueries({ queryKey: ['schedule-overrides', classroomId] });
    },
  });

  const items = daily.data?.data ?? [];
  const selectableItems = useMemo(
    () => items.filter((item) => !item.is_cancelled),
    [items],
  );
  const selectedItem = selectableItems.find(
    (item) => item.timetable_item_id === Number(selectedItemId),
  );
  const selectedShift = options.data?.shifts.find(
    (shift) => shift.id === Number(newShift),
  );

  useEffect(() => {
    if (!selectedItem) return;
    setNewDay(String(selectedItem.day_of_week));
    setNewShift(String(selectedItem.shift_id));
    setNewLesson(String(selectedItem.lesson_index));
    setSubstituteId('');
  }, [selectedItem]);

  useEffect(() => {
    if (!selectedShift || selectedShift.periods.some(
      (period) => period.period_index === Number(newLesson),
    )) return;
    setNewLesson(String(selectedShift.periods[0]?.period_index ?? ''));
  }, [newLesson, selectedShift]);

  const isReady = Boolean(selectedItem && reason.trim() && (
    (overrideType === 'room_change' && room.trim())
    || (overrideType === 'substitute' && Number(substituteId) > 0)
    || (overrideType === 'reschedule'
      && Number(newDay) >= 1
      && Number(newDay) <= 7
      && Number(newShift) > 0
      && Number(newLesson) > 0)
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
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setSelectedItemId('');
              }}
              className="mt-1 block rounded-md border border-slate-300 px-3 py-2 font-normal"
            />
          </label>
        </div>
        {daily.isLoading ? (
          <p className="mt-5 text-sm text-slate-500">Đang tải lịch...</p>
        ) : daily.isError ? (
          <p className="mt-5 text-sm text-red-700">Không thể tải lịch trong ngày.</p>
        ) : items.length === 0 ? (
          <p className="mt-5 border border-dashed border-slate-300 p-5 text-sm text-slate-500">
            Không có tiết học đã công bố trong ngày này.
          </p>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {items.map((item) => (
              <article
                key={`${item.timetable_item_id}-${item.day_of_week}-${item.shift_id}-${item.lesson_index}`}
                className={`border p-4 ${item.is_cancelled
                  ? 'border-red-200 bg-red-50'
                  : item.override_id
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-slate-200 bg-slate-50'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">{item.subject_name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.shift_name} · Tiết {item.lesson_index} · {item.classroom_name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.teacher_name || 'Chưa có giáo viên'}
                      {item.room ? ` · Phòng ${item.room}` : ''}
                    </p>
                  </div>
                  {item.is_cancelled
                    ? <XCircle className="h-5 w-5 text-red-600" />
                    : item.override_id
                      ? <AlertTriangle className="h-5 w-5 text-amber-600" />
                      : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                </div>
                {item.override_id && (
                  <p className="mt-3 text-xs font-semibold text-amber-800">
                    Đã áp dụng thay đổi: {typeLabel(item.override_type!)}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {canManage && (
        <section className="border border-emerald-200 bg-emerald-50/50 p-5">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-emerald-700" />
            <h2 className="font-bold text-slate-950">Đề xuất thay đổi lịch</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Giáo viên gửi đề xuất. Quản trị viên sẽ kiểm tra xung đột và công bố.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Tiết gốc
              <select
                value={selectedItemId}
                onChange={(event) => setSelectedItemId(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal"
              >
                <option value="">Chọn tiết cần thay đổi</option>
                {selectableItems.map((item) => (
                  <option key={item.timetable_item_id} value={item.timetable_item_id}>
                    {itemLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Loại thay đổi
              <select
                value={overrideType}
                onChange={(event) => setOverrideType(event.target.value as ScheduleOverrideType)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal"
              >
                <option value="room_change">Đổi phòng</option>
                <option value="substitute">Dạy thay</option>
                <option value="reschedule">Đổi tiết</option>
                <option value="cancelled">Báo nghỉ</option>
              </select>
            </label>

            {overrideType === 'room_change' && (
              <label className="text-sm font-semibold text-slate-700">
                Phòng mới
                <input
                  value={room}
                  onChange={(event) => setRoom(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal"
                  placeholder="Ví dụ: B203"
                />
              </label>
            )}

            {overrideType === 'substitute' && (
              <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                Giáo viên thay thế
                <select
                  value={substituteId}
                  onChange={(event) => setSubstituteId(event.target.value)}
                  disabled={options.isLoading || !selectedItemId}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal disabled:bg-slate-100"
                >
                  <option value="">
                    {options.isLoading ? 'Đang tải giáo viên phù hợp...' : 'Chọn giáo viên đã được phân công đúng môn'}
                  </option>
                  {options.data?.substitute_teachers.map((teacher) => (
                    <option key={teacher.user_id} value={teacher.user_id}>
                      {teacher.full_name}{teacher.email ? ` · ${teacher.email}` : ''}
                    </option>
                  ))}
                </select>
                {selectedItemId && !options.isLoading && options.data?.substitute_teachers.length === 0 && (
                  <span className="mt-1 block text-xs font-normal text-amber-700">
                    Chưa có giáo viên khác được phân công đúng môn, lớp và học kỳ.
                  </span>
                )}
              </label>
            )}

            {overrideType === 'reschedule' && (
              <div className="grid gap-3 md:col-span-2 sm:grid-cols-3">
                <label className="text-sm font-semibold text-slate-700">
                  Ngày học mới
                  <select value={newDay} onChange={(event) => setNewDay(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
                    <option value="">Chọn thứ</option>
                    {Object.entries(dayLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Ca học
                  <select value={newShift} onChange={(event) => setNewShift(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
                    <option value="">Chọn ca</option>
                    {options.data?.shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Tiết
                  <select value={newLesson} onChange={(event) => setNewLesson(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
                    <option value="">Chọn tiết</option>
                    {selectedShift?.periods.map((period) => (
                      <option key={period.period_index} value={period.period_index}>
                        Tiết {period.period_index} · {period.starts_at}-{period.ends_at}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <label className="text-sm font-semibold text-slate-700 md:col-span-2">
              Lý do
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal"
                placeholder="Nêu lý do để quản trị viên kiểm tra"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={!isReady || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {createMutation.isPending ? 'Đang gửi...' : 'Gửi đề xuất'}
          </button>
          {createMutation.isError && (
            <p className="mt-3 text-sm text-red-700">
              Không thể gửi đề xuất. Kiểm tra phân công, ngày và xung đột lịch.
            </p>
          )}
          {createMutation.isSuccess && (
            <p className="mt-3 text-sm font-semibold text-emerald-800">
              Đã gửi đề xuất, chờ quản trị viên công bố.
            </p>
          )}
        </section>
      )}

      {canManage && (overrides.data?.length ?? 0) > 0 && (
        <section className="border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-950">Đề xuất trong ngày</h2>
          <div className="mt-3 grid gap-2">
            {overrides.data?.map((override) => (
              <div key={override.id} className="flex flex-col gap-1 border-b border-slate-100 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span><strong>{typeLabel(override.override_type)}</strong> · {override.subject_name} · {override.reason}</span>
                <span className="text-xs font-semibold uppercase text-amber-700">{override.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
