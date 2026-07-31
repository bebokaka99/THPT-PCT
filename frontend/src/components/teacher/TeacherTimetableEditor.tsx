import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, Plus, Save, Trash2 } from 'lucide-react';
import {
  createClassroomTimetable,
  deleteClassroomTimetable,
  updateClassroomTimetable,
} from '../../services/classroom.service';
import { getAcademicPeriods } from '../../services/academicPeriod.service';
import { getCurriculum } from '../../services/subject.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type { Classroom, Timetable, TimetableItem } from '../../types/classroom';

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
  isActive: boolean;
  lessonCount: number;
  cells: Record<string, TimetableItem>;
};

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
    isActive: timetable?.is_active ?? true,
    lessonCount: Math.max(
      5,
      ...(timetable?.items.map((item) => item.lesson_index) ?? []),
    ),
    cells: Object.fromEntries(
      (timetable?.items ?? []).map((item) => [
        `${item.day_of_week}-${item.lesson_index}`,
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
  const { accessToken } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(() => createForm(classroom, timetable));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const periods = useQuery({
    queryKey: ['academic-periods'],
    queryFn: () => getAcademicPeriods(accessToken!),
    enabled: Boolean(accessToken),
  });

  useEffect(() => {
    setForm(createForm(classroom, timetable));
  }, [classroom, timetable]);

  useEffect(() => {
    if (form.academicYearId || !periods.data) return;
    const year =
      periods.data.find((item) => item.status === 'active') ??
      periods.data.find((item) => item.id === classroom.academic_year_id);
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
  const curriculum = useQuery({
    queryKey: [
      'curriculum',
      Number(form.academicYearId),
      classroom.grade_level,
    ],
    queryFn: () =>
      getCurriculum(accessToken!, {
        academic_year_id: Number(form.academicYearId),
        grade_level: classroom.grade_level ?? undefined,
        is_active: true,
      }),
    enabled: Boolean(
      accessToken && form.academicYearId && classroom.grade_level,
    ),
  });
  const curriculumOptions =
    curriculum.data?.filter((item) => item.subject_is_active) ?? [];

  const items = useMemo(
    () =>
      Object.values(form.cells)
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

  function updateCell(
    day: number,
    lesson: number,
    field: keyof TimetableItem,
    value: string,
  ) {
    const key = `${day}-${lesson}`;
    setForm((current) => {
      const previous = current.cells[key] ?? {
        day_of_week: day,
        lesson_index: lesson,
        subject_name: '',
        teacher_name: '',
        room: '',
        note: '',
      };
      return {
        ...current,
        cells: {
          ...current.cells,
          [key]: { ...previous, [field]: value },
        },
      };
    });
  }

  function selectSubject(day: number, lesson: number, value: string) {
    const key = `${day}-${lesson}`;
    setForm((current) => {
      const previous = current.cells[key] ?? {
        day_of_week: day,
        lesson_index: lesson,
        subject_name: '',
        teacher_name: '',
        room: '',
        note: '',
      };
      const selected = curriculumOptions.find(
        (item) => item.subject_id === Number(value),
      );
      return {
        ...current,
        cells: {
          ...current.cells,
          [key]: {
            ...previous,
            subject_id: selected?.subject_id ?? null,
            subject_name: selected?.subject_name ?? '',
          },
        },
      };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || isSaving) return;
    if (!form.title.trim() || !form.academicYearId) {
      setError('Vui lòng nhập tiêu đề và chọn năm học.');
      return;
    }
    try {
      setIsSaving(true);
      setError(null);
      const payload = {
        title: form.title.trim(),
        academic_year_id: Number(form.academicYearId),
        semester_id: form.semesterId ? Number(form.semesterId) : null,
        school_year: selectedYear?.name ?? form.schoolYear.trim(),
        semester:
          selectedYear?.semesters.find(
            (semester) => semester.id === Number(form.semesterId),
          )?.name ?? (form.semester.trim() || null),
        is_active: form.isActive,
        items,
      };
      if (timetable) {
        await updateClassroomTimetable(
          accessToken,
          classroom.id,
          timetable.id,
          payload,
        );
      } else {
        await createClassroomTimetable(accessToken, classroom.id, payload);
      }
      toast.success('Đã lưu thời khóa biểu.');
      await onChanged();
    } catch {
      setError('Không thể lưu thời khóa biểu. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (
      !accessToken ||
      !timetable ||
      isSaving ||
      !window.confirm('Xóa thời khóa biểu hiện tại?')
    ) {
      return;
    }
    try {
      setIsSaving(true);
      await deleteClassroomTimetable(accessToken, classroom.id, timetable.id);
      toast.success('Đã xóa thời khóa biểu.');
      await onChanged();
    } finally {
      setIsSaving(false);
    }
  }

  const lessons = Array.from({ length: form.lessonCount }, (_, index) => index + 1);

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-emerald-700" />
            <h2 className="font-bold text-slate-950">Thời khóa biểu lớp</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Nhập môn học theo từng ngày và tiết. Ô trống sẽ không được lưu.
          </p>
        </div>
        {timetable && (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Xóa thời khóa biểu
          </button>
        )}
      </div>

      <div className="grid gap-4 p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Tiêu đề
            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              className="rounded-md border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-600"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Năm học
            <select
              value={form.academicYearId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  academicYearId: event.target.value,
                  semesterId: '',
                  schoolYear:
                    periods.data?.find(
                      (year) => year.id === Number(event.target.value),
                    )?.name ?? '',
                  semester: '',
                }))
              }
              className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-600"
            >
              <option value="">Chọn năm học</option>
              {periods.data?.map((year) => (
                <option
                  key={year.id}
                  value={year.id}
                  disabled={
                    (year.is_locked || year.status === 'closed') &&
                    String(year.id) !== form.academicYearId
                  }
                >
                  {year.name}
                  {year.status === 'active' ? ' (đang áp dụng)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Học kỳ
            <select
              value={form.semesterId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  semesterId: event.target.value,
                  semester:
                    selectedYear?.semesters.find(
                      (semester) => semester.id === Number(event.target.value),
                    )?.name ?? '',
                }))
              }
              className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-600"
            >
              <option value="">Không gắn học kỳ</option>
              {selectedYear?.semesters.map((semester) => (
                <option
                  key={semester.id}
                  value={semester.id}
                  disabled={
                    (semester.is_locked || semester.status === 'closed') &&
                    String(semester.id) !== form.semesterId
                  }
                >
                  {semester.name}
                  {semester.status === 'active' ? ' (đang áp dụng)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                isActive: event.target.checked,
              }))
            }
            className="h-4 w-4"
          />
          Đặt làm thời khóa biểu đang áp dụng
        </label>

        {form.academicYearId &&
          classroom.grade_level &&
          !curriculum.isLoading &&
          curriculumOptions.length === 0 && (
            <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Chưa có môn học active trong chương trình khối{' '}
              {classroom.grade_level} của năm học đã chọn. Quản trị viên cần
              cấu hình tại mục Môn học &amp; chương trình trước khi xếp tiết
              mới.
            </p>
          )}

        <div className="overflow-x-auto border border-slate-200">
          <table className="min-w-[1120px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-r border-slate-200 bg-slate-50 p-3 text-left">
                  Tiết
                </th>
                {days.map((day) => (
                  <th
                    key={day.value}
                    className="border-b border-r border-slate-200 bg-slate-50 p-3 text-left last:border-r-0"
                  >
                    {day.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lessons.map((lesson) => (
                <tr key={lesson}>
                  <td className="border-b border-r border-slate-200 p-3 align-top font-semibold text-slate-600">
                    Tiết {lesson}
                  </td>
                  {days.map((day) => {
                    const cell = form.cells[`${day.value}-${lesson}`];
                    return (
                      <td
                        key={day.value}
                        className="border-b border-r border-slate-200 p-2 align-top last:border-r-0"
                      >
                        <div className="grid gap-1.5">
                          <select
                            value={
                              cell?.subject_id
                                ? String(cell.subject_id)
                                : cell?.subject_name
                                  ? 'legacy'
                                  : ''
                            }
                            onChange={(event) =>
                              selectSubject(
                                day.value,
                                lesson,
                                event.target.value,
                              )
                            }
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-semibold outline-none focus:border-emerald-600"
                          >
                            <option value="">Chọn môn</option>
                            {cell?.subject_name && !cell.subject_id && (
                              <option value="legacy" disabled>
                                {cell.subject_name} (legacy)
                              </option>
                            )}
                            {cell?.subject_id &&
                              !curriculumOptions.some(
                                (item) => item.subject_id === cell.subject_id,
                              ) && (
                                <option value={cell.subject_id} disabled>
                                  {cell.subject_name} (không còn active)
                                </option>
                              )}
                            {curriculumOptions.map((item) => (
                              <option
                                key={item.id}
                                value={item.subject_id}
                              >
                                {item.subject_name}
                              </option>
                            ))}
                          </select>
                          <input
                            value={cell?.teacher_name ?? ''}
                            onChange={(event) =>
                              updateCell(
                                day.value,
                                lesson,
                                'teacher_name',
                                event.target.value,
                              )
                            }
                            placeholder="Giáo viên"
                            className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-emerald-600"
                          />
                          <input
                            value={cell?.room ?? ''}
                            onChange={(event) =>
                              updateCell(day.value, lesson, 'room', event.target.value)
                            }
                            placeholder="Phòng"
                            className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-emerald-600"
                          />
                          <input
                            value={cell?.note ?? ''}
                            onChange={(event) =>
                              updateCell(day.value, lesson, 'note', event.target.value)
                            }
                            placeholder="Ghi chú"
                            className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-emerald-600"
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={form.lessonCount >= 10}
            onClick={() =>
              setForm((current) => ({
                ...current,
                lessonCount: Math.min(10, current.lessonCount + 1),
              }))
            }
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Thêm tiết
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Đang lưu...' : 'Lưu thời khóa biểu'}
          </button>
          <span className="text-xs text-slate-500">{items.length} tiết có dữ liệu</span>
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    </form>
  );
}
