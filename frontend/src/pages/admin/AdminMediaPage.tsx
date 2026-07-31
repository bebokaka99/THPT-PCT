import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { resolveMediaDisplayUrl, resolvePublicMediaUrl } from '../../lib/media-url';
import {
  deleteAdminMedia,
  getAdminMedia,
  uploadMedia,
} from '../../services/adminMedia.service';
import { useAuth } from '../../stores/auth-context';
import type { MediaFile, MediaType } from '../../types/media';

type MediaFilter = 'all' | MediaType;

const filterLabels: Record<MediaFilter, string> = {
  all: 'Tất cả',
  image: 'Ảnh',
  document: 'Tài liệu',
  other: 'Khác',
};

function formatSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function AdminMediaPage() {
  const { accessToken } = useAuth();
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const filteredType = useMemo(() => (filter === 'all' ? undefined : filter), [filter]);

  async function loadMedia() {
    if (!accessToken) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await getAdminMedia(accessToken, {
        type: filteredType,
        page: 1,
        limit: 20,
      });
      setMediaFiles(response.data);
      setError(null);
    } catch {
      setError('Không thể tải danh sách media.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, filteredType]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !accessToken) {
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      await uploadMedia(accessToken, file);
      event.target.value = '';
      await loadMedia();
    } catch {
      setError('Upload thất bại. Kiểm tra định dạng file và dung lượng tối đa 10MB.');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCopy(url: string) {
    const publicUrl = resolvePublicMediaUrl(url);

    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopyMessage('Đã copy URL.');
    } catch {
      setCopyMessage(publicUrl);
    }
  }

  async function handleDelete(file: MediaFile) {
    if (!accessToken || !window.confirm(`Xóa file "${file.original_name}"?`)) {
      return;
    }

    try {
      await deleteAdminMedia(accessToken, file.id);
      await loadMedia();
    } catch {
      setError('Không thể xóa media.');
    }
  }

  return (
    <AdminLayout>
      <section className="grid gap-5">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold uppercase text-blue-700">Quản trị</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">Media / Tệp tin</h2>
        </div>

        <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-[1fr_220px]">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Upload file
            <input
              type="file"
              onChange={(event) => void handleFileChange(event)}
              disabled={isUploading}
              accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx"
              className="rounded border border-slate-300 px-3 py-2 font-normal"
            />
            <span className="text-xs font-normal text-slate-500">
              Cho phép jpg, jpeg, png, webp, pdf, doc, docx, xls, xlsx. Tối đa 10MB.
            </span>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Lọc loại
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as MediaFilter)}
              className="rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
            >
              {Object.entries(filterLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isUploading && <p className="rounded border border-blue-200 bg-blue-50 p-4 text-blue-700">Đang upload...</p>}
        {error && <p className="rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
        {copyMessage && <p className="rounded border border-green-200 bg-green-50 p-4 text-green-700">{copyMessage}</p>}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {isLoading ? (
            <p className="p-5 text-slate-600">Đang tải media...</p>
          ) : mediaFiles.length === 0 ? (
            <p className="p-5 text-slate-600">Chưa có media.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Preview</th>
                    <th className="px-4 py-3">Tên file</th>
                    <th className="px-4 py-3">MIME</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">URL</th>
                    <th className="px-4 py-3">Ngày tạo</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {mediaFiles.map((file) => {
                    const publicUrl = resolveMediaDisplayUrl(file, 'thumbnail');

                    return (
                      <tr key={file.id}>
                        <td className="px-4 py-3">
                          {file.type === 'image' ? (
                            <img
                              src={publicUrl}
                              alt={file.original_name}
                              className="h-14 w-20 rounded object-cover"
                            />
                          ) : (
                            <span className="rounded bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                              {file.type}
                            </span>
                          )}
                        </td>
                        <td className="max-w-xs px-4 py-3 font-semibold text-slate-950">
                          {file.original_name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{file.mime_type}</td>
                        <td className="px-4 py-3 text-slate-600">{formatSize(file.size)}</td>
                        <td className="max-w-xs truncate px-4 py-3 text-slate-600">{publicUrl}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(file.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void handleCopy(file.url)}
                              className="rounded border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:border-blue-600 hover:text-blue-700"
                            >
                              Copy URL
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(file)}
                              className="rounded border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50"
                            >
                              Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </AdminLayout>
  );
}
