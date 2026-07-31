import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRightLeft,
  GraduationCap,
  History,
  Plus,
  Search,
  UserCheck,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getAcademicPeriods } from '../../services/academicPeriod.service';
import { getAdminUsers } from '../../services/adminUser.service';
import { getClassrooms } from '../../services/classroom.service';
import * as enrollmentApi from '../../services/enrollment.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type {
  EnrollmentStatus,
  StudentEnrollment,
} from '../../types/enrollment';

const statusLabels: Record<EnrollmentStatus, string> = {
  active: 'Đang học',
  transferred: 'Đã chuyển lớp',
  reserved: 'Bảo lưu',
  withdrawn: 'Đã thôi học',
  graduated: 'Đã tốt nghiệp',
};

function localDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date());
}

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN').format(
    new Date(`${value}T00:00:00`),
  );
}

type ActionState = {
  enrollment: StudentEnrollment;
  mode: 'transfer' | 'end';
  targetClassroomId: string;
  status: 'reserved' | 'withdrawn' | 'graduated';
  effectiveDate: string;
  note: string;
};

export function AdminEnrollmentsPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    q: '',
    academicYearId: '',
    classroomId: searchParams.get('classroom_id') ?? '',
    status: '',
  });
  const [studentSearch, setStudentSearch] = useState('');
  const [assignForm, setAssignForm] = useState({
    studentUserId: '',
    classroomId: '',
    enrolledAt: localDate(),
    note: '',
  });
  const [action, setAction] = useState<ActionState | null>(null);

  const periods = useQuery({
    queryKey: ['academic-periods'],
    queryFn: () => getAcademicPeriods(accessToken!),
    enabled: Boolean(accessToken),
  });
  const classrooms = useQuery({
    queryKey: ['admin', 'classrooms', 'enrollment-options'],
    queryFn: () =>
      getClassrooms(accessToken!, { page: 1, limit: 50, is_active: true }),
    enabled: Boolean(accessToken),
  });
  const students = useQuery({
    queryKey: ['admin', 'student-options', studentSearch],
    queryFn: () =>
      getAdminUsers(accessToken!, {
        page: 1,
        limit: 50,
        q: studentSearch || undefined,
        role: 'student',
        status: 'active',
      }),
    enabled: Boolean(accessToken),
  });
  const enrollments = useQuery({
    queryKey: ['admin', 'enrollments', page, filters],
    queryFn: () =>
      enrollmentApi.getEnrollments(accessToken!, {
        page,
        limit: 20,
        q: filters.q || undefined,
        academic_year_id: filters.academicYearId
          ? Number(filters.academicYearId)
          : undefined,
        classroom_id: filters.classroomId
          ? Number(filters.classroomId)
          : undefined,
        status: (filters.status || undefined) as EnrollmentStatus | undefined,
      }),
    enabled: Boolean(accessToken),
  });
  const mutation = useMutation({
    mutationFn: (operation: () => Promise<unknown>) => operation(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'enrollments'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'classrooms'] }),
        queryClient.invalidateQueries({ queryKey: ['student', 'classrooms'] }),
      ]);
    },
  });

  const targetClassrooms = useMemo(
    () =>
      action
        ? (classrooms.data?.data ?? []).filter(
            (item) =>
              item.academic_year_id === action.enrollment.academic_year_id &&
              item.id !== action.enrollment.classroom_id,
          )
        : [],
    [action, classrooms.data?.data],
  );

  async function run(operation: () => Promise<unknown>, message: string) {
    await mutation.mutateAsync(operation);
    toast.success(message);
  }

  async function submitAssignment(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    await run(
      () =>
        enrollmentApi.createEnrollment(accessToken, {
          student_user_id: Number(assignForm.studentUserId),
          classroom_id: Number(assignForm.classroomId),
          enrolled_at: assignForm.enrolledAt,
          note: assignForm.note || undefined,
        }),
      'Đã xếp lớp cho học sinh.',
    );
    setAssignForm({
      studentUserId: '',
      classroomId: '',
      enrolledAt: localDate(),
      note: '',
    });
  }

  async function submitAction(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !action) return;
    if (action.mode === 'transfer') {
      await run(
        () =>
          enrollmentApi.transferEnrollment(accessToken, action.enrollment.id, {
            target_classroom_id: Number(action.targetClassroomId),
            effective_date: action.effectiveDate,
            note: action.note || undefined,
          }),
        'Đã chuyển lớp và giữ lịch sử lớp cũ.',
      );
    } else {
      await run(
        () =>
          enrollmentApi.endEnrollment(accessToken, action.enrollment.id, {
            status: action.status,
            effective_date: action.effectiveDate,
            note: action.note || undefined,
          }),
        'Đã cập nhật trạng thái học tập.',
      );
    }
    setAction(null);
  }

  function openAction(
    enrollment: StudentEnrollment,
    mode: ActionState['mode'],
  ) {
    setAction({
      enrollment,
      mode,
      targetClassroomId: '',
      status: 'reserved',
      effectiveDate: localDate(),
      note: '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const data = enrollments.data?.data ?? [];

  return (
    <AdminLayout>
      <section className="grid min-w-0 gap-6">
        <header className="border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <GraduationCap className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-semibold text-emerald-700">
                Quản lý học vụ
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">
                Xếp lớp &amp; lịch sử học sinh
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Mỗi học sinh chỉ có một lớp đang học trong cùng năm học. Chuyển
                lớp luôn tạo record mới và giữ nguyên lịch sử trước đó.
              </p>
            </div>
          </div>
        </header>

        {mutation.isError && (
          <p className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Không thể cập nhật enrollment. Kiểm tra lớp, năm học, tài khoản học
            sinh hoặc trạng thái hiện tại.
          </p>
        )}

        {action && (
          <form
            onSubmit={(event) => void submitAction(event)}
            className="border border-amber-200 bg-amber-50 p-5"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {action.mode === 'transfer'
                    ? 'Chuyển lớp học sinh'
                    : 'Kết thúc enrollment'}
                </p>
                <h2 className="mt-1 font-bold text-slate-950">
                  {action.enrollment.full_name} -{' '}
                  {action.enrollment.classroom_name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAction(null)}
                className="text-sm font-semibold text-slate-600"
              >
                Đóng
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {action.mode === 'transfer' ? (
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                  Lớp chuyển đến
                  <select
                    required
                    value={action.targetClassroomId}
                    onChange={(event) =>
                      setAction({
                        ...action,
                        targetClassroomId: event.target.value,
                      })
                    }
                    className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal"
                  >
                    <option value="">Chọn lớp cùng năm học</option>
                    {targetClassrooms.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                  Trạng thái
                  <select
                    value={action.status}
                    onChange={(event) =>
                      setAction({
                        ...action,
                        status: event.target.value as ActionState['status'],
                      })
                    }
                    className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal"
                  >
                    <option value="reserved">Bảo lưu</option>
                    <option value="withdrawn">Thôi học</option>
                    <option value="graduated">Tốt nghiệp</option>
                  </select>
                </label>
              )}
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                Ngày hiệu lực
                <input
                  required
                  type="date"
                  value={action.effectiveDate}
                  onChange={(event) =>
                    setAction({ ...action, effectiveDate: event.target.value })
                  }
                  className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                Lý do / ghi chú
                <input
                  value={action.note}
                  onChange={(event) =>
                    setAction({ ...action, note: event.target.value })
                  }
                  className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal"
                />
              </label>
            </div>
            <button
              disabled={mutation.isPending}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Xác nhận
            </button>
          </form>
        )}

        <form
          onSubmit={(event) => void submitAssignment(event)}
          className="border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-blue-700" />
            <h2 className="font-bold text-slate-950">Xếp lớp mới</h2>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1.3fr_1.2fr_.8fr_1fr_auto]">
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Học sinh
              <div className="grid gap-2">
                <input
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder="Tìm tên, username hoặc mã học sinh"
                  className="rounded-md border border-slate-300 px-3 py-2 font-normal"
                />
                <select
                  required
                  value={assignForm.studentUserId}
                  onChange={(event) =>
                    setAssignForm({
                      ...assignForm,
                      studentUserId: event.target.value,
                    })
                  }
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 font-normal"
                >
                  <option value="">Chọn học sinh</option>
                  {students.data?.data.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.full_name} ({student.username ?? student.email})
                    </option>
                  ))}
                </select>
              </div>
            </label>
            <label className="grid content-start gap-1.5 text-sm font-semibold text-slate-700">
              Lớp học
              <select
                required
                value={assignForm.classroomId}
                onChange={(event) =>
                  setAssignForm({
                    ...assignForm,
                    classroomId: event.target.value,
                  })
                }
                className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal"
              >
                <option value="">Chọn lớp</option>
                {classrooms.data?.data.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} - {item.school_year}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid content-start gap-1.5 text-sm font-semibold text-slate-700">
              Ngày vào lớp
              <input
                required
                type="date"
                value={assignForm.enrolledAt}
                onChange={(event) =>
                  setAssignForm({
                    ...assignForm,
                    enrolledAt: event.target.value,
                  })
                }
                className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>
            <label className="grid content-start gap-1.5 text-sm font-semibold text-slate-700">
              Ghi chú
              <input
                value={assignForm.note}
                onChange={(event) =>
                  setAssignForm({ ...assignForm, note: event.target.value })
                }
                className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>
            <button
              disabled={mutation.isPending}
              className="mt-[1.65rem] inline-flex h-11 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Xếp lớp
            </button>
          </div>
        </form>

        <div className="min-w-0 overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-100 p-4 lg:grid-cols-[1.3fr_repeat(3,1fr)]">
            <label className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={filters.q}
                onChange={(event) => {
                  setPage(1);
                  setFilters({ ...filters, q: event.target.value });
                }}
                placeholder="Tìm học sinh"
                className="w-full rounded-md border border-slate-300 py-2.5 pl-9 pr-3 text-sm"
              />
            </label>
            <select
              value={filters.academicYearId}
              onChange={(event) => {
                setPage(1);
                setFilters({
                  ...filters,
                  academicYearId: event.target.value,
                  classroomId: '',
                });
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">Tất cả năm học</option>
              {periods.data?.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
            <select
              value={filters.classroomId}
              onChange={(event) => {
                setPage(1);
                setFilters({ ...filters, classroomId: event.target.value });
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">Tất cả lớp</option>
              {classrooms.data?.data
                .filter(
                  (item) =>
                    !filters.academicYearId ||
                    item.academic_year_id === Number(filters.academicYearId),
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
            <select
              value={filters.status}
              onChange={(event) => {
                setPage(1);
                setFilters({ ...filters, status: event.target.value });
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {enrollments.isLoading ? (
            <div className="h-48 animate-pulse bg-slate-50" />
          ) : enrollments.isError ? (
            <p className="p-8 text-center text-sm text-red-700">
              Không thể tải lịch sử xếp lớp.
            </p>
          ) : data.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              <History className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3">Chưa có enrollment phù hợp bộ lọc.</p>
            </div>
          ) : (
            <div className="max-w-full overflow-x-auto">
              <table className="min-w-[980px] divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Học sinh</th>
                    <th className="px-4 py-3">Lớp / Năm học</th>
                    <th className="px-4 py-3">Thời gian</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Ghi chú</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-950">
                          {item.full_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.student_code || item.username || item.email}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">
                          {item.classroom_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.academic_year_name}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(item.enrolled_at)}
                        {item.ended_at && (
                          <span className="block text-xs text-slate-400">
                            đến {formatDate(item.ended_at)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            item.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {statusLabels[item.status]}
                        </span>
                      </td>
                      <td className="max-w-56 px-4 py-3 text-slate-600">
                        <p className="line-clamp-2">{item.note || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        {item.status === 'active' && (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openAction(item, 'transfer')}
                              className="rounded-md border border-blue-200 px-3 py-1.5 font-semibold text-blue-700"
                            >
                              Chuyển lớp
                            </button>
                            <button
                              type="button"
                              onClick={() => openAction(item, 'end')}
                              className="rounded-md border border-slate-300 px-3 py-1.5 font-semibold text-slate-700"
                            >
                              Trạng thái
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 p-4 text-sm">
            <span className="text-slate-500">
              {enrollments.data?.meta.total ?? 0} record
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
                disabled={page >= (enrollments.data?.meta.totalPages ?? 1)}
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
