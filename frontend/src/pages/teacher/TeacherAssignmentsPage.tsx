import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ClipboardList,
  Eye,
  FileText,
  Pencil,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { TeacherPortalLayout } from '../../components/layout/TeacherPortalLayout';
import { resolvePublicMediaUrl } from '../../lib/media-url';
import { getAcademicPeriods } from '../../services/academicPeriod.service';
import * as assignmentApi from '../../services/assignment.service';
import { getMyTeachingAssignments } from '../../services/teachingAssignment.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type {
  Assignment,
  AssignmentSubmission,
} from '../../types/assignment';

function defaultDeadline() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(23, 59, 0, 0);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function deadlineForSemester(startDate: string, endDate: string) {
  const candidate = new Date();
  candidate.setDate(candidate.getDate() + 7);
  candidate.setHours(23, 59, 0, 0);
  const start = new Date(`${startDate}T08:00:00`);
  const end = new Date(`${endDate}T23:59:00`);
  const selected = candidate < start ? start : candidate > end ? end : candidate;
  const offset = selected.getTimezoneOffset() * 60_000;
  return new Date(selected.getTime() - offset).toISOString().slice(0, 16);
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

const statusLabel = {
  draft: 'Bản nháp',
  published: 'Đang giao',
  closed: 'Đã đóng',
};

const blankForm = () => ({
  teachingAssignmentId: '',
  title: '',
  description: '',
  dueAt: defaultDeadline(),
  allowLate: false,
  attachmentUrl: '',
  attachmentName: '',
});

export function TeacherAssignmentsPage() {
  const { accessToken, user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(blankForm);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const assignments = useQuery({
    queryKey: ['teacher', 'assignments', user?.id],
    queryFn: () =>
      assignmentApi.getAssignments(accessToken!, { page: 1, limit: 100 }),
    enabled: Boolean(accessToken),
  });
  const teachingAssignments = useQuery({
    queryKey: ['teacher', 'teaching-assignments', user?.id],
    queryFn: () =>
      getMyTeachingAssignments(accessToken!, {
        page: 1,
        limit: 100,
        status: 'active',
      }),
    enabled: Boolean(accessToken),
  });
  const periods = useQuery({
    queryKey: ['academic-periods'],
    queryFn: () => getAcademicPeriods(accessToken!),
    enabled: Boolean(accessToken),
  });
  const mutation = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['teacher', 'assignments'],
      });
    },
  });

  function startEdit(item: Assignment) {
    const local = new Date(item.due_at);
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
    setEditing(item);
    setForm({
      teachingAssignmentId: String(item.teaching_assignment_id),
      title: item.title,
      description: item.description || '',
      dueAt: local.toISOString().slice(0, 16),
      allowLate: item.allow_late,
      attachmentUrl: '',
      attachmentName: '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !form.title.trim() || !form.teachingAssignmentId) return;
    const attachments = form.attachmentUrl.trim()
      ? [
          {
            file_url: form.attachmentUrl.trim(),
            original_name: form.attachmentName.trim() || 'Tệp đính kèm',
            sort_order: 0,
          },
        ]
      : [];
    if (editing) {
      await mutation.mutateAsync(() =>
        assignmentApi.updateAssignment(accessToken, editing.id, {
          title: form.title.trim(),
          description: form.description.trim() || null,
          due_at: new Date(form.dueAt).toISOString(),
          allow_late: form.allowLate,
          attachments,
        }),
      );
      toast.success('Đã cập nhật bài tập.');
    } else {
      await mutation.mutateAsync(() =>
        assignmentApi.createAssignment(accessToken, {
          teaching_assignment_id: Number(form.teachingAssignmentId),
          title: form.title.trim(),
          description: form.description.trim() || null,
          due_at: new Date(form.dueAt).toISOString(),
          allow_late: form.allowLate,
          attachments,
        }),
      );
      toast.success('Đã tạo bản nháp bài tập.');
    }
    setEditing(null);
    setForm(blankForm());
  }

  async function runAction(
    item: Assignment,
    action: 'publish' | 'close' | 'delete',
  ) {
    if (!accessToken) return;
    if (
      action === 'delete' &&
      !window.confirm(`Xóa bản nháp "${item.title}"?`)
    ) {
      return;
    }
    await mutation.mutateAsync(() => {
      if (action === 'publish') {
        return assignmentApi.publishAssignment(accessToken, item.id);
      }
      if (action === 'close') {
        return assignmentApi.closeAssignment(accessToken, item.id);
      }
      return assignmentApi.deleteAssignment(accessToken, item.id);
    });
    toast.success(
      action === 'publish'
        ? 'Đã giao bài và gửi thông báo cho học sinh.'
        : action === 'close'
          ? 'Đã đóng bài tập.'
          : 'Đã xóa bản nháp.',
    );
  }

  async function viewSubmissions(item: Assignment) {
    if (!accessToken) return;
    setSelected(item);
    const response = await assignmentApi.getAssignmentSubmissions(
      accessToken,
      item.id,
    );
    setSubmissions(response.data);
  }

  return (
    <TeacherPortalLayout>
      <div className="grid min-w-0 gap-6">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold text-emerald-700">Học tập</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
            Bài tập & bài nộp
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Tạo bài theo đúng lớp, môn đã được phân công và theo dõi tệp học sinh
            nộp.
          </p>
        </header>

        <form
          onSubmit={(event) => void save(event)}
          className="border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold text-slate-950">
              {editing ? 'Sửa bản nháp' : 'Tạo bài tập mới'}
            </h2>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setForm(blankForm());
                }}
                className="text-sm font-semibold text-slate-500"
              >
                Hủy sửa
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700 md:col-span-2">
              Lớp và môn
              <select
                required
                disabled={Boolean(editing)}
                value={form.teachingAssignmentId}
                onChange={(event) => {
                  const teaching = teachingAssignments.data?.data.find(
                    (item) => item.id === Number(event.target.value),
                  );
                  const semester = periods.data
                    ?.flatMap((year) => year.semesters)
                    .find((item) => item.id === teaching?.semester_id);
                  setForm({
                    ...form,
                    teachingAssignmentId: event.target.value,
                    dueAt: semester
                      ? deadlineForSemester(
                          semester.start_date,
                          semester.end_date,
                        )
                      : form.dueAt,
                  });
                }}
                className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal disabled:bg-slate-100"
              >
                <option value="">Chọn phân công giảng dạy</option>
                {teachingAssignments.data?.data.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.classroom_name} · {item.subject_name} ·{' '}
                    {item.semester_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700 md:col-span-2">
              Tiêu đề
              <input
                required
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
                className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700 md:col-span-2">
              Nội dung hướng dẫn
              <textarea
                rows={4}
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Hạn nộp
              <input
                required
                type="datetime-local"
                value={form.dueAt}
                onChange={(event) =>
                  setForm({ ...form, dueAt: event.target.value })
                }
                className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>
            <label className="flex items-center gap-2 self-end rounded-md border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={form.allowLate}
                onChange={(event) =>
                  setForm({ ...form, allowLate: event.target.checked })
                }
              />
              Cho phép nộp muộn
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              URL tệp hướng dẫn (không bắt buộc)
              <input
                value={form.attachmentUrl}
                onChange={(event) =>
                  setForm({ ...form, attachmentUrl: event.target.value })
                }
                placeholder="/uploads/documents/..."
                className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Tên tệp
              <input
                value={form.attachmentName}
                onChange={(event) =>
                  setForm({ ...form, attachmentName: event.target.value })
                }
                className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>
          </div>
          <button
            disabled={mutation.isPending}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {editing ? (
              <Pencil className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {mutation.isPending
              ? 'Đang lưu...'
              : editing
                ? 'Lưu thay đổi'
                : 'Tạo bản nháp'}
          </button>
        </form>

        <section className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <h2 className="font-bold text-slate-950">Danh sách bài tập</h2>
          </div>
          {assignments.isLoading ? (
            <div className="h-40 animate-pulse bg-slate-50" />
          ) : (assignments.data?.data.length ?? 0) === 0 ? (
            <div className="p-10 text-center text-slate-500">
              <ClipboardList className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3">Chưa có bài tập nào.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {assignments.data?.data.map((item) => (
                <article key={item.id} className="p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-950">{item.title}</h3>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {statusLabel[item.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.classroom_name} · {item.subject_name} · hạn{' '}
                        {dateTime(item.due_at)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.submission_count}/{item.student_count} học sinh đã
                        nộp
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void viewSubmissions(item)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                      >
                        <Eye className="h-3.5 w-3.5" /> Bài nộp
                      </button>
                      {item.status === 'draft' && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => void runAction(item, 'publish')}
                            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white"
                          >
                            <Send className="h-3.5 w-3.5" /> Giao bài
                          </button>
                          <button
                            type="button"
                            onClick={() => void runAction(item, 'delete')}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600"
                            title="Xóa bản nháp"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      {item.status === 'published' && (
                        <button
                          type="button"
                          onClick={() => void runAction(item, 'close')}
                          className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700"
                        >
                          <Archive className="h-3.5 w-3.5" /> Đóng bài
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {selected && (
          <section className="overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div>
                <p className="text-xs font-semibold text-emerald-700">
                  Bài nộp
                </p>
                <h2 className="font-bold text-slate-950">{selected.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-sm font-semibold text-slate-500"
              >
                Đóng
              </button>
            </div>
            {submissions.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">
                Chưa có học sinh nộp bài.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {submissions.map((submission) => (
                  <article
                    key={submission.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-950">
                        {submission.student_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {submission.student_code || `ID ${submission.student_user_id}`}{' '}
                        · {dateTime(submission.last_submitted_at)} ·{' '}
                        {submission.status === 'late' ? 'Nộp muộn' : 'Đã nộp'}
                      </p>
                    </div>
                    {submission.current_file && (
                      <a
                        href={resolvePublicMediaUrl(
                          submission.current_file.file_url,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"
                      >
                        <FileText className="h-4 w-4" />
                        {submission.current_file.original_name}
                      </a>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </TeacherPortalLayout>
  );
}
