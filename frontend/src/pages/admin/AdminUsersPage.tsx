import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getAdminRoles } from '../../services/adminRole.service';
import { getAdminUsers, updateAdminUserStatus } from '../../services/adminUser.service';
import { useAuth } from '../../stores/auth-context';
import type { Role } from '../../types/role';
import type { AdminUser, UserStatus } from '../../types/user';

const statusLabels: Record<'all' | UserStatus, string> = {
  all: 'Tất cả',
  active: 'Đang hoạt động',
  inactive: 'Tạm ngưng',
  locked: 'Đã khóa',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function nextSearchParams(input: { page?: number; q?: string; role?: string; status?: string }) {
  return {
    ...(input.q ? { q: input.q } : {}),
    ...(input.role ? { role: input.role } : {}),
    ...(input.status && input.status !== 'all' ? { status: input.status } : {}),
    page: String(input.page ?? 1),
  };
}

export function AdminUsersPage() {
  const { accessToken, user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? 1);
  const q = searchParams.get('q') ?? '';
  const role = searchParams.get('role') ?? '';
  const status = searchParams.get('status') ?? 'all';
  const [searchValue, setSearchValue] = useState(q);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    if (!accessToken) {
      return;
    }

    try {
      setIsLoading(true);
      const [userResponse, roleResponse] = await Promise.all([
        getAdminUsers(accessToken, {
          page: Number.isFinite(page) && page > 0 ? page : 1,
          limit: 10,
          q,
          role,
          status: status as 'all' | UserStatus,
        }),
        getAdminRoles(accessToken),
      ]);
      setUsers(userResponse.data);
      setMeta(userResponse.meta);
      setRoles(roleResponse.data);
      setError(null);
    } catch {
      setError('Không thể tải danh sách tài khoản.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, page, q, role, status]);

  useEffect(() => {
    setSearchValue(q);
  }, [q]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchParams(nextSearchParams({ q: searchValue.trim(), role, status }));
  }

  async function handleStatus(user: AdminUser, nextStatus: UserStatus) {
    if (!accessToken) {
      return;
    }

    try {
      await updateAdminUserStatus(accessToken, user.id, nextStatus);
      await loadData();
    } catch {
      setError('Không thể cập nhật trạng thái tài khoản.');
    }
  }

  return (
    <AdminLayout>
      <section className="grid gap-5">
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-blue-700">Quản trị</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Tài khoản người dùng</h2>
          </div>
          <Link
            to="/admin/users/new"
            className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            Tạo tài khoản
          </Link>
          <Link
            to="/admin/users/bulk-students"
            className="rounded border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
          >
            Tạo tài khoản học sinh hàng loạt
          </Link>
        </div>

        <form onSubmit={handleSearch} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[1fr_180px_180px_auto]">
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Tìm theo email hoặc họ tên..."
          />
          <select
            value={role}
            onChange={(event) => setSearchParams(nextSearchParams({ q, role: event.target.value, status }))}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Tất cả role</option>
            {roles.map((item) => (
              <option key={item.id} value={item.name}>
                {item.display_name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => setSearchParams(nextSearchParams({ q, role, status: event.target.value }))}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
            Tìm kiếm
          </button>
        </form>

        {error && <p className="rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
        {isLoading && <p className="rounded border border-slate-200 bg-white p-5 text-slate-600">Đang tải tài khoản...</p>}

        {!isLoading && !error && (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {users.length === 0 ? (
              <p className="p-5 text-slate-600">Chưa có tài khoản phù hợp.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Người dùng</th>
                      <th className="px-4 py-3">Roles</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3">Ngày tạo</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-950">{user.full_name}</p>
                          <p className="text-xs text-slate-500">
                            {user.username ?? user.email ?? 'Chưa có tài khoản đăng nhập'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{user.roles.join(', ') || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{statusLabels[user.status]}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(user.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Link
                              to={`/admin/users/${user.id}/edit`}
                              className="rounded border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:border-blue-600 hover:text-blue-700"
                            >
                              Sửa
                            </Link>
                            {user.status === 'locked' ? (
                              <button
                                type="button"
                                onClick={() => void handleStatus(user, 'active')}
                                className="rounded border border-emerald-200 px-3 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-50"
                              >
                                Mở khóa
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={user.id === currentUser?.id}
                                onClick={() => void handleStatus(user, 'locked')}
                                className="rounded border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Khóa
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

        {meta && meta.totalPages > 1 && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={meta.page <= 1}
              onClick={() => setSearchParams(nextSearchParams({ q, role, status, page: meta.page - 1 }))}
              className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Trước
            </button>
            <span className="text-sm text-slate-600">
              Trang {meta.page} / {meta.totalPages}
            </span>
            <button
              type="button"
              disabled={meta.page >= meta.totalPages}
              onClick={() => setSearchParams(nextSearchParams({ q, role, status, page: meta.page + 1 }))}
              className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sau
            </button>
          </div>
        )}
      </section>
    </AdminLayout>
  );
}
