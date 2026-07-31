import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/layout/AdminLayout';
import {
  archiveAdminPost,
  deleteAdminPost,
  getAdminPosts,
  publishAdminPost,
  restoreAdminPost,
} from '../../services/adminPost.service';
import { getAllAdminCategories } from '../../services/adminCategory.service';
import { useAuth } from '../../stores/auth-context';
import type { Category } from '../../types/category';
import type { Post, PostStatus } from '../../types/post';

type StatusFilter = 'all' | PostStatus | 'deleted';

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

export function AdminPostsPage() {
  const { accessToken } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  async function loadData(nextStatus = status) {
    if (!accessToken) {
      return;
    }

    try {
      setIsLoading(true);
      const [postResponse, categoryResponse] = await Promise.all([
        getAdminPosts(accessToken, { page: 1, limit: 50, status: nextStatus }),
        getAllAdminCategories(accessToken),
      ]);
      setPosts(postResponse.data);
      setCategories(categoryResponse.data);
      setError(null);
    } catch {
      setError('Không thể tải danh sách bài viết.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, status]);

  async function handlePublish(post: Post) {
    if (!accessToken) {
      return;
    }

    try {
      await publishAdminPost(accessToken, post.id);
      await loadData();
    } catch {
      setError('Không thể publish bài viết.');
    }
  }

  async function handleArchive(post: Post) {
    if (!accessToken) {
      return;
    }

    try {
      await archiveAdminPost(accessToken, post.id);
      await loadData();
    } catch {
      setError('Không thể archive bài viết.');
    }
  }

  async function handleDelete(post: Post) {
    if (!accessToken || !window.confirm(`Xóa bài viết "${post.title}"?`)) {
      return;
    }

    try {
      await deleteAdminPost(accessToken, post.id);
      await loadData();
    } catch {
      setError('Không thể xóa bài viết.');
    }
  }

  async function handleRestore(post: Post) {
    if (!accessToken) return;

    try {
      await restoreAdminPost(accessToken, post.id);
      await loadData();
    } catch {
      setError('Không thể khôi phục bài viết.');
    }
  }

  return (
    <AdminLayout>
      <section className="grid gap-5">
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-blue-700">Quản trị</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Bài viết</h2>
          </div>
          <Link
            to="/admin/posts/new"
            className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            Tạo bài viết mới
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
        {isLoading && <p className="rounded border border-slate-200 bg-white p-5 text-slate-600">Đang tải bài viết...</p>}

        {!isLoading && !error && (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {posts.length === 0 ? (
              <p className="p-5 text-slate-600">Chưa có bài viết phù hợp.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Tiêu đề</th>
                      <th className="px-4 py-3">Danh mục</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3">Published</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {posts.map((post) => (
                      <tr key={post.id}>
                        <td className="px-4 py-3 font-semibold text-slate-950">{post.title}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {post.category_id ? categoryMap.get(post.category_id) ?? '-' : '-'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {post.deleted_at ? statusLabels.deleted : statusLabels[post.status]}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(post.published_at)}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(post.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Link
                              to={`/admin/posts/${post.id}/edit`}
                              className="rounded border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:border-blue-600 hover:text-blue-700"
                            >
                              Sửa
                            </Link>
                            {post.deleted_at ? (
                              <button
                                type="button"
                                onClick={() => void handleRestore(post)}
                                className="rounded border border-emerald-200 px-3 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-50"
                              >
                                Khôi phục
                              </button>
                            ) : null}
                            {!post.deleted_at && post.status !== 'published' && (
                              <button
                                type="button"
                                onClick={() => void handlePublish(post)}
                                className="rounded border border-blue-200 px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-50"
                              >
                                Publish
                              </button>
                            )}
                            {!post.deleted_at && post.status !== 'archived' && (
                              <button
                                type="button"
                                onClick={() => void handleArchive(post)}
                                className="rounded border border-amber-200 px-3 py-1.5 font-semibold text-amber-700 hover:bg-amber-50"
                              >
                                Archive
                              </button>
                            )}
                            {!post.deleted_at && <button
                              type="button"
                              onClick={() => void handleDelete(post)}
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
