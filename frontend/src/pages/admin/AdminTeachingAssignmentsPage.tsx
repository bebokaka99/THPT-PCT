import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpenCheck,
  Check,
  Pencil,
  Search,
  UserRoundCheck,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getAcademicPeriods } from '../../services/academicPeriod.service';
import { getAdminUsers } from '../../services/adminUser.service';
import { getClassrooms } from '../../services/classroom.service';
import { getCurriculum } from '../../services/subject.service';
import * as assignmentApi from '../../services/teachingAssignment.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type {
  TeachingAssignment,
  TeachingAssignmentRole,
  TeachingAssignmentStatus,
} from '../../types/teaching-assignment';

const roleLabels: Record<TeachingAssignmentRole, string> = {
  primary: 'Giáo viên chính',
  assistant: 'Phối hợp giảng dạy',
};

function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date());
}

export function AdminTeachingAssignmentsPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<{
    q: string;
    status: '' | TeachingAssignmentStatus;
  }>({ q: '', status: 'active' });
  const [form, setForm] = useState({
    teacherUserId: '',
    classroomId: '',
    semesterId: '',
    subjectIds: [] as number[],
    role: 'primary' as TeachingAssignmentRole,
    assignedAt: '',
    note: '',
  });
  const [editing, setEditing] = useState<{
    id: number;
    role: TeachingAssignmentRole;
    note: string;
  } | null>(null);

  const teachers = useQuery({
    queryKey: ['admin', 'assignment-teachers'],
    queryFn: () =>
      getAdminUsers(accessToken!, {
        page: 1,
        limit: 100,
        role: 'teacher',
        status: 'active',
      }),
    enabled: Boolean(accessToken),
  });
  const classrooms = useQuery({
    queryKey: ['admin', 'assignment-classrooms'],
    queryFn: () =>
      getClassrooms(accessToken!, { page: 1, limit: 100, is_active: true }),
    enabled: Boolean(accessToken),
  });
  const periods = useQuery({
    queryKey: ['academic-periods'],
    queryFn: () => getAcademicPeriods(accessToken!),
    enabled: Boolean(accessToken),
  });
  const selectedClassroom = classrooms.data?.data.find(
    (item) => item.id === Number(form.classroomId),
  );
  const selectedYear = periods.data?.find(
    (item) => item.id === selectedClassroom?.academic_year_id,
  );
  const availableSemesters = selectedYear?.semesters ?? [];
  const selectedSemester = availableSemesters.find(
    (item) => item.id === Number(form.semesterId),
  );
  const curriculum = useQuery({
    queryKey: [
      'curriculum',
      selectedClassroom?.academic_year_id,
      selectedClassroom?.grade_level,
    ],
    queryFn: () =>
      getCurriculum(accessToken!, {
        academic_year_id: selectedClassroom!.academic_year_id!,
        grade_level: selectedClassroom!.grade_level!,
        is_active: true,
      }),
    enabled: Boolean(
      accessToken &&
        selectedClassroom?.academic_year_id &&
        selectedClassroom?.grade_level,
    ),
  });
  const assignments = useQuery({
    queryKey: ['admin', 'teaching-assignments', page, filters],
    queryFn: () =>
      assignmentApi.getTeachingAssignments(accessToken!, {
        page,
        limit: 20,
        q: filters.q || undefined,
        status: filters.status || undefined,
      }),
    enabled: Boolean(accessToken),
  });

  useEffect(() => {
    if (!selectedSemester) return;
    setForm((current) => ({
      ...current,
      assignedAt: current.assignedAt || selectedSemester.start_date,
    }));
  }, [selectedSemester]);

  const mutation = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'teaching-assignments'],
      });
    },
  });

  const rows = assignments.data?.data ?? [];
  const selectedSubjects = useMemo(
    () => new Set(form.subjectIds),
    [form.subjectIds],
  );

  function selectClassroom(classroomId: string) {
    setForm((current) => ({
      ...current,
      classroomId,
      semesterId: '',
      subjectIds: [],
      assignedAt: '',
    }));
  }

  function selectSemester(semesterId: string) {
    const semester = availableSemesters.find(
      (item) => item.id === Number(semesterId),
    );
    setForm((current) => ({
      ...current,
      semesterId,
      assignedAt: semester?.start_date ?? '',
    }));
  }

  function toggleSubject(subjectId: number) {
    setForm((current) => ({
      ...current,
      subjectIds: current.subjectIds.includes(subjectId)
        ? current.subjectIds.filter((id) => id !== subjectId)
        : [...current.subjectIds, subjectId],
    }));
  }

  async function submitAssignments(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !selectedSemester || form.subjectIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một môn học.');
      return;
    }
    const items = form.subjectIds.map((subjectId) => ({
      teacher_user_id: Number(form.teacherUserId),
      classroom_id: Number(form.classroomId),
      subject_id: subjectId,
      semester_id: Number(form.semesterId),
      role: form.role,
      assigned_at: form.assignedAt,
      note: form.note.trim() || null,
    }));
    await mutation.mutateAsync(() =>
      assignmentApi.createTeachingAssignmentsBulk(accessToken, items),
    );
    toast.success(`Đã tạo ${items.length} phân công giảng dạy.`);
    setForm((current) => ({
      ...current,
      subjectIds: [],
      note: '',
    }));
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !editing) return;
    await mutation.mutateAsync(() =>
      assignmentApi.updateTeachingAssignment(accessToken, editing.id, {
        role: editing.role,
        note: editing.note.trim() || null,
      }),
    );
    toast.success('Đã cập nhật phân công.');
    setEditing(null);
  }

  function effectiveDate(item: TeachingAssignment) {
    const semester = periods.data
      ?.flatMap((year) => year.semesters)
      .find((entry) => entry.id === item.semester_id);
    const current = today();
    if (!semester) return item.assigned_at;
    if (current < item.assigned_at) return item.assigned_at;
    if (current > semester.end_date) return semester.end_date;
    return current;
  }

  async function toggleStatus(item: TeachingAssignment) {
    if (!accessToken) return;
    const status = item.status === 'active' ? 'inactive' : 'active';
    await mutation.mutateAsync(() =>
      assignmentApi.setTeachingAssignmentStatus(
        accessToken,
        item.id,
        status,
        status === 'active' ? item.assigned_at : effectiveDate(item),
      ),
    );
    toast.success(
      status === 'active'
        ? 'Đã kích hoạt lại phân công.'
        : 'Đã kết thúc phân công.',
    );
  }

  return (
    <AdminLayout>
      <section className="grid min-w-0 gap-6">
        <header className="border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-violet-50 text-violet-700">
              <UserRoundCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-violet-700">
                Quản lý học vụ
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">
                Phân công giảng dạy
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Xác định giáo viên dạy đúng môn, lớp và học kỳ. Phân công này
                độc lập với vai trò chủ nhiệm.
              </p>
            </div>
          </div>
        </header>

        <form
          onSubmit={(event) => void submitAssignments(event)}
          className="border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="font-bold text-slate-950">Tạo phân công</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Giáo viên
              <select
                required
                value={form.teacherUserId}
                onChange={(event) =>
                  setForm({ ...form, teacherUserId: event.target.value })
                }
                className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal"
              >
                <option value="">Chọn giáo viên</option>
                {teachers.data?.data.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.full_name} ({teacher.email || teacher.username})
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Lớp học
              <select
                required
                value={form.classroomId}
                onChange={(event) => selectClassroom(event.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal"
              >
                <option value="">Chọn lớp</option>
                {classrooms.data?.data.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.name} - {classroom.school_year}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Học kỳ
              <select
                required
                value={form.semesterId}
                onChange={(event) => selectSemester(event.target.value)}
                disabled={!selectedClassroom}
                className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal disabled:bg-slate-100"
              >
                <option value="">Chọn học kỳ</option>
                {availableSemesters.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Vai trò
              <select
                value={form.role}
                onChange={(event) =>
                  setForm({
                    ...form,
                    role: event.target.value as TeachingAssignmentRole,
                  })
                }
                className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal"
              >
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Ngày bắt đầu
              <input
                required
                type="date"
                value={form.assignedAt}
                min={selectedSemester?.start_date}
                max={selectedSemester?.end_date}
                onChange={(event) =>
                  setForm({ ...form, assignedAt: event.target.value })
                }
                className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700 md:col-span-2">
              Ghi chú
              <input
                value={form.note}
                onChange={(event) =>
                  setForm({ ...form, note: event.target.value })
                }
                className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>
          </div>

          <fieldset className="mt-5">
            <legend className="text-sm font-bold text-slate-800">
              Môn trong chương trình lớp
            </legend>
            {!selectedClassroom ? (
              <p className="mt-2 text-sm text-slate-500">
                Chọn lớp để tải chương trình môn học.
              </p>
            ) : curriculum.isLoading ? (
              <div className="mt-3 h-16 animate-pulse bg-slate-50" />
            ) : (curriculum.data?.length ?? 0) === 0 ? (
              <p className="mt-2 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Lớp chưa có chương trình môn học. Hãy cấu hình tại “Môn học &
                chương trình”.
              </p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {curriculum.data?.map((entry) => (
                  <label
                    key={entry.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm ${
                      selectedSubjects.has(entry.subject_id)
                        ? 'border-violet-300 bg-violet-50'
                        : 'border-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSubjects.has(entry.subject_id)}
                      onChange={() => toggleSubject(entry.subject_id)}
                    />
                    <span>
                      <strong className="block text-slate-900">
                        {entry.subject_name}
                      </strong>
                      <span className="text-xs text-slate-500">
                        {entry.subject_code} · {entry.periods_per_week} tiết/tuần
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <button
            disabled={mutation.isPending}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            Lưu {form.subjectIds.length || ''} phân công
          </button>
        </form>

        {editing && (
          <form
            onSubmit={(event) => void saveEdit(event)}
            className="border border-violet-200 bg-violet-50 p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold text-slate-950">Chỉnh sửa phân công</h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Đóng chỉnh sửa"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_2fr_auto]">
              <select
                value={editing.role}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    role: event.target.value as TeachingAssignmentRole,
                  })
                }
                className="rounded-md border border-slate-300 bg-white px-3 py-2.5"
              >
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                value={editing.note}
                onChange={(event) =>
                  setEditing({ ...editing, note: event.target.value })
                }
                placeholder="Ghi chú"
                className="rounded-md border border-slate-300 px-3 py-2.5"
              />
              <button className="rounded-md bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white">
                Lưu
              </button>
            </div>
          </form>
        )}

        <div className="min-w-0 overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-[1fr_220px]">
            <label className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={filters.q}
                onChange={(event) => {
                  setPage(1);
                  setFilters({ ...filters, q: event.target.value });
                }}
                placeholder="Tìm giáo viên, lớp hoặc môn"
                className="w-full rounded-md border border-slate-300 py-2.5 pl-9 pr-3 text-sm"
              />
            </label>
            <select
              value={filters.status}
              onChange={(event) => {
                setPage(1);
                setFilters({
                  ...filters,
                  status: event.target.value as '' | TeachingAssignmentStatus,
                });
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hiệu lực</option>
              <option value="inactive">Đã kết thúc</option>
            </select>
          </div>

          {assignments.isLoading ? (
            <div className="h-44 animate-pulse bg-slate-50" />
          ) : assignments.isError ? (
            <p className="p-8 text-center text-sm text-red-700">
              Không thể tải danh sách phân công.
            </p>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              <BookOpenCheck className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3">Chưa có phân công phù hợp.</p>
            </div>
          ) : (
            <div className="max-w-full overflow-x-auto">
              <table className="min-w-[1050px] divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Giáo viên</th>
                    <th className="px-4 py-3">Lớp / Năm học</th>
                    <th className="px-4 py-3">Môn / Học kỳ</th>
                    <th className="px-4 py-3">Vai trò</th>
                    <th className="px-4 py-3">Hiệu lực</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-950">
                          {item.teacher_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.teacher_email || 'Không có email'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{item.classroom_name}</p>
                        <p className="text-xs text-slate-500">
                          {item.academic_year_name}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{item.subject_name}</p>
                        <p className="text-xs text-slate-500">
                          {item.subject_code} · {item.semester_name}
                        </p>
                      </td>
                      <td className="px-4 py-3">{roleLabels[item.role]}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            item.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {item.status === 'active'
                            ? 'Đang hiệu lực'
                            : 'Đã kết thúc'}
                        </span>
                        <p className="mt-2 text-xs text-slate-500">
                          {item.assigned_at}
                          {item.ended_at ? ` - ${item.ended_at}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {item.status === 'active' && (
                            <button
                              type="button"
                              onClick={() =>
                                setEditing({
                                  id: item.id,
                                  role: item.role,
                                  note: item.note || '',
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 font-semibold"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Sửa
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void toggleStatus(item)}
                            className="rounded-md border border-violet-200 px-3 py-1.5 font-semibold text-violet-700"
                          >
                            {item.status === 'active'
                              ? 'Kết thúc'
                              : 'Kích hoạt'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-slate-100 p-4 text-sm">
            <span className="text-slate-500">
              {assignments.data?.meta.total ?? 0} phân công
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40"
              >
                Trước
              </button>
              <button
                type="button"
                disabled={page >= (assignments.data?.meta.totalPages ?? 1)}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        </div>
      </section>
    </AdminLayout>
  );
}
