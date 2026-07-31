import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarCheck2,
  CheckCircle2,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import * as periodApi from '../../services/academicPeriod.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type {
  AcademicPeriodStatus,
  AcademicYear,
  AcademicYearInput,
  Semester,
  SemesterInput,
} from '../../types/academic-period';

const emptyYear: AcademicYearInput = {
  name: '',
  start_date: '',
  end_date: '',
};
const emptySemester: SemesterInput = {
  name: '',
  code: '',
  start_date: '',
  end_date: '',
};
const statusLabels: Record<AcademicPeriodStatus, string> = {
  planned: 'Dự kiến',
  active: 'Đang áp dụng',
  closed: 'Đã đóng',
};

function statusClass(status: AcademicPeriodStatus) {
  if (status === 'active') return 'bg-emerald-50 text-emerald-700';
  if (status === 'closed') return 'bg-slate-100 text-slate-600';
  return 'bg-amber-50 text-amber-700';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN').format(
    new Date(`${value}T00:00:00`),
  );
}

export function AdminAcademicPeriodsPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['admin', 'academic-periods'];
  const [yearForm, setYearForm] = useState(emptyYear);
  const [editingYearId, setEditingYearId] = useState<number | null>(null);
  const [semesterForm, setSemesterForm] = useState(emptySemester);
  const [semesterYearId, setSemesterYearId] = useState<number | null>(null);
  const [editingSemesterId, setEditingSemesterId] = useState<number | null>(null);

  const periods = useQuery({
    queryKey,
    queryFn: () => periodApi.getAcademicPeriods(accessToken!),
    enabled: Boolean(accessToken),
  });
  const mutation = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['academic-periods'] });
    },
  });

  async function run(
    action: () => Promise<unknown>,
    message: string,
    confirmation?: string,
  ) {
    if (confirmation && !window.confirm(confirmation)) return;
    await mutation.mutateAsync(action);
    toast.success(message);
  }

  async function submitYear(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    await run(
      () =>
        editingYearId
          ? periodApi.updateAcademicYear(accessToken, editingYearId, yearForm)
          : periodApi.createAcademicYear(accessToken, yearForm),
      editingYearId ? 'Đã cập nhật năm học.' : 'Đã tạo năm học.',
    );
    setEditingYearId(null);
    setYearForm(emptyYear);
  }

  async function submitSemester(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !semesterYearId) return;
    await run(
      () =>
        editingSemesterId
          ? periodApi.updateSemester(
              accessToken,
              editingSemesterId,
              semesterForm,
            )
          : periodApi.createSemester(
              accessToken,
              semesterYearId,
              semesterForm,
            ),
      editingSemesterId ? 'Đã cập nhật học kỳ.' : 'Đã thêm học kỳ.',
    );
    setSemesterYearId(null);
    setEditingSemesterId(null);
    setSemesterForm(emptySemester);
  }

  function beginEditYear(year: AcademicYear) {
    setEditingYearId(year.id);
    setYearForm({
      name: year.name,
      start_date: year.start_date,
      end_date: year.end_date,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function beginSemester(yearId: number, semester?: Semester) {
    setSemesterYearId(yearId);
    setEditingSemesterId(semester?.id ?? null);
    setSemesterForm(
      semester
        ? {
            name: semester.name,
            code: semester.code,
            start_date: semester.start_date,
            end_date: semester.end_date,
          }
        : emptySemester,
    );
  }

  const activeYear = periods.data?.find((year) => year.status === 'active');
  const activeSemester = periods.data
    ?.flatMap((year) => year.semesters)
    .find((semester) => semester.status === 'active');

  return (
    <AdminLayout>
      <section className="grid gap-6">
        <header className="border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
              <CalendarCheck2 className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-semibold text-blue-700">Cấu hình học vụ</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">
                Năm học & học kỳ
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Nguồn dữ liệu chuẩn cho lớp học, thời khóa biểu và nghiệp vụ học
                vụ ở các giai đoạn tiếp theo.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ActiveCard
              label="Năm học đang áp dụng"
              value={activeYear?.name ?? 'Chưa kích hoạt'}
              color="emerald"
            />
            <ActiveCard
              label="Học kỳ đang áp dụng"
              value={
                activeSemester
                  ? `${activeSemester.name} · ${
                      periods.data?.find(
                        (year) => year.id === activeSemester.academic_year_id,
                      )?.name ?? ''
                    }`
                  : 'Chưa kích hoạt'
              }
              color="blue"
            />
          </div>
        </header>

        <form
          onSubmit={(event) => void submitYear(event)}
          className="border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-950">
              {editingYearId ? 'Chỉnh sửa năm học' : 'Tạo năm học'}
            </h2>
            {editingYearId && (
              <button
                type="button"
                onClick={() => {
                  setEditingYearId(null);
                  setYearForm(emptyYear);
                }}
                className="text-sm font-semibold text-slate-500"
              >
                Hủy sửa
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <input
              required
              value={yearForm.name}
              onChange={(event) =>
                setYearForm({ ...yearForm, name: event.target.value })
              }
              placeholder="Ví dụ: 2026-2027"
              className="rounded-md border border-slate-300 px-3 py-2.5"
            />
            <input
              required
              type="date"
              value={yearForm.start_date}
              onChange={(event) =>
                setYearForm({ ...yearForm, start_date: event.target.value })
              }
              aria-label="Ngày bắt đầu năm học"
              className="rounded-md border border-slate-300 px-3 py-2.5"
            />
            <input
              required
              type="date"
              value={yearForm.end_date}
              onChange={(event) =>
                setYearForm({ ...yearForm, end_date: event.target.value })
              }
              aria-label="Ngày kết thúc năm học"
              className="rounded-md border border-slate-300 px-3 py-2.5"
            />
            <button
              disabled={mutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {editingYearId ? (
                <Pencil className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {editingYearId ? 'Lưu' : 'Tạo'}
            </button>
          </div>
        </form>

        {mutation.isError && (
          <p className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Không thể cập nhật kỳ học. Kiểm tra khoảng thời gian và dữ liệu đang
            liên kết rồi thử lại.
          </p>
        )}
        {periods.isLoading && (
          <div className="h-40 animate-pulse border border-slate-200 bg-white" />
        )}
        {periods.isError && (
          <p className="border border-red-200 bg-red-50 p-5 text-red-700">
            Không thể tải cấu hình năm học.
          </p>
        )}

        {periods.data?.map((year) => (
          <article
            key={year.id}
            className="overflow-hidden border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-950">{year.name}</h2>
                  <StatusBadge status={year.status} />
                  {year.is_locked && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                      <Lock className="h-3 w-3" /> Đã khóa
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {formatDate(year.start_date)} - {formatDate(year.end_date)}
                  {' · '}
                  {year.usage_count} dữ liệu liên kết
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!year.is_locked && year.status !== 'closed' && (
                  <button
                    type="button"
                    onClick={() => beginEditYear(year)}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    Sửa
                  </button>
                )}
                {!year.is_locked && year.status === 'planned' && (
                  <button
                    type="button"
                    onClick={() =>
                      void run(
                        () => periodApi.activateAcademicYear(accessToken!, year.id),
                        'Đã kích hoạt năm học.',
                      )
                    }
                    className="rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700"
                  >
                    Kích hoạt
                  </button>
                )}
                {year.status !== 'closed' && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        void run(
                          () =>
                            periodApi.setAcademicYearLock(
                              accessToken!,
                              year.id,
                              !year.is_locked,
                            ),
                          year.is_locked ? 'Đã mở khóa năm học.' : 'Đã khóa năm học.',
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                    >
                      {year.is_locked ? (
                        <LockOpen className="h-4 w-4" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                      {year.is_locked ? 'Mở khóa' : 'Khóa'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void run(
                          () => periodApi.closeAcademicYear(accessToken!, year.id),
                          'Đã đóng năm học.',
                          `Đóng năm học ${year.name}? Toàn bộ học kỳ sẽ bị khóa.`,
                        )
                      }
                      className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700"
                    >
                      Đóng năm học
                    </button>
                  </>
                )}
                {year.usage_count === 0 &&
                  year.semesters.length === 0 &&
                  year.status !== 'active' && (
                    <IconButton
                      label={`Xóa năm học ${year.name}`}
                      onClick={() =>
                        void run(
                          () => periodApi.deleteAcademicYear(accessToken!, year.id),
                          'Đã xóa năm học.',
                          `Xóa năm học ${year.name}?`,
                        )
                      }
                    />
                  )}
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">Các học kỳ</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Mỗi thời điểm chỉ có một học kỳ được kích hoạt.
                  </p>
                </div>
                {!year.is_locked && year.status !== 'closed' && (
                  <button
                    type="button"
                    onClick={() => beginSemester(year.id)}
                    className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                  >
                    <Plus className="h-4 w-4" /> Thêm học kỳ
                  </button>
                )}
              </div>

              {semesterYearId === year.id && (
                <SemesterForm
                  value={semesterForm}
                  editing={Boolean(editingSemesterId)}
                  onChange={setSemesterForm}
                  onCancel={() => {
                    setSemesterYearId(null);
                    setEditingSemesterId(null);
                  }}
                  onSubmit={submitSemester}
                />
              )}

              {year.semesters.length === 0 ? (
                <p className="mt-5 border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  Chưa có học kỳ trong năm học này.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-slate-100 border border-slate-200">
                  {year.semesters.map((semester) => (
                    <div
                      key={semester.id}
                      className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-950">
                            {semester.name}
                          </p>
                          <span className="text-xs font-semibold text-slate-400">
                            {semester.code}
                          </span>
                          <StatusBadge status={semester.status} />
                          {semester.is_locked && (
                            <Lock className="h-3.5 w-3.5 text-red-600" />
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDate(semester.start_date)} -{' '}
                          {formatDate(semester.end_date)}
                          {' · '}
                          {semester.usage_count} thời khóa biểu
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!semester.is_locked && semester.status !== 'closed' && (
                          <button
                            type="button"
                            onClick={() => beginSemester(year.id, semester)}
                            className="rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Sửa
                          </button>
                        )}
                        {!semester.is_locked &&
                          semester.status === 'planned' && (
                            <button
                              type="button"
                              onClick={() =>
                                void run(
                                  () =>
                                    periodApi.activateSemester(
                                      accessToken!,
                                      semester.id,
                                    ),
                                  'Đã kích hoạt học kỳ.',
                                )
                              }
                              className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                            >
                              <CheckCircle2 className="h-4 w-4" /> Kích hoạt
                            </button>
                          )}
                        {semester.status !== 'closed' && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                void run(
                                  () =>
                                    periodApi.setSemesterLock(
                                      accessToken!,
                                      semester.id,
                                      !semester.is_locked,
                                    ),
                                  semester.is_locked
                                    ? 'Đã mở khóa học kỳ.'
                                    : 'Đã khóa học kỳ.',
                                )
                              }
                              className="rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              {semester.is_locked ? 'Mở khóa' : 'Khóa'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void run(
                                  () =>
                                    periodApi.closeSemester(
                                      accessToken!,
                                      semester.id,
                                    ),
                                  'Đã đóng học kỳ.',
                                  `Đóng ${semester.name}?`,
                                )
                              }
                              className="rounded-md px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                            >
                              Đóng
                            </button>
                          </>
                        )}
                        {semester.usage_count === 0 &&
                          semester.status !== 'active' && (
                            <IconButton
                              label={`Xóa ${semester.name}`}
                              onClick={() =>
                                void run(
                                  () =>
                                    periodApi.deleteSemester(
                                      accessToken!,
                                      semester.id,
                                    ),
                                  'Đã xóa học kỳ.',
                                  `Xóa ${semester.name}?`,
                                )
                              }
                            />
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}

        {periods.data?.length === 0 && (
          <p className="border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            Chưa có năm học. Tạo năm học đầu tiên để cấu hình lớp và thời khóa
            biểu.
          </p>
        )}
      </section>
    </AdminLayout>
  );
}

function ActiveCard({
  color,
  label,
  value,
}: {
  color: 'blue' | 'emerald';
  label: string;
  value: string;
}) {
  const classes =
    color === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
      : 'border-blue-200 bg-blue-50 text-blue-950';
  return (
    <div className={`border p-4 ${classes}`}>
      <p className="text-xs font-semibold uppercase opacity-70">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: AcademicPeriodStatus }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(status)}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function IconButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-red-700 hover:bg-red-50"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function SemesterForm({
  editing,
  onCancel,
  onChange,
  onSubmit,
  value,
}: {
  editing: boolean;
  onCancel: () => void;
  onChange: (value: SemesterInput) => void;
  onSubmit: (event: FormEvent) => void;
  value: SemesterInput;
}) {
  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="mt-4 grid gap-3 border border-blue-200 bg-blue-50 p-4 md:grid-cols-2 xl:grid-cols-[1fr_.7fr_1fr_1fr_auto]"
    >
      <input
        required
        value={value.name}
        onChange={(event) => onChange({ ...value, name: event.target.value })}
        placeholder="Tên học kỳ"
        className="rounded-md border border-slate-300 px-3 py-2.5"
      />
      <input
        required
        value={value.code}
        onChange={(event) => onChange({ ...value, code: event.target.value })}
        placeholder="Mã, ví dụ HK1"
        className="rounded-md border border-slate-300 px-3 py-2.5"
      />
      <input
        required
        type="date"
        value={value.start_date}
        onChange={(event) =>
          onChange({ ...value, start_date: event.target.value })
        }
        aria-label="Ngày bắt đầu học kỳ"
        className="rounded-md border border-slate-300 px-3 py-2.5"
      />
      <input
        required
        type="date"
        value={value.end_date}
        onChange={(event) =>
          onChange({ ...value, end_date: event.target.value })
        }
        aria-label="Ngày kết thúc học kỳ"
        className="rounded-md border border-slate-300 px-3 py-2.5"
      />
      <div className="flex gap-2">
        <button className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
          {editing ? 'Lưu' : 'Thêm'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-2 text-sm font-semibold text-slate-600"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}
