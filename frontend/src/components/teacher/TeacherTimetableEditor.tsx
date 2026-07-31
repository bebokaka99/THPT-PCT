import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, Archive, CalendarDays, Save, Send, Trash2 } from 'lucide-react';
import {
  archiveClassroomTimetable,
  createClassroomTimetable,
  deleteClassroomTimetable,
  previewClassroomTimetableConflicts,
  publishClassroomTimetable,
  updateClassroomTimetable,
} from '../../services/classroom.service';
import { getAcademicPeriods } from '../../services/academicPeriod.service';
import {
  getMyTeachingAssignments,
  getTeachingAssignments,
} from '../../services/teachingAssignment.service';
import { getSchoolShifts } from '../../services/timetable.service';
import { ApiClientError } from '../../services/api-client';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type {
  Classroom,
  Timetable,
  TimetableConflict,
  TimetableInput,
  TimetableItem,
} from '../../types/classroom';

const days = [
  { value: 1, label: 'Thứ 2' },
  { value: 2, label: 'Thứ 3' },
  { value: 3, label: 'Thứ 4' },
  { value: 4, label: 'Thứ 5' },
  { value: 5, label: 'Thứ 6' },
  { value: 6, label: 'Thứ 7' },
];

type TimetableForm = {
  title: string;
  schoolYear: string;
  semester: string;
  academicYearId: string;
  semesterId: string;
  status: 'draft' | 'published' | 'archived';
  cells: Record<string, TimetableItem>;
};

function cellKey(shiftId: number, day: number, lesson: number) {
  return `${shiftId}-${day}-${lesson}`;
}

function createForm(classroom: Classroom, timetable: Timetable | null): TimetableForm {
  return {
    title: timetable?.title ?? `Thời khóa biểu ${classroom.name}`,
    schoolYear: timetable?.school_year ?? classroom.school_year,
    semester: timetable?.semester ?? '',
    academicYearId: timetable?.academic_year_id
      ? String(timetable.academic_year_id)
      : classroom.academic_year_id
        ? String(classroom.academic_year_id)
        : '',
    semesterId: timetable?.semester_id ? String(timetable.semester_id) : '',
    status: timetable?.status ?? 'draft',
    cells: Object.fromEntries(
      (timetable?.items ?? []).map((item) => [
        cellKey(item.shift_id, item.day_of_week, item.lesson_index),
        item,
      ]),
    ),
  };
}

export function TeacherTimetableEditor({
  classroom,
  onChanged,
  timetable,
}: {
  classroom: Classroom;
  onChanged: () => Promise<unknown>;
  timetable: Timetable | null;
}) {
  const { accessToken, roles } = useAuth();
  const toast = useToast();
  const isAdmin = roles.includes('admin');
  const [form, setForm] = useState(() => createForm(classroom, timetable));
  const [activeShiftId, setActiveShiftId] = useState<number | null>(null);
  const [conflicts, setConflicts] = useState<TimetableConflict[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periods = useQuery({
    queryKey: ['academic-periods'],
    queryFn: () => getAcademicPeriods(accessToken!),
    enabled: Boolean(accessToken),
  });
  const shifts = useQuery({
    queryKey: ['school-shifts'],
    queryFn: () => getSchoolShifts(accessToken!),
    enabled: Boolean(accessToken),
  });

  useEffect(() => {
    setForm(createForm(classroom, timetable));
    setConflicts([]);
  }, [classroom, timetable]);

  useEffect(() => {
    const available = shifts.data?.data.filter((shift) => shift.is_active) ?? [];
    if (!activeShiftId || !available.some((shift) => shift.id === activeShiftId)) {
      setActiveShiftId(available[0]?.id ?? null);
    }
  }, [activeShiftId, shifts.data]);

  useEffect(() => {
    if (form.academicYearId || !periods.data) return;
    const year = periods.data.find((item) => item.status === 'active')
      ?? periods.data.find((item) => item.id === classroom.academic_year_id);
    if (year) {
      setForm((current) => ({
        ...current,
        academicYearId: String(year.id),
        schoolYear: year.name,
      }));
    }
  }, [classroom.academic_year_id, form.academicYearId, periods.data]);

  const selectedYear = periods.data?.find(
    (year) => year.id === Number(form.academicYearId),
  );
  const assignments = useQuery({
    queryKey: ['timetable-assignments', classroom.id, form.semesterId, isAdmin],
    queryFn: () => {
      const query = {
        classroom_id: classroom.id,
        semester_id: Number(form.semesterId),
        status: 'active' as const,
        limit: 100,
      };
      return isAdmin
        ? getTeachingAssignments(accessToken!, query)
        : getMyTeachingAssignments(accessToken!, query);
    },
    enabled: Boolean(accessToken && form.semesterId),
  });
  const assignmentOptions = assignments.data?.data ?? [];

  const items = useMemo(
    () => Object.values(form.cells)
      .filter((item) => item.subject_name.trim())
      .map((item) => ({
        ...item,
        subject_name: item.subject_name.trim(),
        teacher_name: item.teacher_name?.trim() || null,
        room: item.room?.trim() || null,
        note: item.note?.trim() || null,
      })),
    [form.cells],
  );

  function emptyCell(shiftId: number, day: number, lesson: number): TimetableItem {
    return {
      shift_id: shiftId,
      day_of_week: day,
      lesson_index: lesson,
      subject_name: '',
      teacher_name: null,
      room: classroom.name,
      note: null,
    };
  }

  function updateCell(
    shiftId: number,
    day: number,
    lesson: number,
    field: 'room' | 'note',
    value: string,
  ) {
    const key = cellKey(shiftId, day, lesson);
    setForm((current) => ({
      ...current,
      cells: {
        ...current.cells,
        [key]: {
          ...(current.cells[key] ?? emptyCell(shiftId, day, lesson)),
          [field]: value,
        },
      },
    }));
    setConflicts([]);
  }

  function selectAssignment(shiftId: number, day: number, lesson: number, value: string) {
    const key = cellKey(shiftId, day, lesson);
    setForm((current) => {
      if (!value) {
        const nextCells = { ...current.cells };
        delete nextCells[key];
        return { ...current, cells: nextCells };
      }
      const selected = assignmentOptions.find((item) => item.id === Number(value));
      if (!selected) return current;
      const previous = current.cells[key] ?? emptyCell(shiftId, day, lesson);
      return {
        ...current,
        cells: {
          ...current.cells,
          [key]: {
            ...previous,
            subject_id: selected.subject_id,
            teaching_assignment_id: selected.id,
            teacher_user_id: selected.teacher_user_id,
            subject_name: selected.subject_name,
            teacher_name: selected.teacher_name,
          },
        },
      };
    });
    setConflicts([]);
  }

  function buildPayload(status = form.status): TimetableInput {
    return {
      title: form.title.trim(),
      academic_year_id: Number(form.academicYearId),
      semester_id: Number(form.semesterId),
      school_year: selectedYear?.name ?? form.schoolYear.trim(),
      semester: selectedYear?.semesters.find(
        (semester) => semester.id === Number(form.semesterId),
      )?.name ?? (form.semester.trim() || null),
      status,
      items,
    };
  }

  async function checkConflicts(payload = buildPayload('draft')) {
    if (!accessToken) return [];
    const response = await previewClassroomTimetableConflicts(
      accessToken,
      classroom.id,
      payload,
      timetable?.id,
    );
    setConflicts(response.data);
    return response.data;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || isSaving) return;
    if (!form.title.trim() || !form.academicYearId || !form.semesterId) {
      setError('Vui lòng nhập tiêu đề, chọn năm học và học kỳ.');
      return;
    }
    try {
      setIsSaving(true);
      setError(null);
      const payload = buildPayload();
      const found = await checkConflicts(payload);
      if (payload.status === 'published' && found.length > 0) {
        setError('Không thể công bố khi thời khóa biểu còn xung đột.');
        return;
      }
      if (timetable) {
        await updateClassroomTimetable(accessToken, classroom.id, timetable.id, payload);
      } else {
        await createClassroomTimetable(accessToken, classroom.id, payload);
      }
      toast.success(payload.status === 'published'
        ? 'Đã lưu và công bố thời khóa biểu.'
        : 'Đã lưu bản nháp thời khóa biểu.');
      await onChanged();
    } catch (caught) {
      setError(caught instanceof ApiClientError
        ? caught.message
        : 'Không thể lưu thời khóa biểu. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublish() {
    if (!accessToken || !timetable || isSaving) return;
    try {
      setIsSaving(true);
      setError(null);
      const found = await checkConflicts();
      if (found.length > 0) {
        setError('Hãy xử lý các xung đột trước khi công bố.');
        return;
      }
      await publishClassroomTimetable(accessToken, classroom.id, timetable.id);
      toast.success('Đã công bố thời khóa biểu.');
      await onChanged();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Không thể công bố thời khóa biểu.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchive() {
    if (!accessToken || !timetable || isSaving) return;
    try {
      setIsSaving(true);
      await archiveClassroomTimetable(accessToken, classroom.id, timetable.id);
      toast.success('Đã lưu trữ thời khóa biểu.');
      await onChanged();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!accessToken || !timetable || isSaving || !window.confirm('Xóa bản thời khóa biểu này?')) return;
    try {
      setIsSaving(true);
      await deleteClassroomTimetable(accessToken, classroom.id, timetable.id);
      toast.success('Đã xóa thời khóa biểu.');
      await onChanged();
    } finally {
      setIsSaving(false);
    }
  }

  const activeShifts = shifts.data?.data.filter((shift) => shift.is_active) ?? [];
  const activeShift = activeShifts.find((shift) => shift.id === activeShiftId);

  return (
    <form onSubmit={handleSubmit} className="border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-emerald-700" />
            <h2 className="font-bold text-slate-950">Xếp thời khóa biểu lớp</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Chọn phân công giảng dạy cho từng ca và tiết. Hệ thống kiểm tra trùng giáo viên, lớp và phòng.
          </p>
        </div>
        {timetable && (
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
            timetable.status === 'published'
              ? 'bg-emerald-100 text-emerald-800'
              : timetable.status === 'archived'
                ? 'bg-slate-200 text-slate-700'
                : 'bg-amber-100 text-amber-800'
          }`}>
            Phiên bản {timetable.version_number} · {timetable.status === 'published' ? 'Đã công bố' : timetable.status === 'archived' ? 'Đã lưu trữ' : 'Bản nháp'}
          </span>
        )}
      </div>

      <div className="grid gap-5 p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Tiêu đề
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-600" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Năm học
            <select value={form.academicYearId} onChange={(event) => setForm((current) => ({ ...current, academicYearId: event.target.value, semesterId: '', schoolYear: periods.data?.find((year) => year.id === Number(event.target.value))?.name ?? '', semester: '' }))} className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-600">
              <option value="">Chọn năm học</option>
              {periods.data?.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Học kỳ
            <select value={form.semesterId} onChange={(event) => setForm((current) => ({ ...current, semesterId: event.target.value, semester: selectedYear?.semesters.find((semester) => semester.id === Number(event.target.value))?.name ?? '' }))} className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-600">
              <option value="">Chọn học kỳ</option>
              {selectedYear?.semesters.map((semester) => <option key={semester.id} value={semester.id}>{semester.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Trạng thái khi lưu
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as TimetableForm['status'] }))} className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-600">
              <option value="draft">Bản nháp</option>
              <option value="published">Công bố</option>
              <option value="archived">Lưu trữ</option>
            </select>
          </label>
        </div>

        {!form.semesterId && (
          <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Chọn học kỳ để tải danh sách phân công giảng dạy.
          </p>
        )}
        {form.semesterId && !assignments.isLoading && assignmentOptions.length === 0 && (
          <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Chưa có phân công giảng dạy phù hợp cho lớp và học kỳ này.
          </p>
        )}

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Ca học">
          {activeShifts.map((shift) => (
            <button key={shift.id} type="button" onClick={() => setActiveShiftId(shift.id)} className={`rounded-md px-4 py-2 text-sm font-semibold ${activeShiftId === shift.id ? 'bg-blue-700 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>
              {shift.name} · {shift.periods.length} tiết
            </button>
          ))}
        </div>

        {activeShift ? (
          <div className="overflow-x-auto border border-slate-200">
            <table className="min-w-[1120px] border-collapse text-sm">
              <thead><tr><th className="border-b border-r border-slate-200 bg-slate-50 p-3 text-left">Tiết</th>{days.map((day) => <th key={day.value} className="border-b border-r border-slate-200 bg-slate-50 p-3 text-left last:border-r-0">{day.label}</th>)}</tr></thead>
              <tbody>
                {activeShift.periods.map((period) => (
                  <tr key={period.period_index}>
                    <td className="border-b border-r border-slate-200 p-3 align-top font-semibold text-slate-600">
                      Tiết {period.period_index}
                      <span className="mt-1 block text-xs font-normal text-slate-400">{period.starts_at}–{period.ends_at}</span>
                    </td>
                    {days.map((day) => {
                      const key = cellKey(activeShift.id, day.value, period.period_index);
                      const cell = form.cells[key];
                      return (
                        <td key={day.value} className="border-b border-r border-slate-200 p-2 align-top last:border-r-0">
                          <div className="grid gap-1.5">
                            <select value={cell?.teaching_assignment_id ? String(cell.teaching_assignment_id) : ''} onChange={(event) => selectAssignment(activeShift.id, day.value, period.period_index, event.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-semibold outline-none focus:border-emerald-600">
                              <option value="">Trống</option>
                              {cell?.teaching_assignment_id && !assignmentOptions.some((item) => item.id === cell.teaching_assignment_id) && <option value={cell.teaching_assignment_id} disabled>{cell.subject_name} · {cell.teacher_name} (không còn hiệu lực)</option>}
                              {assignmentOptions.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.subject_name} · {assignment.teacher_name}</option>)}
                            </select>
                            {cell?.subject_name && <p className="truncate text-xs text-slate-500">{cell.subject_name} · {cell.teacher_name}</p>}
                            <input value={cell?.room ?? ''} onChange={(event) => updateCell(activeShift.id, day.value, period.period_index, 'room', event.target.value)} placeholder="Phòng" className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-emerald-600" />
                            <input value={cell?.note ?? ''} onChange={(event) => updateCell(activeShift.id, day.value, period.period_index, 'note', event.target.value)} placeholder="Ghi chú" className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-emerald-600" />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-slate-500">Chưa có cấu hình ca học đang hoạt động.</p>}

        {conflicts.length > 0 && (
          <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" />Phát hiện {conflicts.length} xung đột</div>
            <ul className="mt-2 grid gap-1">{conflicts.map((conflict, index) => <li key={`${conflict.type}-${conflict.day_of_week}-${conflict.shift_id}-${conflict.lesson_index}-${index}`}>• {conflict.shift_name}, thứ {conflict.day_of_week + 1}, tiết {conflict.lesson_index}: {conflict.message}</li>)}</ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={isSaving || !form.semesterId} onClick={() => void checkConflicts()} className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50"><AlertTriangle className="h-4 w-4" />Kiểm tra xung đột</button>
          <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"><Save className="h-4 w-4" />{isSaving ? 'Đang lưu...' : 'Lưu thời khóa biểu'}</button>
          {timetable?.status === 'draft' && <button type="button" onClick={() => void handlePublish()} disabled={isSaving} className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Send className="h-4 w-4" />Công bố</button>}
          {timetable?.status === 'published' && <button type="button" onClick={() => void handleArchive()} disabled={isSaving} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"><Archive className="h-4 w-4" />Lưu trữ</button>}
          {timetable && timetable.status !== 'published' && <button type="button" onClick={() => void handleDelete()} disabled={isSaving} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" />Xóa</button>}
          <span className="text-xs text-slate-500">{items.length} tiết có dữ liệu</span>
        </div>
        {error && <p className="text-sm font-medium text-red-700">{error}</p>}
      </div>
    </form>
  );
}
