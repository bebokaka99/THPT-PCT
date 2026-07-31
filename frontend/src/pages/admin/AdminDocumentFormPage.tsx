import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { resolvePublicMediaUrl } from '../../lib/media-url';
import {
  createAdminDocument,
  getAdminDocumentById,
  updateAdminDocument,
} from '../../services/adminDocument.service';
import { getAdminMedia, uploadMedia } from '../../services/adminMedia.service';
import { useAuth } from '../../stores/auth-context';
import type { DocumentFormInput, DocumentStatus } from '../../types/document';
import type { MediaFile } from '../../types/media';

const emptyForm: DocumentFormInput = {
  title: '',
  slug: '',
  description: '',
  category: '',
  document_url: '',
  file_type: '',
  file_size: 0,
  status: 'draft',
};

function formatFileSize(value: number | undefined) {
  if (!value) {
    return '-';
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function AdminDocumentFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const isEdit = Boolean(id);
  const [form, setForm] = useState<DocumentFormInput>(emptyForm);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!accessToken) {
        return;
      }

      try {
        setIsLoading(true);
        let nextForm = emptyForm;

        if (id) {
          const document = await getAdminDocumentById(accessToken, Number(id));
          nextForm = {
            title: document.title,
            slug: document.slug,
            description: document.description ?? '',
            category: document.category ?? '',
            document_url: document.document_url,
            file_type: document.file_type ?? '',
            file_size: document.file_size,
            status: document.status,
          };
        }

        if (isMounted) {
          setForm(nextForm);
          setError(null);
        }
      } catch {
        if (isMounted) {
          setError('Không thể tải dữ liệu form tài liệu.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [accessToken, id]);

  async function loadMediaFiles() {
    if (!accessToken) {
      return;
    }

    try {
      setIsLoadingMedia(true);
      const response = await getAdminMedia(accessToken, {
        type: 'document',
        page: 1,
        limit: 20,
      });
      setMediaFiles(response.data);
      setError(null);
    } catch {
      setError('Không thể tải danh sách file media.');
    } finally {
      setIsLoadingMedia(false);
    }
  }

  function updateField<K extends keyof DocumentFormInput>(key: K, value: DocumentFormInput[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function applyMedia(file: MediaFile) {
    setForm((current) => ({
      ...current,
      document_url: file.url,
      file_type: file.mime_type,
      file_size: file.size,
    }));
    setShowMediaPicker(false);
  }

  async function handleOpenMediaPicker() {
    setShowMediaPicker((current) => !current);

    if (!showMediaPicker && mediaFiles.length === 0) {
      await loadMediaFiles();
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !accessToken) {
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      const response = await uploadMedia(accessToken, file);
      applyMedia(response.data);
      event.target.value = '';
      await loadMediaFiles();
    } catch {
      setError('Upload file thất bại. Chỉ hỗ trợ pdf, doc, docx, xls, xlsx, tối đa 10MB.');
    } finally {
      setIsUploading(false);
    }
  }

  function normalizeInput(): DocumentFormInput {
    return {
      title: form.title.trim(),
      slug: form.slug?.trim() || undefined,
      description: form.description?.trim() || null,
      category: form.category?.trim() || null,
      document_url: form.document_url.trim(),
      file_type: form.file_type?.trim() || null,
      file_size: form.file_size ?? 0,
      status: form.status ?? 'draft',
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setError('Phiên đăng nhập không hợp lệ.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      const input = normalizeInput();

      if (id) {
        await updateAdminDocument(accessToken, Number(id), input);
      } else {
        await createAdminDocument(accessToken, input);
      }

      navigate('/admin/documents');
    } catch {
      setError('Không thể lưu tài liệu. Vui lòng kiểm tra dữ liệu.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminLayout>
      <section className="mx-auto max-w-4xl">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <Link to="/admin/documents" className="text-sm font-semibold text-blue-700">
            Quay lại danh sách
          </Link>
          <h2 className="mt-3 text-2xl font-bold text-slate-950">
            {isEdit ? 'Sửa tài liệu' : 'Tạo tài liệu mới'}
          </h2>
        </div>

        {error && <p className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
        {isLoading ? (
          <p className="mt-4 rounded border border-slate-200 bg-white p-5 text-slate-600">Đang tải form...</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 grid gap-4 rounded-lg border border-slate-200 bg-white p-5">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Tiêu đề
              <input
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
                required
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Slug tùy chọn
              <input
                value={form.slug ?? ''}
                onChange={(event) => updateField('slug', event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
                placeholder="Để trống để backend tự tạo"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Mô tả
              <textarea
                value={form.description ?? ''}
                onChange={(event) => updateField('description', event.target.value)}
                className="min-h-28 rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Danh mục
                <input
                  value={form.category ?? ''}
                  onChange={(event) => updateField('category', event.target.value)}
                  className="rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
                  placeholder="Ví dụ: Công văn, Biểu mẫu"
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Trạng thái
                <select
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value as DocumentStatus)}
                  className="rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
                >
                  <option value="draft">Nháp</option>
                  <option value="published">Đã xuất bản</option>
                  <option value="archived">Đã lưu trữ</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Document URL
                <input
                  value={form.document_url}
                  onChange={(event) => updateField('document_url', event.target.value)}
                  className="rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
                  required
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleOpenMediaPicker()}
                  className="rounded border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                >
                  Chọn file từ Media
                </button>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Upload file mới
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={(event) => void handleUpload(event)}
                    disabled={isUploading}
                    className="rounded border border-slate-300 px-3 py-2 text-sm font-normal"
                  />
                </label>
              </div>

              {showMediaPicker && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-700">File tài liệu trong Media</p>
                    <button
                      type="button"
                      onClick={() => void loadMediaFiles()}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      Tải lại
                    </button>
                  </div>
                  {isLoadingMedia ? (
                    <p className="mt-3 text-sm text-slate-600">Đang tải media...</p>
                  ) : mediaFiles.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-600">Chưa có file tài liệu trong media.</p>
                  ) : (
                    <div className="mt-3 grid gap-2">
                      {mediaFiles.map((file) => (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => applyMedia(file)}
                          className="rounded border border-slate-200 bg-white p-3 text-left text-sm hover:border-blue-500"
                        >
                          <span className="font-semibold text-slate-950">{file.original_name}</span>
                          <span className="ml-2 text-slate-500">
                            {file.mime_type} · {formatFileSize(file.size)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {form.document_url && (
                <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">File hiện tại</p>
                  <p className="mt-1 break-all">{form.document_url}</p>
                  <p className="mt-1">
                    {form.file_type || 'Không rõ loại file'} · {formatFileSize(form.file_size)}
                  </p>
                  <a
                    href={resolvePublicMediaUrl(form.document_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block rounded border border-blue-200 px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    Mở file
                  </a>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Link
                to="/admin/documents"
                className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Hủy
              </Link>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu tài liệu'}
              </button>
            </div>
          </form>
        )}
      </section>
    </AdminLayout>
  );
}
