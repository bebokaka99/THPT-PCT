import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  FileText,
  HardDrive,
  Image,
  Layers3,
  Newspaper,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getAdminDashboardOverview } from '../../services/dashboard.service';
import { useAuth } from '../../stores/auth-context';

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusLabel(status: string) {
  if (status === 'published') return 'Đã đăng';
  if (status === 'draft') return 'Bản nháp';
  if (status === 'archived') return 'Lưu trữ';
  if (status === 'scheduled') return 'Đã lên lịch';
  return status;
}

function StatCard({
  accent,
  icon: Icon,
  label,
  value,
}: {
  accent: string;
  icon: typeof UsersRound;
  label: string;
  value: number | string;
}) {
  return (
    <div className="border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-bold text-slate-950">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{label}</p>
        </div>
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-md ${accent}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

export function AdminDashboardPage() {
  const { accessToken, user } = useAuth();
  const query = useQuery({
    queryKey: ['admin', 'dashboard-overview'],
    queryFn: () => getAdminDashboardOverview(accessToken!),
    enabled: Boolean(accessToken),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const data = query.data;

  return (
    <AdminLayout>
      <section className="grid gap-6">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold uppercase text-blue-700">Tổng quan vận hành</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">
            Xin chào {user?.fullName ?? 'admin'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Theo dõi nhanh nội dung, tài khoản và hoạt động của cổng thông tin.
          </p>
        </header>

        {query.isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="h-28 animate-pulse border border-slate-200 bg-white" />
            ))}
          </div>
        )}
        {query.isError && (
          <div className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            Không thể tải số liệu dashboard. Vui lòng thử lại sau.
          </div>
        )}

        {data && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={UsersRound}
                label={`${data.users.active} active · ${data.users.locked} bị khóa`}
                value={data.users.total}
                accent="bg-blue-50 text-blue-700"
              />
              <StatCard
                icon={Layers3}
                label={`${data.classrooms.active} lớp đang hoạt động`}
                value={data.classrooms.total}
                accent="bg-emerald-50 text-emerald-700"
              />
              <StatCard
                icon={Newspaper}
                label={`${data.posts.published} bài đã đăng`}
                value={data.posts.total}
                accent="bg-violet-50 text-violet-700"
              />
              <StatCard
                icon={FileText}
                label={`${data.documents.published} tài liệu đã đăng`}
                value={data.documents.total}
                accent="bg-amber-50 text-amber-700"
              />
              <StatCard
                icon={BookOpen}
                label={`${data.importer.pending} chờ kiểm tra`}
                value={data.importer.total}
                accent="bg-cyan-50 text-cyan-700"
              />
              <StatCard
                icon={HardDrive}
                label={`${formatBytes(data.media.original_size)} bản gốc`}
                value={formatBytes(data.media.optimized_size)}
                accent="bg-slate-100 text-slate-700"
              />
              <StatCard
                icon={Image}
                label={`${data.media.documents} tài liệu`}
                value={data.media.images}
                accent="bg-pink-50 text-pink-700"
              />
              <StatCard
                icon={CalendarDays}
                label={`${data.events.upcoming} sắp diễn ra`}
                value={data.events.total}
                accent="bg-orange-50 text-orange-700"
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="font-bold text-slate-950">Tài khoản theo vai trò</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Chỉ tính tài khoản active để phản ánh quy mô đang sử dụng.
                  </p>
                </div>
                <div className="grid gap-3 p-5 sm:grid-cols-3">
                  {[
                    ['admin', data.users.by_role.admin],
                    ['teacher', data.users.by_role.teacher],
                    ['student', data.users.by_role.student],
                  ].map(([role, count]) => (
                    <div key={role} className="border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xl font-bold text-slate-950">{count}</p>
                      <p className="mt-1 text-sm capitalize text-slate-500">{role}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="font-bold text-slate-950">Trạng thái nội dung</h2>
                  <p className="mt-1 text-sm text-slate-500">Bài viết và tài liệu cần theo dõi.</p>
                </div>
                <div className="grid gap-3 p-5 sm:grid-cols-2">
                  <StatusSummary label="Bài viết" counts={data.posts} href="/admin/posts" />
                  <StatusSummary label="Tài liệu" counts={data.documents} href="/admin/documents" />
                </div>
              </div>
            </section>

            <section className="border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-bold text-slate-950">Hoạt động gần đây</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Cập nhật gần nhất từ nội dung quản trị.
                  </p>
                </div>
                <span className="text-xs text-slate-400">
                  Cập nhật {formatDate(data.generated_at)}
                </span>
              </div>
              {data.recent_activity.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  Chưa có hoạt động để hiển thị.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.recent_activity.map((item) => (
                    <Link
                      key={`${item.type}-${item.id}`}
                      to={item.href}
                      className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.type} · {statusLabel(item.status)} · {formatDate(item.created_at)}
                        </p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {(data.importer.error > 0 || data.importer.pending > 0) && (
              <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>
                  Importer còn {data.importer.pending} nội dung chờ kiểm tra và{' '}
                  {data.importer.error} nội dung lỗi. Hãy mở trang Import dữ liệu để xử lý.
                </p>
              </div>
            )}
          </>
        )}
      </section>
    </AdminLayout>
  );
}

function StatusSummary({
  counts,
  href,
  label,
}: {
  counts: { draft: number; published: number; archived: number };
  href: string;
  label: string;
}) {
  return (
    <Link to={href} className="border border-slate-200 p-4 hover:border-blue-300">
      <p className="font-semibold text-slate-950">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
          Nháp {counts.draft}
        </span>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
          Đã đăng {counts.published}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
          Lưu trữ {counts.archived}
        </span>
      </div>
    </Link>
  );
}
