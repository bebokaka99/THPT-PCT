import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calculator,
  Check,
  CopyPlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getAcademicPeriods } from '../../services/academicPeriod.service';
import * as assessmentApi from '../../services/assessmentConfiguration.service';
import { getCurriculum } from '../../services/subject.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type {
  AssessmentCategory,
  AssessmentConfiguration,
  AssessmentConfigurationStatus,
  AssessmentRoundingMode,
} from '../../types/assessment-configuration';

const statusLabels: Record<AssessmentConfigurationStatus, string> = {
  draft: 'Bản nháp',
  active: 'Đang áp dụng',
  archived: 'Lịch sử',
};

const roundingLabels: Record<AssessmentRoundingMode, string> = {
  half_up: 'Làm tròn 0.5 lên',
  half_even: 'Làm tròn half-even',
  truncate: 'Cắt phần dư',
};

function defaultCategories(): AssessmentCategory[] {
  return [
    {
      code: 'TX',
      name: 'Đánh giá thường xuyên',
      weight_percent: 40,
      coefficient: 1,
      max_entries: 4,
      score_scale: 10,
      sort_order: 0,
    },
    {
      code: 'CK',
      name: 'Đánh giá cuối kỳ',
      weight_percent: 60,
      coefficient: 3,
      max_entries: 1,
      score_scale: 10,
      sort_order: 1,
    },
  ];
}

function initialForm() {
  return {
    subjectId: '',
    semesterId: '',
    gradeLevel: '10',
    title: '',
    scoreScale: '10',
    decimalPlaces: '1',
    roundingMode: 'half_up' as AssessmentRoundingMode,
    categories: defaultCategories(),
  };
}

export function AdminAssessmentConfigurationsPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<{
    q: string;
    status: '' | AssessmentConfigurationStatus;
  }>({ q: '', status: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(initialForm);

  const periods = useQuery({
    queryKey: ['academic-periods'],
    queryFn: () => getAcademicPeriods(accessToken!),
    enabled: Boolean(accessToken),
  });
  const selectedSemester = periods.data
    ?.flatMap((year) =>
      year.semesters.map((semester) => ({ semester, year })),
    )
    .find((item) => item.semester.id === Number(form.semesterId));
  const curriculum = useQuery({
    queryKey: [
      'curriculum',
      selectedSemester?.year.id,
      Number(form.gradeLevel),
    ],
    queryFn: () =>
      getCurriculum(accessToken!, {
        academic_year_id: selectedSemester!.year.id,
        grade_level: Number(form.gradeLevel),
        is_active: true,
      }),
    enabled: Boolean(
      accessToken && selectedSemester?.year.id && form.gradeLevel,
    ),
  });
  const configurations = useQuery({
    queryKey: ['admin', 'assessment-configurations', filters],
    queryFn: () =>
      assessmentApi.getAssessmentConfigurations(accessToken!, {
        page: 1,
        limit: 100,
        q: filters.q || undefined,
        status: filters.status || undefined,
      }),
    enabled: Boolean(accessToken),
  });
  const mutation = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'assessment-configurations'],
      });
    },
  });

  const totalWeight = useMemo(
    () =>
      form.categories.reduce(
        (total, category) => total + Number(category.weight_percent || 0),
        0,
      ),
    [form.categories],
  );

  function resetForm() {
    setEditingId(null);
    setForm(initialForm());
  }

  function updateCategory(
    index: number,
    field: keyof AssessmentCategory,
    value: string | number,
  ) {
    setForm((current) => ({
      ...current,
      categories: current.categories.map((category, categoryIndex) =>
        categoryIndex === index ? { ...category, [field]: value } : category,
      ),
    }));
  }

  function addCategory() {
    setForm((current) => ({
      ...current,
      categories: [
        ...current.categories,
        {
          code: `NHOM_${current.categories.length + 1}`,
          name: '',
          weight_percent: 0,
          coefficient: 1,
          max_entries: 1,
          score_scale: 10,
          sort_order: current.categories.length,
        },
      ],
    }));
  }

  function removeCategory(index: number) {
    setForm((current) => ({
      ...current,
      categories: current.categories
        .filter((_, categoryIndex) => categoryIndex !== index)
        .map((category, categoryIndex) => ({
          ...category,
          sort_order: categoryIndex,
        })),
    }));
  }

  function editConfiguration(configuration: AssessmentConfiguration) {
    setEditingId(configuration.id);
    setForm({
      subjectId: String(configuration.subject_id),
      semesterId: String(configuration.semester_id),
      gradeLevel: String(configuration.grade_level),
      title: configuration.title,
      scoreScale: String(configuration.score_scale),
      decimalPlaces: String(configuration.decimal_places),
      roundingMode: configuration.rounding_mode,
      categories: configuration.categories.map((category, index) => ({
        ...category,
        sort_order: index,
      })),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    if (form.categories.length === 0) {
      toast.error('Cần ít nhất một nhóm đầu điểm.');
      return;
    }
    if (Math.abs(totalWeight - 100) > 0.001) {
      toast.error('Tổng trọng số phải bằng đúng 100%.');
      return;
    }
    const categories = form.categories.map((category, index) => ({
      code: category.code.trim().toUpperCase().replace(/\s+/g, '_'),
      name: category.name.trim(),
      weight_percent: Number(category.weight_percent),
      coefficient: Number(category.coefficient),
      max_entries: Number(category.max_entries),
      score_scale: Number(category.score_scale),
      sort_order: index,
    }));
    if (editingId) {
      await mutation.mutateAsync(() =>
        assessmentApi.updateAssessmentConfiguration(
          accessToken,
          editingId,
          {
            title: form.title.trim(),
            score_scale: Number(form.scoreScale),
            decimal_places: Number(form.decimalPlaces),
            rounding_mode: form.roundingMode,
            categories,
          },
        ),
      );
      toast.success('Đã cập nhật bản nháp cấu hình.');
    } else {
      await mutation.mutateAsync(() =>
        assessmentApi.createAssessmentConfiguration(accessToken, {
          subject_id: Number(form.subjectId),
          semester_id: Number(form.semesterId),
          grade_level: Number(form.gradeLevel),
          title: form.title.trim(),
          score_scale: Number(form.scoreScale),
          decimal_places: Number(form.decimalPlaces),
          rounding_mode: form.roundingMode,
          categories,
        }),
      );
      toast.success('Đã tạo bản nháp cấu hình đầu điểm.');
    }
    resetForm();
  }

  async function activate(configuration: AssessmentConfiguration) {
    if (!accessToken) return;
    await mutation.mutateAsync(() =>
      assessmentApi.activateAssessmentConfiguration(
        accessToken,
        configuration.id,
      ),
    );
    toast.success(`Đã kích hoạt phiên bản ${configuration.version}.`);
  }

  async function createVersion(configuration: AssessmentConfiguration) {
    if (!accessToken) return;
    const next = (await mutation.mutateAsync(() =>
      assessmentApi.createAssessmentConfigurationVersion(
        accessToken,
        configuration.id,
      ),
    )) as AssessmentConfiguration;
    toast.success(`Đã tạo bản nháp phiên bản ${next.version}.`);
    editConfiguration(next);
  }

  async function remove(configuration: AssessmentConfiguration) {
    if (
      !accessToken ||
      !window.confirm(`Xóa bản nháp "${configuration.title}"?`)
    ) {
      return;
    }
    await mutation.mutateAsync(() =>
      assessmentApi.deleteAssessmentConfiguration(
        accessToken,
        configuration.id,
      ),
    );
    toast.success('Đã xóa bản nháp.');
    if (editingId === configuration.id) resetForm();
  }

  const rows = configurations.data?.data ?? [];
  const loadError =
    configurations.error || periods.error || curriculum.error;

  return (
    <AdminLayout>
      <div className="grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)] gap-6 overflow-x-hidden">
        <header className="min-w-0 max-w-full border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-cyan-700">
              <Calculator className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-cyan-700">
                Quản lý học vụ
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">
                Cấu hình đầu điểm
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Quản lý nhóm đánh giá, trọng số và quy tắc làm tròn theo môn,
                khối và học kỳ bằng các phiên bản có lịch sử.
              </p>
            </div>
          </div>
        </header>

        <form
          onSubmit={(event) => void submit(event)}
          className="min-w-0 max-w-full overflow-hidden border border-slate-200 bg-white p-5 shadow-sm [&_input]:min-w-0 [&_input]:max-w-full [&_select]:min-w-0 [&_select]:max-w-full"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-950">
                {editingId ? 'Sửa bản nháp' : 'Tạo cấu hình mới'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Bản đã kích hoạt không thể sửa; hãy tạo phiên bản mới.
              </p>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                <X className="h-4 w-4" /> Hủy sửa
              </button>
            )}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Học kỳ
              <select
                required
                disabled={Boolean(editingId)}
                value={form.semesterId}
                onChange={(event) =>
                  setForm({
                    ...form,
                    semesterId: event.target.value,
                    subjectId: '',
                  })
                }
                className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal disabled:bg-slate-100"
              >
                <option value="">Chọn học kỳ</option>
                {periods.data?.flatMap((year) =>
                  year.semesters.map((semester) => (
                    <option key={semester.id} value={semester.id}>
                      {year.name} - {semester.name}
                    </option>
                  )),
                )}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Khối
              <select
                disabled={Boolean(editingId)}
                value={form.gradeLevel}
                onChange={(event) =>
                  setForm({
                    ...form,
                    gradeLevel: event.target.value,
                    subjectId: '',
                  })
                }
                className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal disabled:bg-slate-100"
              >
                {[10, 11, 12].map((grade) => (
                  <option key={grade} value={grade}>
                    Khối {grade}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Môn học
              <select
                required
                disabled={Boolean(editingId) || !selectedSemester}
                value={form.subjectId}
                onChange={(event) =>
                  setForm({ ...form, subjectId: event.target.value })
                }
                className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal disabled:bg-slate-100"
              >
                <option value="">Chọn môn trong chương trình</option>
                {curriculum.data?.map((subject) => (
                  <option key={subject.subject_id} value={subject.subject_id}>
                    {subject.subject_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Tên cấu hình
              <input
                required
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
                placeholder="Ví dụ: Công thức HK1"
                className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Thang điểm kết quả
              <input
                required
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={form.scoreScale}
                onChange={(event) =>
                  setForm({ ...form, scoreScale: event.target.value })
                }
                className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Số chữ số thập phân
              <select
                value={form.decimalPlaces}
                onChange={(event) =>
                  setForm({ ...form, decimalPlaces: event.target.value })
                }
                className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal"
              >
                {[0, 1, 2].map((places) => (
                  <option key={places} value={places}>
                    {places}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700 md:col-span-2">
              Quy tắc làm tròn
              <select
                value={form.roundingMode}
                onChange={(event) =>
                  setForm({
                    ...form,
                    roundingMode: event.target.value as AssessmentRoundingMode,
                  })
                }
                className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal"
              >
                {Object.entries(roundingLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
            <div>
              <h3 className="font-bold text-slate-950">Nhóm đầu điểm</h3>
              <p
                className={`mt-1 text-sm font-semibold ${
                  Math.abs(totalWeight - 100) < 0.001
                    ? 'text-emerald-700'
                    : 'text-red-600'
                }`}
              >
                Tổng trọng số: {totalWeight}%
              </p>
            </div>
            <button
              type="button"
              onClick={addCategory}
              className="inline-flex items-center gap-2 rounded-md border border-cyan-300 px-3 py-2 text-sm font-semibold text-cyan-800"
            >
              <Plus className="h-4 w-4" /> Thêm nhóm
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            {form.categories.map((category, index) => (
              <div
                key={`${category.id ?? 'new'}-${index}`}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-[0.8fr_1.5fr_0.7fr_0.7fr_0.7fr_0.7fr_auto]"
              >
                <label className="grid gap-1 text-xs font-semibold text-slate-600">
                  Mã nhóm
                  <input
                    required
                    value={category.code}
                    onChange={(event) =>
                      updateCategory(index, 'code', event.target.value)
                    }
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal"
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-slate-600">
                  Tên nhóm
                  <input
                    required
                    value={category.name}
                    onChange={(event) =>
                      updateCategory(index, 'name', event.target.value)
                    }
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal"
                  />
                </label>
                {[
                  ['weight_percent', 'Trọng số %', '0.01', '100', '0.01'],
                  ['coefficient', 'Hệ số', '0.01', '20', '0.01'],
                  ['max_entries', 'Số lần tối đa', '1', '20', '1'],
                  ['score_scale', 'Thang điểm', '0.01', '100', '0.01'],
                ].map(([field, label, min, max, step]) => (
                  <label
                    key={field}
                    className="grid gap-1 text-xs font-semibold text-slate-600"
                  >
                    {label}
                    <input
                      required
                      type="number"
                      min={min}
                      max={max}
                      step={step}
                      value={Number(
                        category[field as keyof AssessmentCategory],
                      )}
                      onChange={(event) =>
                        updateCategory(
                          index,
                          field as keyof AssessmentCategory,
                          Number(event.target.value),
                        )
                      }
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal"
                    />
                  </label>
                ))}
                <button
                  type="button"
                  title="Xóa nhóm"
                  onClick={() => removeCategory(index)}
                  className="mt-auto inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {mutation.isPending
              ? 'Đang lưu...'
              : editingId
                ? 'Lưu bản nháp'
                : 'Tạo bản nháp'}
          </button>
        </form>

        <section className="min-w-0 max-w-full overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={filters.q}
                onChange={(event) =>
                  setFilters({ ...filters, q: event.target.value })
                }
                placeholder="Tìm tên cấu hình hoặc môn"
                className="w-full rounded-md border border-slate-300 py-2.5 pl-9 pr-3 text-sm"
              />
            </label>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  status: event.target
                    .value as typeof filters.status,
                })
              }
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

          {loadError && (
            <p className="border-b border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Không thể tải dữ liệu cấu hình. Vui lòng thử lại.
            </p>
          )}
          {configurations.isLoading ? (
            <p className="p-8 text-center text-sm text-slate-500">
              Đang tải cấu hình...
            </p>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <Calculator className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">
                Chưa có cấu hình đầu điểm phù hợp.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {rows.map((configuration) => (
                <article
                  key={configuration.id}
                  className="min-w-0 p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-950">
                          {configuration.title}
                        </h3>
                        <span
                          className={`rounded px-2 py-1 text-xs font-semibold ${
                            configuration.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : configuration.status === 'draft'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {statusLabels[configuration.status]}
                        </span>
                        <span className="rounded bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">
                          v{configuration.version}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {configuration.subject_name} · Khối{' '}
                        {configuration.grade_level} ·{' '}
                        {configuration.academic_year_name} ·{' '}
                        {configuration.semester_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Thang {configuration.score_scale} ·{' '}
                        {configuration.decimal_places} số lẻ ·{' '}
                        {roundingLabels[configuration.rounding_mode]}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {configuration.status === 'draft' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => editConfiguration(configuration)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => void activate(configuration)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white"
                          >
                            <Check className="h-3.5 w-3.5" /> Kích hoạt
                          </button>
                          <button
                            type="button"
                            onClick={() => void remove(configuration)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 text-red-600"
                            title="Xóa bản nháp"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void createVersion(configuration)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-cyan-300 px-3 py-2 text-xs font-semibold text-cyan-800"
                        >
                          <CopyPlus className="h-3.5 w-3.5" />
                          Tạo phiên bản mới
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 max-w-full overflow-x-auto">
                    <table className="min-w-[680px] w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Nhóm</th>
                          <th className="px-3 py-2">Trọng số</th>
                          <th className="px-3 py-2">Hệ số</th>
                          <th className="px-3 py-2">Số lần tối đa</th>
                          <th className="px-3 py-2">Thang điểm</th>
                        </tr>
                      </thead>
                      <tbody>
                        {configuration.categories.map((category) => (
                          <tr key={category.id ?? category.code}>
                            <td className="px-3 py-2 font-semibold text-slate-800">
                              {category.name}{' '}
                              <span className="text-xs text-slate-400">
                                ({category.code})
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {category.weight_percent}%
                            </td>
                            <td className="px-3 py-2">
                              {category.coefficient}
                            </td>
                            <td className="px-3 py-2">
                              {category.max_entries}
                            </td>
                            <td className="px-3 py-2">
                              {category.score_scale}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
