import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BellRing,
  BookOpen,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  School,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../components/layout/MainLayout';
import { Seo } from '../../components/public/Seo';
import {
  getNotificationDestination,
  notificationKeys,
} from '../../lib/notification-query';
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  acknowledgeNotification,
} from '../../services/notification.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type {
  NotificationType,
  UserNotification,
} from '../../types/notification';

const pageSize = 10;

const typeDetails: Record<
  NotificationType,
  { label: string; icon: typeof Bell; className: string }
> = {
  system: {
    label: 'Hệ thống',
    icon: Info,
    className: 'bg-slate-100 text-slate-700',
  },
  school: {
    label: 'Nhà trường',
    icon: School,
    className: 'bg-blue-100 text-blue-700',
  },
  classroom: {
    label: 'Lớp học',
    icon: BellRing,
    className: 'bg-cyan-100 text-cyan-800',
  },
  post: {
    label: 'Thông báo lớp',
    icon: BookOpen,
    className: 'bg-amber-100 text-amber-800',
  },
  document: {
    label: 'Tài liệu lớp',
    icon: FileText,
    className: 'bg-emerald-100 text-emerald-800',
  },
  event: {
    label: 'Sự kiện',
    icon: Bell,
    className: 'bg-violet-100 text-violet-700',
  },
  timetable: {
    label: 'Lịch học',
    icon: BellRing,
    className: 'bg-orange-100 text-orange-700',
  },
};

function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getPortalLink(roles: string[]) {
  if (roles.includes('admin')) return '/admin';
  if (roles.includes('teacher')) return '/teacher';
  return '/student';
}

function NotificationRow({
  isPending,
  notification,
  onOpen,
  onAcknowledge,
}: {
  isPending: boolean;
  notification: UserNotification;
  onOpen: (notification: UserNotification) => void;
  onAcknowledge: (notification: UserNotification) => void;
}) {
  const details = typeDetails[notification.type];
  const Icon = details.icon;

  return (
    <article
      className={`grid gap-4 px-4 py-5 transition sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-6 ${
        notification.priority === 'urgent'
          ? 'border-l-4 border-red-500 bg-red-50/70'
          : notification.read_at
            ? 'bg-white'
            : 'bg-blue-50/70'
      }`}
    >
      <span
        className={`inline-flex h-10 w-10 items-center justify-center rounded-md ${details.className}`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-bold text-slate-950">{notification.title}</h2>
          {!notification.read_at && (
            <span className="rounded-full bg-blue-700 px-2 py-0.5 text-[11px] font-bold text-white">
              Mới
            </span>
          )}
          {notification.requires_acknowledgement && !notification.acknowledged_at && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">Cần xác nhận</span>
          )}
          {notification.priority === 'urgent' && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">Khẩn</span>
          )}
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {notification.message}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="font-semibold text-slate-600">{details.label}</span>
          <span>{formatDate(notification.created_at)}</span>
        </div>
      </div>

      <div className="flex items-center sm:justify-end">
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => onOpen(notification)} disabled={isPending} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {notification.read_at ? <ChevronRight className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {notification.related_url ? 'Mở' : notification.read_at ? 'Đã đọc' : 'Đánh dấu đã đọc'}
          </button>
          {notification.requires_acknowledgement && !notification.acknowledged_at && <button type="button" onClick={() => onAcknowledge(notification)} disabled={isPending} className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-3 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-60">Xác nhận</button>}
        </div>
      </div>
    </article>
  );
}

export function NotificationCenterPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { accessToken, roles, user } = useAuth();
  const page = parsePage(searchParams.get('page'));
  const unreadOnly = searchParams.get('filter') === 'unread';

  const notificationsQuery = useQuery({
    queryKey: notificationKeys.list(user?.id, page, unreadOnly),
    queryFn: () =>
      getMyNotifications(accessToken!, {
        page,
        limit: pageSize,
        unread: unreadOnly || undefined,
      }),
    enabled: Boolean(accessToken && user),
    staleTime: 15_000,
  });

  const unreadCountQuery = useQuery({
    queryKey: notificationKeys.unreadCount(user?.id),
    queryFn: () => getUnreadNotificationCount(accessToken!),
    enabled: Boolean(accessToken && user),
    staleTime: 15_000,
  });

  const refreshNotifications = async () => {
    await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  };

  const markReadMutation = useMutation({
    mutationFn: (id: number) => markNotificationRead(accessToken!, id),
    onSuccess: refreshNotifications,
    onError: () => toast.error('Không thể cập nhật trạng thái thông báo.'),
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(accessToken!),
    onSuccess: async () => {
      await refreshNotifications();
      toast.success('Đã đánh dấu tất cả thông báo là đã đọc.');
    },
    onError: () => toast.error('Không thể đánh dấu tất cả thông báo.'),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: number) => acknowledgeNotification(accessToken!, id),
    onSuccess: refreshNotifications,
    onError: () => toast.error('Không thể xác nhận thông báo.'),
  });

  const notifications = notificationsQuery.data?.data ?? [];
  const meta = notificationsQuery.data?.meta;
  const unreadCount = unreadCountQuery.data?.count ?? 0;
  const totalPages = Math.max(meta?.totalPages ?? 1, 1);
  const portalLink = useMemo(() => getPortalLink(roles), [roles]);

  function updateFilter(nextUnreadOnly: boolean) {
    setSearchParams({
      filter: nextUnreadOnly ? 'unread' : 'all',
      page: '1',
    });
  }

  function updatePage(nextPage: number) {
    setSearchParams({
      filter: unreadOnly ? 'unread' : 'all',
      page: String(nextPage),
    });
  }

  async function openNotification(notification: UserNotification) {
    if (!notification.read_at) {
      try {
        await markReadMutation.mutateAsync(notification.id);
      } catch {
        return;
      }
    }

    const destination = getNotificationDestination(notification.related_url);
    if (!destination) return;
    if (destination.kind === 'internal') navigate(destination.url);
    else window.location.assign(destination.url);
  }

  return (
    <MainLayout>
      <Seo
        title="Trung tâm thông báo"
        description="Theo dõi thông báo từ nhà trường và lớp học."
        canonicalPath="/notifications"
        noIndex
      />

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-9">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-700">Tài khoản của bạn</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-950">
                Trung tâm thông báo
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Theo dõi thông tin mới từ nhà trường, lớp học và tài liệu được chia sẻ.
              </p>
            </div>
            <Link
              to={portalLink}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
            >
              Quay lại portal
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex w-fit rounded-md border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => updateFilter(false)}
              className={`rounded px-4 py-2 text-sm font-semibold transition ${
                !unreadOnly
                  ? 'bg-blue-700 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => updateFilter(true)}
              className={`rounded px-4 py-2 text-sm font-semibold transition ${
                unreadOnly
                  ? 'bg-blue-700 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Chưa đọc ({unreadCount})
            </button>
          </div>

          <button
            type="button"
            onClick={() => markAllMutation.mutate()}
            disabled={unreadCount === 0 || markAllMutation.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" />
            Đánh dấu tất cả đã đọc
          </button>
        </div>

        <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          {notificationsQuery.isLoading && (
            <div className="p-8 text-center text-sm text-slate-500">
              Đang tải thông báo...
            </div>
          )}

          {notificationsQuery.isError && (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-red-700">
                Không thể tải danh sách thông báo.
              </p>
              <button
                type="button"
                onClick={() => void notificationsQuery.refetch()}
                className="mt-3 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Thử lại
              </button>
            </div>
          )}

          {!notificationsQuery.isLoading &&
            !notificationsQuery.isError &&
            notifications.length === 0 && (
              <div className="px-6 py-14 text-center">
                <Bell className="mx-auto h-9 w-9 text-slate-400" />
                <h2 className="mt-3 font-bold text-slate-900">
                  {unreadOnly ? 'Không còn thông báo chưa đọc' : 'Chưa có thông báo'}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {unreadOnly
                    ? 'Các thông báo mới sẽ xuất hiện tại đây.'
                    : 'Thông báo từ nhà trường và lớp học sẽ được cập nhật tại đây.'}
                </p>
              </div>
            )}

          {notifications.length > 0 && (
            <div className="divide-y divide-slate-100">
              {notifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  isPending={
                    (markReadMutation.isPending && markReadMutation.variables === notification.id) ||
                    (acknowledgeMutation.isPending && acknowledgeMutation.variables === notification.id)
                  }
                  onOpen={(item) => void openNotification(item)}
                  onAcknowledge={(item) => acknowledgeMutation.mutate(item.id)}
                />
              ))}
            </div>
          )}
        </div>

        {meta && meta.total > 0 && (
          <div className="mt-5 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-slate-500">
              Hiển thị {(page - 1) * pageSize + 1}-
              {Math.min(page * pageSize, meta.total)} trong {meta.total} thông báo
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updatePage(page - 1)}
                disabled={page <= 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:border-blue-300 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Trang trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-24 text-center font-semibold text-slate-700">
                Trang {page}/{totalPages}
              </span>
              <button
                type="button"
                onClick={() => updatePage(page + 1)}
                disabled={page >= totalPages}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:border-blue-300 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Trang sau"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>
    </MainLayout>
  );
}
