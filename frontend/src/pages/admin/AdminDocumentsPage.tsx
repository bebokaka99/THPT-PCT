import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/layout/AdminLayout';
import {
  archiveAdminDocument,
  deleteAdminDocument,
  getAdminDocuments,
  publishAdminDocument,
  restoreAdminDocument,
} from '../../services/adminDocument.service';
import { useAuth } from '../../stores/auth-context';
import type { DocumentStatus, SchoolDocument } from '../../types/document';

type StatusFilter = 'all' | DocumentStatus | 'deleted';

const statusLabels: Record<string, string> = {
  all: 'Tất cả',
  draft: 'Nháp',
  published: 'Đã xuất bản',
  archived: 'Đã lưu trữ',
};

statusLabels.deleted = 'Đã xóa';

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(value))
    : '-';
}

function formatFileSize(value: number) {
  if (!value) {
    return '-';
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function AdminDocumentsPage() {
  const { accessToken } = useAuth();
  const [documents, setDocuments] = useState<SchoolDocument[]>([]);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDocuments(nextStatus = status) {
    if (!accessToken) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await getAdminDocuments(accessToken, {
        page: 1,
        limit: 50,
        status: nextStatus,
      });
      setDocuments(response.data);
      setError(null);
    } catch {
      setError('Không thể tải danh sách tài liệu.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDocuments(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, status]);

  async function handlePublish(document: SchoolDocument) {
    if (!accessToken) {
      return;
    }

    try {
      await publishAdminDocument(accessToken, document.id);
      await loadDocuments();
    } catch {
      setError('Không thể publish tài liệu.');
    }
  }

  async function handleArchive(document: SchoolDocument) {
    if (!accessToken) {
      return;
    }

    try {
      await archiveAdminDocument(accessToken, document.id);
      await loadDocuments();
    } catch {
      setError('Không thể archive tài liệu.');
    }
  }

  async function handleDelete(document: SchoolDocument) {
    if (!accessToken || !window.confirm(`Xóa tài liệu "${document.title}"?`)) {
      return;
    }

    try {
      await deleteAdminDocument(accessToken, document.id);
      await loadDocuments();
    } catch {
      setError('Không thể xóa tài liệu.');
    }
  }

  async function handleRestore(document: SchoolDocument) {
    if (!accessToken) return;

    try {
      await restoreAdminDocument(accessToken, document.id);
      await loadDocuments();
    } catch {
      setError('Không thể khôi phục tài liệu.');
    }
  }

  return (
    <AdminLayout>
      <section className="grid gap-5">
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-blue-700">Quản trị</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Tài liệu / văn bản</h2>
          </div>
          <Link
            to="/admin/documents/new"
            className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            Tạo tài liệu mới
          </Link>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <label className="flex max-w-xs flex-col gap-2 text-sm font-semibold text-slate-700">
            Lọc trạng thái
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
              className="rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
        {isLoading && <p className="rounded border border-slate-200 bg-white p-5 text-slate-600">Đang tải tài liệu...</p>}

        {!isLoading && !error && (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {documents.length === 0 ? (
              <p className="p-5 text-slate-600">Chưa có tài liệu phù hợp.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Tiêu đề</th>
                      <th className="px-4 py-3">Danh mục</th>
                      <th className="px-4 py-3">File</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3">Published</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {documents.map((document) => (
                      <tr key={document.id}>
                        <td className="px-4 py-3 font-semibold text-slate-950">{document.title}</td>
                        <td className="px-4 py-3 text-slate-600">{document.category ?? '-'}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {document.file_type ?? '-'} · {formatFileSize(document.file_size)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {document.deleted_at ? statusLabels.deleted : statusLabels[document.status]}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(document.published_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Link
                              to={`/admin/documents/${document.id}/edit`}
                              className="rounded border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:border-blue-600 hover:text-blue-700"
                            >
                              Sửa
                            </Link>
                            {document.deleted_at ? (
                              <button
                                type="button"
                                onClick={() => void handleRestore(document)}
                                className="rounded border border-emerald-200 px-3 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-50"
                              >
                                Khôi phục
                              </button>
                            ) : null}
                            {!document.deleted_at && document.status !== 'published' && (
                              <button
                                type="button"
                                onClick={() => void handlePublish(document)}
                                className="rounded border border-blue-200 px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-50"
                              >
                                Publish
                              </button>
                            )}
                            {!document.deleted_at && document.status !== 'archived' && (
                              <button
                                type="button"
                                onClick={() => void handleArchive(document)}
                                className="rounded border border-amber-200 px-3 py-1.5 font-semibold text-amber-700 hover:bg-amber-50"
                              >
                                Archive
                              </button>
                            )}
                            {!document.deleted_at && <button
                              type="button"
                              onClick={() => void handleDelete(document)}
                              className="rounded border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50"
                            >
                              Xóa
                            </button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </AdminLayout>
  );
}
