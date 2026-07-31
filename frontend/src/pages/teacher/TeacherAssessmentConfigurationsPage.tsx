import { useMutation, useQuery } from '@tanstack/react-query';
import { Calculator, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { TeacherPortalLayout } from '../../components/layout/TeacherPortalLayout';
import {
  calculateAssessmentPreview,
  getMyAssessmentConfigurations,
} from '../../services/assessmentConfiguration.service';
import { useAuth } from '../../stores/auth-context';
import type {
  AssessmentCalculationResult,
  AssessmentConfiguration,
} from '../../types/assessment-configuration';

const roundingLabels = {
  half_up: 'Làm tròn 0.5 lên',
  half_even: 'Làm tròn half-even',
  truncate: 'Cắt phần dư',
};

export function TeacherAssessmentConfigurationsPage() {
  const { accessToken } = useAuth();
  const [q, setQ] = useState('');
  const [selected, setSelected] =
    useState<AssessmentConfiguration | null>(null);
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AssessmentCalculationResult | null>(
    null,
  );
  const configurations = useQuery({
    queryKey: ['teacher', 'assessment-configurations', q],
    queryFn: () =>
      getMyAssessmentConfigurations(accessToken!, {
        page: 1,
        limit: 100,
        q: q || undefined,
      }),
    enabled: Boolean(accessToken),
  });
  const calculate = useMutation({
    mutationFn: (scores: Array<{ category_code: string; values: number[] }>) =>
      calculateAssessmentPreview(accessToken!, selected!.id, scores),
    onSuccess: setResult,
  });

  function choose(configuration: AssessmentConfiguration) {
    setSelected(configuration);
    setScoreInputs(
      Object.fromEntries(
        configuration.categories.map((category) => [category.code, '']),
      ),
    );
    setResult(null);
  }

  function submitCalculation(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const scores = selected.categories.map((category) => ({
      category_code: category.code,
      values: (scoreInputs[category.code] ?? '')
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value)),
    }));
    calculate.mutate(scores);
  }

  const rows = configurations.data?.data ?? [];

  return (
    <TeacherPortalLayout>
      <div className="grid min-w-0 gap-5">
        <header className="border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-emerald-700">
            Nghiệp vụ giảng dạy
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            Cấu hình đầu điểm
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Xem công thức đang áp dụng cho các môn được phân công và tính thử
            kết quả theo backend.
          </p>
        </header>

        <label className="relative block">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Tìm môn hoặc tên cấu hình"
            className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm"
          />
        </label>

        {configurations.isLoading ? (
          <p className="border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Đang tải cấu hình...
          </p>
        ) : configurations.error ? (
          <p className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            Không thể tải cấu hình đầu điểm.
          </p>
        ) : rows.length === 0 ? (
          <div className="border border-slate-200 bg-white p-10 text-center shadow-sm">
            <Calculator className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-700">
              Chưa có cấu hình đang áp dụng
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Chỉ cấu hình active thuộc môn được phân công mới hiển thị.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {rows.map((configuration) => (
              <article
                key={configuration.id}
                className="border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-slate-950">
                      {configuration.subject_name} · Khối{' '}
                      {configuration.grade_level}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {configuration.title} · {configuration.academic_year_name}{' '}
                      · {configuration.semester_name} · v
                      {configuration.version}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Thang {configuration.score_scale} ·{' '}
                      {configuration.decimal_places} số lẻ ·{' '}
                      {roundingLabels[configuration.rounding_mode]}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => choose(configuration)}
                    className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                  >
                    <Calculator className="h-4 w-4" /> Tính thử
                  </button>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {configuration.categories.map((category) => (
                    <div
                      key={category.id ?? category.code}
                      className="border border-slate-200 bg-slate-50 p-3"
                    >
                      <p className="text-sm font-bold text-slate-800">
                        {category.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {category.weight_percent}% · hệ số{' '}
                        {category.coefficient} · tối đa {category.max_entries}{' '}
                        lần · thang {category.score_scale}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}

        {selected && (
          <form
            onSubmit={submitCalculation}
            className="border border-emerald-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-emerald-700">
                  Tính thử bằng công thức backend
                </p>
                <h2 className="mt-1 font-bold text-slate-950">
                  {selected.subject_name} · {selected.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-sm font-semibold text-slate-500"
              >
                Đóng
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Nhập nhiều điểm bằng dấu phẩy. Mỗi nhóm phải có ít nhất một điểm.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {selected.categories.map((category) => (
                <label
                  key={category.code}
                  className="grid gap-1.5 text-sm font-semibold text-slate-700"
                >
                  {category.name} ({category.code})
                  <input
                    required
                    value={scoreInputs[category.code] ?? ''}
                    onChange={(event) =>
                      setScoreInputs({
                        ...scoreInputs,
                        [category.code]: event.target.value,
                      })
                    }
                    placeholder={`0-${category.score_scale}, tối đa ${category.max_entries} điểm`}
                    className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
                  />
                </label>
              ))}
            </div>
            {calculate.error && (
              <p className="mt-3 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                Dữ liệu điểm chưa hợp lệ với cấu hình.
              </p>
            )}
            <button
              type="submit"
              disabled={calculate.isPending}
              className="mt-4 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {calculate.isPending ? 'Đang tính...' : 'Tính kết quả'}
            </button>
            {result && (
              <div className="mt-5 border-l-4 border-emerald-600 bg-emerald-50 p-4">
                <p className="text-sm text-emerald-800">Kết quả làm tròn</p>
                <p className="mt-1 text-3xl font-bold text-emerald-950">
                  {result.final_score}/{result.score_scale}
                </p>
                <p className="mt-1 text-xs text-emerald-700">
                  Giá trị trước làm tròn: {result.raw_score}
                </p>
              </div>
            )}
          </form>
        )}
      </div>
    </TeacherPortalLayout>
  );
}
