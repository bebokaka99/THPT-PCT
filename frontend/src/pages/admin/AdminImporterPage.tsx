import { useEffect, useMemo, useState, type FormEvent, type SyntheticEvent } from 'react';
import DOMPurify from 'dompurify';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/layout/AdminLayout';
import {
  convertImportedContentToPost,
  getImportedContentById,
  getImportedContents,
  updateImportedContentStatus,
} from '../../services/adminImporter.service';
import { useAuth } from '../../stores/auth-context';
import type { ImportedContentDetail, ImportedContentListItem, ImportStatus } from '../../types/importer';

type StatusFilter = ImportStatus | 'all';

function sanitizePreviewHtml(value: string | null, fallback: string | null) {
  return DOMPurify.sanitize(value ?? `<p>${fallback ?? 'Không có nội dung.'}</p>`, {
    ALLOWED_TAGS: [
      'a',
      'blockquote',
      'br',
      'em',
      'figcaption',
      'figure',
      'h1',
      'h2',
      'h3',
      'img',
      'li',
      'ol',
      'p',
      'strong',
      'ul',
    ],
    ALLOWED_ATTR: ['alt', 'href', 'src', 'target', 'rel', 'title'],
  });
}

const statusLabels: Record<StatusFilter, string> = {
  all: 'Tất cả',
  pending: 'Pending',
  imported: 'Imported',
  converted: 'Converted',
  skipped: 'Skipped',
  error: 'Error',
};

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : '-';
}

function parseJsonList(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function hideBrokenPreviewImage(event: SyntheticEvent<HTMLDivElement>) {
  const target = event.target;

  if (target instanceof HTMLImageElement) {
    target.style.display = 'none';
  }
}

export function AdminImporterPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<ImportedContentListItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ImportedContentDetail | null>(null);
  const [convertedPostId, setConvertedPostId] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  async function loadItems(nextStatus = status, nextQ = q) {
    if (!accessToken) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await getImportedContents(accessToken, {
        page: 1,
        limit: 20,
        q: nextQ,
        status: nextStatus,
      });
      setItems(response.data);
      setError(null);
    } catch {
      setError('Không thể tải danh sách dữ liệu import.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadItems(status, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, status]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadItems(status, q);
  }

  async function handleViewDetail(item: ImportedContentListItem) {
    if (!accessToken) {
      return;
    }

    try {
      setIsDetailLoading(true);
      setDetailError(null);
      setConvertedPostId(item.imported_post_id);
      setSelectedItem(await getImportedContentById(accessToken, item.id));
    } catch {
      setDetailError('Không thể tải chi tiết nội dung import.');
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function handleMarkSkipped(item: ImportedContentListItem | ImportedContentDetail) {
    if (!accessToken) {
      return;
    }

    try {
      const response = await updateImportedContentStatus(accessToken, item.id, 'skipped');
      setSelectedItem(response.data);
      setConvertedPostId(response.data.imported_post_id);
      await loadItems();
    } catch {
      setDetailError('Không thể đánh dấu skipped.');
    }
  }

  async function handleConvert(item: ImportedContentListItem | ImportedContentDetail) {
    if (!accessToken) {
      return;
    }

    try {
      setDetailError(null);
      const response = await convertImportedContentToPost(accessToken, item.id);
      setSelectedItem(response.data.importedContent);
      setConvertedPostId(response.data.post.id);
      setItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === item.id
            ? {
                ...currentItem,
                import_status: 'converted',
                status: 'converted',
                imported_post_id: response.data.post.id,
              }
            : currentItem,
        ),
      );
      await loadItems();
    } catch {
      setDetailError('Không thể convert nội dung import sang bài viết.');
    }
  }

  const selectedImages = useMemo(() => parseJsonList(selectedItem?.images_json ?? null), [selectedItem]);
  const selectedAttachments = useMemo(
    () => parseJsonList(selectedItem?.attachments_json ?? null),
    [selectedItem],
  );

  return (
    <AdminLayout>
      <section className="grid gap-5">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold uppercase text-blue-700">Importer</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">Import dữ liệu website cũ</h2>
          <p className="mt-2 text-sm text-slate-600">
            Review dữ liệu đã crawl, bỏ qua record không phù hợp hoặc convert sang bài viết draft.
          </p>
        </div>

        <form
          onSubmit={(event) => void handleSearch(event)}
          className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[1fr_220px_auto]"
        >
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Tìm kiếm
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Tiêu đề, mô tả, source URL..."
              className="rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Trạng thái
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
          <button
            type="submit"
            className="self-end rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Lọc
          </button>
        </form>

        {error && <p className="rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
        {isLoading && <p className="rounded border border-slate-200 bg-white p-5 text-slate-600">Đang tải dữ liệu import...</p>}

        {!isLoading && (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {items.length === 0 ? (
              <p className="p-5 text-slate-600">Chưa có dữ liệu import phù hợp.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Tiêu đề</th>
                      <th className="px-4 py-3">Danh mục</th>
                      <th className="px-4 py-3">Nguồn</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3">Ngày import</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="max-w-md px-4 py-3">
                          <p className="font-semibold text-slate-950">{item.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.excerpt}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{item.category_name ?? '-'}</td>
                        <td className="px-4 py-3">
                          <a
                            href={item.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-blue-700 hover:underline"
                          >
                            {item.source_site}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{statusLabels[item.import_status]}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(item.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void handleViewDetail(item)}
                              className="rounded border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:border-blue-600 hover:text-blue-700"
                            >
                              Chi tiết
                            </button>
                            {item.import_status === 'converted' && item.imported_post_id ? (
                              <Link
                                to={`/admin/posts/${item.imported_post_id}/edit`}
                                className="rounded border border-blue-200 px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-50"
                              >
                                Sửa post
                              </Link>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void handleConvert(item)}
                                className="rounded border border-blue-200 px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-50"
                              >
                                Convert draft
                              </button>
                            )}
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

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-slate-950">Chi tiết nội dung import</h3>
            {isDetailLoading && <span className="text-sm text-slate-500">Đang tải chi tiết...</span>}
          </div>

          {detailError && (
            <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {detailError}
            </p>
          )}

          {!selectedItem ? (
            <p className="mt-3 text-sm text-slate-600">Chọn một record để xem chi tiết.</p>
          ) : (
            <div className="mt-4 grid gap-4">
              <div>
                <h4 className="text-xl font-bold text-slate-950">{selectedItem.title}</h4>
                <p className="mt-2 text-sm text-slate-600">{selectedItem.excerpt}</p>
              </div>

              <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                <p>
                  <span className="font-semibold text-slate-950">Danh mục:</span>{' '}
                  {selectedItem.category_name ?? '-'}
                </p>
                <p>
                  <span className="font-semibold text-slate-950">Trạng thái:</span>{' '}
                  {statusLabels[selectedItem.import_status]}
                </p>
                <p className="md:col-span-2">
                  <span className="font-semibold text-slate-950">Nguồn:</span>{' '}
                  <a
                    href={selectedItem.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-blue-700 hover:underline"
                  >
                    {selectedItem.source_url}
                  </a>
                </p>
                <p>
                  <span className="font-semibold text-slate-950">Post đã convert:</span>{' '}
                  {convertedPostId || selectedItem.imported_post_id ? (
                    <Link
                      to={`/admin/posts/${convertedPostId ?? selectedItem.imported_post_id}/edit`}
                      className="text-blue-700 hover:underline"
                    >
                      /admin/posts/{convertedPostId ?? selectedItem.imported_post_id}/edit
                    </Link>
                  ) : (
                    '-'
                  )}
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-950">Content preview</p>
                <div
                  className="mt-2 max-h-96 overflow-auto rounded border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded"
                  onErrorCapture={hideBrokenPreviewImage}
                  dangerouslySetInnerHTML={{
                    __html: sanitizePreviewHtml(selectedItem.content_html, selectedItem.content_text),
                  }}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <JsonList title="Images" items={selectedImages} />
                <JsonList title="Attachments" items={selectedAttachments} />
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedItem.import_status === 'converted' && (convertedPostId || selectedItem.imported_post_id) ? (
                  <Link
                    to={`/admin/posts/${convertedPostId ?? selectedItem.imported_post_id}/edit`}
                    className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                  >
                    Mở bài viết đã convert
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleConvert(selectedItem)}
                    className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                  >
                    Convert to post draft
                  </button>
                )}
                {selectedItem.import_status !== 'converted' && selectedItem.import_status !== 'skipped' && (
                  <button
                    type="button"
                    onClick={() => void handleMarkSkipped(selectedItem)}
                    className="rounded border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50"
                  >
                    Mark skipped
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </AdminLayout>
  );
}

function JsonList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Không có dữ liệu.</p>
      ) : (
        <ul className="mt-2 grid gap-2 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          {items.map((item) => (
            <li key={item} className="break-all">
              <a href={item} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                {item}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
