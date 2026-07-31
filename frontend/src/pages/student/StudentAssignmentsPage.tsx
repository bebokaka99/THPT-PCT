import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  FileUp,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { StudentPortalLayout } from '../../components/layout/StudentPortalLayout';
import { resolvePublicMediaUrl } from '../../lib/media-url';
import * as assignmentApi from '../../services/assignment.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';

function dateTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function StudentAssignmentsPage() {
  const { accessToken, user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const assignments = useQuery({
    queryKey: ['student', 'assignments', user?.id],
    queryFn: () =>
      assignmentApi.getAssignments(accessToken!, { page: 1, limit: 100 }),
    enabled: Boolean(accessToken),
  });
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get('assignment'));
    if (id > 0) setSelectedId(id);
  }, []);
  const detail = useQuery({
    queryKey: ['student', 'assignment', selectedId],
    queryFn: async () =>
      (await assignmentApi.getAssignment(accessToken!, selectedId!)).data,
    enabled: Boolean(accessToken && selectedId),
  });
  const submit = useMutation({
    mutationFn: () =>
      assignmentApi.submitAssignment(
        accessToken!,
        selectedId!,
        file!,
        note,
      ),
    onSuccess: async () => {
      setFile(null);
      setNote('');
      toast.success('Đã lưu bài nộp. Hệ thống đã ghi nhận phiên bản mới.');
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['student', 'assignments'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['student', 'assignment', selectedId],
        }),
      ]);
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      toast.error('Vui lòng chọn tệp bài làm.');
      return;
    }
    submit.mutate();
  }

  return (
    <StudentPortalLayout>
      <div className="grid min-w-0 gap-6">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold text-blue-700">Học tập</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
            Bài tập của em
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Xem hạn nộp, tải tệp hướng dẫn và nộp bài đúng lớp của em.
          </p>
        </header>

        {assignments.isLoading ? (
          <div className="h-40 animate-pulse border border-slate-200 bg-white" />
        ) : assignments.isError ? (
          <p className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            Không thể tải danh sách bài tập.
          </p>
        ) : (assignments.data?.data.length ?? 0) === 0 ? (
          <div className="border border-dashed border-slate-300 bg-white p-10 text-center">
            <ClipboardList className="mx-auto h-8 w-8 text-slate-400" />
            <h2 className="mt-3 font-bold text-slate-900">
              Chưa có bài tập được giao
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Bài tập mới của lớp sẽ xuất hiện tại đây.
            </p>
          </div>
        ) : (
          <section className="grid gap-3 lg:grid-cols-2">
            {assignments.data?.data.map((item) => {
              const overdue = new Date() > new Date(item.due_at);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`border bg-white p-5 text-left shadow-sm transition hover:border-blue-300 ${
                    selectedId === item.id
                      ? 'border-blue-500 ring-2 ring-blue-100'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      {item.subject_name}
                    </span>
                    {item.my_submission_status ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Clock3
                        className={`h-5 w-5 ${
                          overdue ? 'text-red-500' : 'text-amber-500'
                        }`}
                      />
                    )}
                  </div>
                  <h2 className="mt-4 font-bold text-slate-950">{item.title}</h2>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                    {item.description || 'Không có hướng dẫn thêm.'}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className="text-slate-500">
                      {item.classroom_name} · hạn {dateTime(item.due_at)}
                    </span>
                    {item.my_submission_status && (
                      <span
                        className={`rounded-full px-2 py-1 ${
                          item.my_submission_status === 'late'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {item.my_submission_status === 'late'
                          ? 'Đã nộp muộn'
                          : 'Đã nộp'}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </section>
        )}

        {selectedId && (
          <section className="border border-slate-200 bg-white shadow-sm">
            {detail.isLoading ? (
              <div className="h-48 animate-pulse bg-slate-50" />
            ) : detail.isError || !detail.data ? (
              <p className="p-6 text-sm text-red-700">
                Không thể mở chi tiết bài tập này.
              </p>
            ) : (
              <>
                <div className="border-b border-slate-100 p-5">
                  <p className="text-sm font-semibold text-blue-700">
                    {detail.data.classroom_name} · {detail.data.subject_name}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">
                    {detail.data.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {detail.data.description || 'Không có hướng dẫn thêm.'}
                  </p>
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    Hạn nộp: {dateTime(detail.data.due_at)}
                    {detail.data.allow_late && ' · Cho phép nộp muộn'}
                  </p>
                </div>
                {detail.data.attachments.length > 0 && (
                  <div className="border-b border-slate-100 p-5">
                    <h3 className="text-sm font-bold text-slate-950">
                      Tệp hướng dẫn
                    </h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {detail.data.attachments.map((attachment) => (
                        <a
                          key={attachment.id ?? attachment.file_url}
                          href={resolvePublicMediaUrl(attachment.file_url)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-md border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700"
                        >
                          <Download className="h-4 w-4" />
                          {attachment.original_name || 'Mở tệp'}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                <form
                  onSubmit={handleSubmit}
                  className="grid gap-4 p-5 md:grid-cols-2"
                >
                  {detail.data.my_submission?.current_file && (
                    <div className="border border-emerald-200 bg-emerald-50 p-4 md:col-span-2">
                      <p className="text-sm font-bold text-emerald-800">
                        Bài nộp hiện tại
                      </p>
                      <a
                        href={resolvePublicMediaUrl(
                          detail.data.my_submission.current_file.file_url,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"
                      >
                        <Download className="h-4 w-4" />
                        {detail.data.my_submission.current_file.original_name}
                      </a>
                      <p className="mt-1 text-xs text-emerald-700">
                        Phiên bản {detail.data.my_submission.current_file.version}{' '}
                        · {dateTime(detail.data.my_submission.last_submitted_at)}
                      </p>
                    </div>
                  )}
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                    {detail.data.my_submission
                      ? 'Chọn tệp thay thế'
                      : 'Chọn tệp bài làm'}
                    <input
                      required
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx"
                      onChange={(event) =>
                        setFile(event.target.files?.[0] ?? null)
                      }
                      className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                    Ghi chú
                    <input
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
                    />
                  </label>
                  <div className="md:col-span-2">
                    <button
                      disabled={
                        submit.isPending || detail.data.status !== 'published'
                      }
                      className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      <FileUp className="h-4 w-4" />
                      {submit.isPending
                        ? 'Đang tải lên...'
                        : detail.data.my_submission
                          ? 'Nộp phiên bản mới'
                          : 'Nộp bài'}
                    </button>
                    <p className="mt-2 text-xs text-slate-500">
                      Tối đa 10 MB. Hỗ trợ ảnh, PDF, Word và Excel. Phiên bản cũ
                      được lưu để đối soát.
                    </p>
                  </div>
                </form>
              </>
            )}
          </section>
        )}
      </div>
    </StudentPortalLayout>
  );
}
