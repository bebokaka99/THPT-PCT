import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Archive,
  Download,
  ExternalLink,
  FileText,
  Pencil,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  archiveClassroomDocument,
  archiveClassroomPost,
  createClassroomDocument,
  createClassroomPost,
  deleteClassroomDocument,
  deleteClassroomPost,
  publishClassroomDocument,
  publishClassroomPost,
  updateClassroomDocument,
  updateClassroomPost,
} from '../../services/classroom.service';
import { getAdminMedia, uploadMedia } from '../../services/adminMedia.service';
import { resolvePublicMediaUrl } from '../../lib/media-url';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type {
  ClassroomContentStatus,
  ClassroomDocument,
  ClassroomPost,
} from '../../types/classroom';
import type { MediaFile } from '../../types/media';

type ContentPanelProps<T> = {
  classroomId: number;
  items: T[];
  onChanged: () => Promise<unknown>;
};

type PublishChoice = 'draft' | 'published';

function formatDate(value?: string | null) {
  if (!value) return 'Chưa xuất bản';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusLabel(status: ClassroomContentStatus) {
  if (status === 'published') return 'Đã đăng';
  if (status === 'archived') return 'Lưu trữ';
  return 'Bản nháp';
}

function statusClass(status: ClassroomContentStatus) {
  if (status === 'published') return 'bg-emerald-50 text-emerald-700';
  if (status === 'archived') return 'bg-slate-100 text-slate-600';
  return 'bg-amber-50 text-amber-700';
}

function fileNameFromUrl(value: string) {
  try {
    return decodeURIComponent(value.split('/').pop() || value);
  } catch {
    return value;
  }
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <p className="border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
      {text}
    </p>
  );
}

export function TeacherClassPostsPanel({
  classroomId,
  items: posts,
  onChanged,
}: ContentPanelProps<ClassroomPost>) {
  const { accessToken, roles, user } = useAuth();
  const toast = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    title: string;
    content: string;
    status: PublishChoice;
  }>({ title: '', content: '', status: 'draft' });

  function resetForm() {
    setEditingId(null);
    setForm({ title: '', content: '', status: 'draft' });
    setFormError(null);
  }

  function editPost(post: ClassroomPost) {
    setEditingId(post.id);
    setForm({
      title: post.title,
      content: post.content ?? '',
      status: post.status === 'published' ? 'published' : 'draft',
    });
    setFormError(null);
  }

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || isSaving) return;
    const title = form.title.trim();
    if (!title) {
      setFormError('Vui lòng nhập tiêu đề thông báo.');
      return;
    }

    try {
      setIsSaving(true);
      setFormError(null);
      if (editingId) {
        const existing = posts.find((item) => item.id === editingId);
        const shouldPublish =
          form.status === 'published' && existing?.status !== 'published';
        await updateClassroomPost(accessToken, classroomId, editingId, {
          title,
          content: form.content.trim(),
          status: shouldPublish ? 'draft' : form.status,
        });
        if (shouldPublish) {
          await publishClassroomPost(accessToken, classroomId, editingId);
        }
        toast.success('Đã cập nhật thông báo lớp.');
      } else {
        const created = await createClassroomPost(accessToken, classroomId, {
          title,
          content: form.content.trim(),
          status: 'draft',
        });
        if (form.status === 'published') {
          await publishClassroomPost(accessToken, classroomId, created.data.id);
        }
        toast.success(
          form.status === 'published'
            ? 'Đã đăng thông báo và gửi notification cho học sinh.'
            : 'Đã lưu bản nháp thông báo.',
        );
      }
      resetForm();
      await onChanged();
    } catch {
      setFormError('Không thể lưu thông báo. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  }

  async function changeStatus(post: ClassroomPost, next: 'published' | 'archived') {
    if (!accessToken || actionId) return;
    try {
      setActionId(post.id);
      if (next === 'published') {
        await publishClassroomPost(accessToken, classroomId, post.id);
        toast.success('Đã xuất bản thông báo cho học sinh.');
      } else {
        await archiveClassroomPost(accessToken, classroomId, post.id);
        toast.success('Đã lưu trữ thông báo.');
      }
      await onChanged();
    } finally {
      setActionId(null);
    }
  }

  async function removePost(post: ClassroomPost) {
    if (
      !accessToken ||
      actionId ||
      !window.confirm(`Xóa thông báo “${post.title}”?`)
    ) {
      return;
    }
    try {
      setActionId(post.id);
      await deleteClassroomPost(accessToken, classroomId, post.id);
      if (editingId === post.id) resetForm();
      toast.success('Đã xóa thông báo.');
      await onChanged();
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
      <form
        onSubmit={submitPost}
        className="grid content-start gap-4 border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-950">
              {editingId ? 'Chỉnh sửa thông báo' : 'Tạo thông báo'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Nên lưu nháp để kiểm tra trước khi đăng.
            </p>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Hủy chỉnh sửa"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Tiêu đề
          <input
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
            className="rounded-md border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-600"
            placeholder="Nhập tiêu đề thông báo"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Nội dung
          <textarea
            value={form.content}
            onChange={(event) =>
              setForm((current) => ({ ...current, content: event.target.value }))
            }
            className="min-h-32 rounded-md border border-slate-300 px-3 py-2.5 font-normal leading-6 outline-none focus:border-emerald-600"
            placeholder="Nội dung gửi tới học sinh"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
          Sau khi lưu
          <select
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                status: event.target.value as PublishChoice,
              }))
            }
            className="rounded-md border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-600"
          >
            <option value="draft">Lưu bản nháp</option>
            <option value="published">Đăng cho học sinh</option>
          </select>
        </label>
        {formError && <p className="text-sm text-red-700">{formError}</p>}
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {isSaving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Lưu thông báo'}
        </button>
      </form>

      <section className="grid content-start gap-3">
        {posts.length === 0 && <EmptyPanel text="Chưa có thông báo trong lớp." />}
        {posts.map((post) => {
          const canEdit = roles.includes('admin') || post.author_user_id === user?.id;
          return (
            <article key={post.id} className="border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-950">{post.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {post.author_name && `${post.author_name} · `}
                    {formatDate(post.published_at || post.created_at)}
                  </p>
                </div>
                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(
                    post.status,
                  )}`}
                >
                  {statusLabel(post.status)}
                </span>
              </div>
              {post.content && (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {post.content}
                </p>
              )}
              {canEdit && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => editPost(post)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-300"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Sửa
                  </button>
                  {post.status !== 'published' && (
                    <button
                      type="button"
                      onClick={() => void changeStatus(post, 'published')}
                      disabled={actionId === post.id}
                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white"
                    >
                      <Send className="h-3.5 w-3.5" /> Đăng
                    </button>
                  )}
                  {post.status !== 'archived' && (
                    <button
                      type="button"
                      onClick={() => void changeStatus(post, 'archived')}
                      disabled={actionId === post.id}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600"
                    >
                      <Archive className="h-3.5 w-3.5" /> Lưu trữ
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void removePost(post)}
                    disabled={actionId === post.id}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Xóa
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}

export function TeacherClassDocumentsPanel({
  classroomId,
  items: documents,
  onChanged,
}: ContentPanelProps<ClassroomDocument>) {
  const { accessToken, roles, user } = useAuth();
  const toast = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [mediaQuery, setMediaQuery] = useState('');
  const [isMediaLoading, setIsMediaLoading] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [form, setForm] = useState<{
    title: string;
    description: string;
    file_url: string;
    status: PublishChoice;
  }>({ title: '', description: '', file_url: '', status: 'draft' });

  const filteredMedia = useMemo(() => {
    const query = mediaQuery.trim().toLocaleLowerCase('vi');
    if (!query) return media;
    return media.filter((item) =>
      item.original_name.toLocaleLowerCase('vi').includes(query),
    );
  }, [media, mediaQuery]);

  function resetForm() {
    setEditingId(null);
    setForm({ title: '', description: '', file_url: '', status: 'draft' });
    setFormError(null);
  }

  function editDocument(document: ClassroomDocument) {
    setEditingId(document.id);
    setForm({
      title: document.title,
      description: document.description ?? '',
      file_url: document.file_url,
      status: document.status === 'published' ? 'published' : 'draft',
    });
    setFormError(null);
  }

  async function submitDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || isSaving) return;
    const title = form.title.trim();
    const fileUrl = form.file_url.trim();
    if (!title || !fileUrl) {
      setFormError('Vui lòng nhập tiêu đề và chọn tệp tài liệu.');
      return;
    }

    try {
      setIsSaving(true);
      setFormError(null);
      if (editingId) {
        const existing = documents.find((item) => item.id === editingId);
        const shouldPublish =
          form.status === 'published' && existing?.status !== 'published';
        await updateClassroomDocument(accessToken, classroomId, editingId, {
          title,
          description: form.description.trim(),
          file_url: fileUrl,
          status: shouldPublish ? 'draft' : form.status,
        });
        if (shouldPublish) {
          await publishClassroomDocument(accessToken, classroomId, editingId);
        }
        toast.success('Đã cập nhật tài liệu lớp.');
      } else {
        const created = await createClassroomDocument(accessToken, classroomId, {
          title,
          description: form.description.trim(),
          file_url: fileUrl,
          status: 'draft',
        });
        if (form.status === 'published') {
          await publishClassroomDocument(accessToken, classroomId, created.data.id);
        }
        toast.success(
          form.status === 'published'
            ? 'Đã đăng tài liệu và gửi notification cho học sinh.'
            : 'Đã lưu bản nháp tài liệu.',
        );
      }
      resetForm();
      await onChanged();
    } catch {
      setFormError('Không thể lưu tài liệu. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !accessToken) return;
    try {
      setIsUploading(true);
      setFormError(null);
      const response = await uploadMedia(accessToken, file);
      setForm((current) => ({
        ...current,
        title: current.title || response.data.original_name,
        file_url: response.data.url,
      }));
      toast.success('Đã upload tệp lên Media.');
    } catch {
      setFormError('Không thể upload tệp. Kiểm tra định dạng và dung lượng 10 MB.');
    } finally {
      setIsUploading(false);
    }
  }

  async function openMediaPicker() {
    if (!accessToken) return;
    try {
      setIsPickerOpen(true);
      setIsMediaLoading(true);
      const response = await getAdminMedia(accessToken, {
        type: 'document',
        page: 1,
        limit: 50,
      });
      setMedia(response.data);
    } finally {
      setIsMediaLoading(false);
    }
  }

  async function changeStatus(
    document: ClassroomDocument,
    next: 'published' | 'archived',
  ) {
    if (!accessToken || actionId) return;
    try {
      setActionId(document.id);
      if (next === 'published') {
        await publishClassroomDocument(accessToken, classroomId, document.id);
        toast.success('Đã xuất bản tài liệu cho học sinh.');
      } else {
        await archiveClassroomDocument(accessToken, classroomId, document.id);
        toast.success('Đã lưu trữ tài liệu.');
      }
      await onChanged();
    } finally {
      setActionId(null);
    }
  }

  async function removeDocument(document: ClassroomDocument) {
    if (
      !accessToken ||
      actionId ||
      !window.confirm(`Xóa tài liệu “${document.title}”?`)
    ) {
      return;
    }
    try {
      setActionId(document.id);
      await deleteClassroomDocument(accessToken, classroomId, document.id);
      if (editingId === document.id) resetForm();
      toast.success('Đã xóa tài liệu lớp.');
      await onChanged();
    } finally {
      setActionId(null);
    }
  }

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <form
          onSubmit={submitDocument}
          className="grid content-start gap-4 border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-950">
                {editingId ? 'Chỉnh sửa tài liệu' : 'Thêm tài liệu'}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Upload tệp hoặc chọn từ thư viện Media.
              </p>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Hủy chỉnh sửa"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Tiêu đề
            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              className="rounded-md border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-600"
              placeholder="Tên tài liệu"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            URL tệp
            <input
              value={form.file_url}
              onChange={(event) =>
                setForm((current) => ({ ...current, file_url: event.target.value }))
              }
              className="rounded-md border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-600"
              placeholder="/uploads/documents/..."
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300">
              <Upload className="h-4 w-4" />
              {isUploading ? 'Đang upload...' : 'Upload tệp'}
              <input
                type="file"
                className="hidden"
                disabled={isUploading}
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleUpload}
              />
            </label>
            <button
              type="button"
              onClick={() => void openMediaPicker()}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300"
            >
              Chọn từ Media
            </button>
          </div>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Mô tả
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              className="min-h-24 rounded-md border border-slate-300 px-3 py-2.5 font-normal leading-6 outline-none focus:border-emerald-600"
              placeholder="Mô tả ngắn cho học sinh"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Sau khi lưu
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  status: event.target.value as PublishChoice,
                }))
              }
              className="rounded-md border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-600"
            >
              <option value="draft">Lưu bản nháp</option>
              <option value="published">Đăng cho học sinh</option>
            </select>
          </label>
          {formError && <p className="text-sm text-red-700">{formError}</p>}
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <FileText className="h-4 w-4" />
            {isSaving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Lưu tài liệu'}
          </button>
        </form>

        <section className="grid content-start gap-3">
          {documents.length === 0 && <EmptyPanel text="Chưa có tài liệu trong lớp." />}
          {documents.map((document) => {
            const canEdit =
              roles.includes('admin') || document.author_user_id === user?.id;
            const fileUrl = resolvePublicMediaUrl(document.file_url);
            return (
              <article
                key={document.id}
                className="border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-950">{document.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {document.author_name && `${document.author_name} · `}
                      {formatDate(document.published_at || document.created_at)}
                    </p>
                    {document.description && (
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {document.description}
                      </p>
                    )}
                    <p className="mt-2 break-all text-xs text-slate-400">
                      {fileNameFromUrl(document.file_url)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(
                        document.status,
                      )}`}
                    >
                      {statusLabel(document.status)}
                    </span>
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-slate-300 p-2 text-slate-600 hover:text-emerald-700"
                      title="Mở tệp"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <a
                      href={fileUrl}
                      download
                      className="rounded-md border border-slate-300 p-2 text-slate-600 hover:text-emerald-700"
                      title="Tải tệp"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </div>
                </div>
                {canEdit && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => editDocument(document)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Sửa
                    </button>
                    {document.status !== 'published' && (
                      <button
                        type="button"
                        onClick={() => void changeStatus(document, 'published')}
                        disabled={actionId === document.id}
                        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white"
                      >
                        <Send className="h-3.5 w-3.5" /> Đăng
                      </button>
                    )}
                    {document.status !== 'archived' && (
                      <button
                        type="button"
                        onClick={() => void changeStatus(document, 'archived')}
                        disabled={actionId === document.id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600"
                      >
                        <Archive className="h-3.5 w-3.5" /> Lưu trữ
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void removeDocument(document)}
                      disabled={actionId === document.id}
                      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Xóa
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </div>

      {isPickerOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Chọn tài liệu từ Media"
        >
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Thư viện tài liệu</h2>
                <p className="mt-1 text-sm text-slate-500">Chọn một tệp đã upload.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="rounded-md border border-slate-300 p-2 text-slate-600"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              value={mediaQuery}
              onChange={(event) => setMediaQuery(event.target.value)}
              placeholder="Tìm theo tên tệp"
              className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
            />
            <div className="mt-4 grid gap-2">
              {isMediaLoading && (
                <p className="p-5 text-center text-sm text-slate-500">
                  Đang tải thư viện...
                </p>
              )}
              {!isMediaLoading && filteredMedia.length === 0 && (
                <EmptyPanel text="Không có tài liệu phù hợp trong Media." />
              )}
              {filteredMedia.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => {
                    setForm((current) => ({
                      ...current,
                      title: current.title || file.original_name,
                      file_url: file.url,
                    }));
                    setIsPickerOpen(false);
                  }}
                  className="flex items-start gap-3 border border-slate-200 p-3 text-left hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{file.original_name}</p>
                    <p className="mt-1 break-all text-xs text-slate-500">{file.url}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
