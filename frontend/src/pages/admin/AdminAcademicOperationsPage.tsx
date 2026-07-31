import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import * as academicApi from '../../services/academicOperation.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type {
  AcademicImportJob,
  AcademicImportType,
} from '../../types/academic-operation';

const typeLabels: Record<AcademicImportType, string> = {
  enrollments: 'Xếp lớp học sinh',
  assignments: 'Bài tập',
  attendance: 'Chuyên cần',
  grades: 'Điểm số',
};

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function newIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function AdminAcademicOperationsPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [type, setType] = useState<AcademicImportType>('enrollments');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AcademicImportJob | null>(null);
  const [exportIds, setExportIds] = useState({
    classroomId: '',
    semesterId: '',
    gradebookId: '',
  });

  const jobs = useQuery({
    queryKey: ['admin', 'academic-import-jobs'],
    queryFn: () =>
      academicApi.getAcademicImportJobs(accessToken!, { page: 1, limit: 10 }),
    enabled: Boolean(accessToken),
  });
  const summary = useQuery({
    queryKey: ['admin', 'academic-report-summary'],
    queryFn: () => academicApi.getAcademicReportSummary(accessToken!),
    enabled: Boolean(accessToken),
  });
  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken || !file) throw new Error('Vui lòng chọn file CSV');
      return academicApi.previewAcademicImport(
        accessToken,
        type,
        newIdempotencyKey(),
        file,
      );
    },
    onSuccess: async (response) => {
      setPreview(response.data);
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'academic-import-jobs'],
      });
      toast.success('Đã phân tích và kiểm tra file CSV.');
    },
  });
  const commitMutation = useMutation({
    mutationFn: (id: number) =>
      academicApi.commitAcademicImport(accessToken!, id),
    onSuccess: async (response) => {
      setPreview(response.data);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['admin', 'academic-import-jobs'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['admin', 'academic-report-summary'],
        }),
      ]);
      toast.success('Đã commit toàn bộ dữ liệu hợp lệ.');
    },
  });

  async function download(path: string, fileName: string) {
    if (!accessToken) return;
    try {
      const blob = await academicApi.downloadAcademicFile(accessToken, path);
      academicApi.saveBlob(blob, fileName);
    } catch {
      toast.error('Không thể tải file. Kiểm tra tham số và thử lại.');
    }
  }

  function submitPreview(event: FormEvent) {
    event.preventDefault();
    previewMutation.mutate();
  }

  const reportCards = [
    ['Lớp học', summary.data?.data.classroom_count ?? 0],
    ['Học sinh đang học', summary.data?.data.active_student_count ?? 0],
    ['Buổi chuyên cần', summary.data?.data.attendance_session_count ?? 0],
    ['Sổ điểm', summary.data?.data.gradebook_count ?? 0],
  ];

  return (
    <AdminLayout>
      <section className="grid gap-6">
        <header className="border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-blue-700">
              <FileSpreadsheet className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-semibold text-blue-700">
                Vận hành học vụ
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">
                Import, export và báo cáo
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Kiểm tra dữ liệu trước khi ghi. Mỗi file được commit nguyên khối,
                không ghi một phần khi còn dòng lỗi.
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {reportCards.map(([label, value]) => (
            <article key={label} className="border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
          <form
            onSubmit={submitPreview}
            className="border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="font-bold text-slate-950">Import CSV có kiểm soát</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                Loại dữ liệu
                <select
                  value={type}
                  onChange={(event) => {
                    setType(event.target.value as AcademicImportType);
                    setPreview(null);
                    setFile(null);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal"
                >
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid content-end">
                <button
                  type="button"
                  onClick={() =>
                    void download(
                      `/academic-operations/templates/${type}`,
                      `${type}-template.csv`,
                    )
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-blue-200 px-4 text-sm font-semibold text-blue-700"
                >
                  <Download className="h-4 w-4" />
                  Tải file mẫu
                </button>
              </div>
            </div>
            <label className="mt-4 grid gap-1.5 text-sm font-semibold text-slate-700">
              File CSV, tối đa 2 MB và 2.000 dòng
              <input
                required
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setPreview(null);
                }}
                className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 font-normal"
              />
            </label>
            {previewMutation.isError && (
              <p className="mt-3 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {previewMutation.error instanceof Error
                  ? previewMutation.error.message
                  : 'Không thể kiểm tra file CSV.'}
              </p>
            )}
            <button
              disabled={!file || previewMutation.isPending}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {previewMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Kiểm tra file
            </button>
          </form>

          <section className="border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-950">Kết quả kiểm tra</h2>
            {!preview ? (
              <p className="mt-4 text-sm text-slate-500">
                Chọn file và bấm “Kiểm tra file” để xem kết quả.
              </p>
            ) : (
              <div className="mt-4 grid gap-4">
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="bg-slate-50 p-3">
                    <strong className="block text-lg">{preview.total_rows}</strong>
                    Tổng dòng
                  </div>
                  <div className="bg-emerald-50 p-3 text-emerald-800">
                    <strong className="block text-lg">{preview.valid_rows}</strong>
                    Hợp lệ
                  </div>
                  <div className="bg-red-50 p-3 text-red-800">
                    <strong className="block text-lg">{preview.invalid_rows}</strong>
                    Có lỗi
                  </div>
                </div>
                {preview.validation_errors.length > 0 ? (
                  <div className="max-h-56 overflow-y-auto border border-red-200 bg-red-50 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
                      <AlertTriangle className="h-4 w-4" />
                      Phải sửa tất cả lỗi trước khi commit
                    </p>
                    <ul className="mt-2 grid gap-1 text-xs text-red-700">
                      {preview.validation_errors.map((error, index) => (
                        <li key={`${error.row}-${index}`}>
                          Dòng {error.row}: {error.message}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() =>
                        void download(
                          `/academic-operations/imports/${preview.id}/errors`,
                          `academic-import-${preview.id}-errors.csv`,
                        )
                      }
                      className="mt-3 text-sm font-semibold text-red-800 underline"
                    >
                      Tải danh sách lỗi
                    </button>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" />
                    Toàn bộ dòng hợp lệ, có thể commit.
                  </p>
                )}
                <button
                  type="button"
                  disabled={
                    preview.invalid_rows > 0 ||
                    preview.status !== 'preview_ready' ||
                    commitMutation.isPending
                  }
                  onClick={() => commitMutation.mutate(preview.id)}
                  className="rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {preview.status === 'completed'
                    ? 'Đã commit'
                    : 'Commit toàn bộ dữ liệu'}
                </button>
                {commitMutation.isError && (
                  <p className="text-sm text-red-700">
                    {commitMutation.error instanceof Error
                      ? commitMutation.error.message
                      : 'Commit thất bại.'}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>

        <section className="border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-950">Xuất dữ liệu học vụ</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <input
              type="number"
              min="1"
              placeholder="Classroom ID"
              value={exportIds.classroomId}
              onChange={(event) =>
                setExportIds({ ...exportIds, classroomId: event.target.value })
              }
              className="rounded-md border border-slate-300 px-3 py-2.5 text-sm"
            />
            <input
              type="number"
              min="1"
              placeholder="Semester ID"
              value={exportIds.semesterId}
              onChange={(event) =>
                setExportIds({ ...exportIds, semesterId: event.target.value })
              }
              className="rounded-md border border-slate-300 px-3 py-2.5 text-sm"
            />
            <input
              type="number"
              min="1"
              placeholder="Gradebook ID"
              value={exportIds.gradebookId}
              onChange={(event) =>
                setExportIds({ ...exportIds, gradebookId: event.target.value })
              }
              className="rounded-md border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <ExportButton
              label="Danh sách lớp"
              disabled={!exportIds.classroomId}
              onClick={() =>
                void download(
                  `/academic-operations/exports/roster?classroom_id=${exportIds.classroomId}`,
                  `classroom-${exportIds.classroomId}-roster.csv`,
                )
              }
            />
            <ExportButton
              label="Chuyên cần"
              disabled={!exportIds.classroomId || !exportIds.semesterId}
              onClick={() =>
                void download(
                  `/academic-operations/exports/attendance?classroom_id=${exportIds.classroomId}&semester_id=${exportIds.semesterId}`,
                  `classroom-${exportIds.classroomId}-attendance.csv`,
                )
              }
            />
            <ExportButton
              label="Sổ điểm"
              disabled={!exportIds.gradebookId}
              onClick={() =>
                void download(
                  `/academic-operations/exports/gradebook/${exportIds.gradebookId}`,
                  `gradebook-${exportIds.gradebookId}.csv`,
                )
              }
            />
            <ExportButton
              label="Tổng hợp học bạ"
              disabled={!exportIds.classroomId || !exportIds.semesterId}
              onClick={() =>
                void download(
                  `/academic-operations/exports/transcript-summary?classroom_id=${exportIds.classroomId}&semester_id=${exportIds.semesterId}`,
                  `classroom-${exportIds.classroomId}-transcript.csv`,
                )
              }
            />
          </div>
        </section>

        <section className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-bold text-slate-950">10 lần import gần nhất</h2>
          </div>
          {jobs.isLoading ? (
            <div className="h-32 animate-pulse bg-slate-50" />
          ) : (jobs.data?.data.length ?? 0) === 0 ? (
            <p className="p-6 text-sm text-slate-500">Chưa có lịch sử import.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">File</th>
                    <th className="px-4 py-3">Loại</th>
                    <th className="px-4 py-3">Kết quả</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobs.data?.data.map((job) => (
                    <tr key={job.id}>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {job.original_file_name}
                      </td>
                      <td className="px-4 py-3">{typeLabels[job.import_type]}</td>
                      <td className="px-4 py-3">
                        {job.valid_rows} hợp lệ / {job.invalid_rows} lỗi
                      </td>
                      <td className="px-4 py-3">{job.status}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDate(job.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </AdminLayout>
  );
}

function ExportButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
    >
      <Download className="h-4 w-4" />
      {label}
    </button>
  );
}

