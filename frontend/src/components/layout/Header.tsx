import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, CheckCheck, ChevronDown, LogOut, Search } from 'lucide-react';

import {
  getNotificationDestination,
  notificationKeys,
} from '../../lib/notification-query';
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notification.service';
import { getMyProfile } from '../../services/profile.service';
import { resolvePublicMediaUrl } from '../../lib/media-url';
import { useAuth } from '../../stores/auth-context';
import type { UserNotification } from '../../types/notification';
import logo from '../../assets/logo.png';

const navItems = [
  { label: 'Trang chủ', to: '/' },
  { label: 'Tin tức', to: '/tin-tuc' },
  { label: 'Tuyển sinh', to: '/danh-muc/tuyen-sinh' },
  { label: 'Sự kiện', to: '/su-kien' },
  { label: 'Tài liệu', to: '/tai-lieu' },
];

function getPortalLink(roles: string[]) {
  if (roles.includes('admin')) return '/admin';
  if (roles.includes('teacher')) return '/teacher';
  if (roles.includes('student')) return '/student';
  if (roles.includes('guardian')) return '/parent';
  return '/dang-nhap';
}

function getProfileLink(roles: string[]) {
  if (roles.includes('admin')) return '/admin/users';
  if (roles.includes('teacher')) return '/teacher/profile';
  if (roles.includes('student')) return '/student/profile';
  if (roles.includes('guardian')) return '/parent';
  return '/dang-nhap';
}

function getPrimaryRole(roles: string[]) {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('teacher')) return 'teacher';
  if (roles.includes('student')) return 'student';
  if (roles.includes('guardian')) return 'guardian';
  return 'user';
}

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const { accessToken, isAuthenticated, roles, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const portalLink = useMemo(() => getPortalLink(roles), [roles]);
  const profileLink = useMemo(() => getProfileLink(roles), [roles]);
  const primaryRole = useMemo(() => getPrimaryRole(roles), [roles]);
  const initial = (user?.fullName || user?.email || user?.username || 'U').trim().charAt(0).toUpperCase();

  const latestNotificationsQuery = useQuery({
    queryKey: notificationKeys.latest(user?.id),
    queryFn: () => getMyNotifications(accessToken!, { page: 1, limit: 5 }),
    enabled: Boolean(accessToken && isAuthenticated && user),
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: false,
  });

  const unreadCountQuery = useQuery({
    queryKey: notificationKeys.unreadCount(user?.id),
    queryFn: () => getUnreadNotificationCount(accessToken!),
    enabled: Boolean(accessToken && isAuthenticated && user),
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: false,
  });

  const profileQuery = useQuery({
    queryKey: ['profile', 'me', user?.id],
    queryFn: () => getMyProfile(accessToken!),
    enabled: Boolean(
      accessToken &&
        isAuthenticated &&
        user &&
        (roles.includes('teacher') || roles.includes('student')),
    ),
  });

  const refreshNotifications = async () => {
    await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  };

  const markReadMutation = useMutation({
    mutationFn: (id: number) => markNotificationRead(accessToken!, id),
    onSuccess: refreshNotifications,
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(accessToken!),
    onSuccess: refreshNotifications,
  });

  const notifications = latestNotificationsQuery.data?.data ?? [];
  const unreadCount = unreadCountQuery.data?.count ?? 0;
  const avatarUrl = resolvePublicMediaUrl(profileQuery.data?.profile?.avatar_url);

  useEffect(() => {
    setIsAccountOpen(false);
    setIsNotificationOpen(false);
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  function closeMobileMenu() {
    setIsMobileMenuOpen(false);
  }

  function handleLogout() {
    logout();
    setIsAccountOpen(false);
    setIsNotificationOpen(false);
    setIsMobileMenuOpen(false);
  }

  async function handleNotificationClick(notification: UserNotification) {
    if (accessToken && !notification.read_at) {
      try {
        await markReadMutation.mutateAsync(notification.id);
      } catch {
        return;
      }
    }
    const destination = getNotificationDestination(notification.related_url);
    if (destination) {
      setIsNotificationOpen(false);
      if (destination.kind === 'internal') navigate(destination.url);
      else window.location.assign(destination.url);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:gap-6">
        <Link to="/" className="flex min-w-0 items-center gap-3 sm:gap-4">
          <img src={logo} alt="THPT Phan Chu Trinh" className="h-12 w-12 shrink-0 object-contain md:h-14 md:w-14" />
          <div className="min-w-0 leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 md:text-xs">
              Sở Giáo dục và Đào tạo Bình Thuận
            </p>
            <h1 className="truncate text-xs font-bold uppercase tracking-wide text-blue-800 md:text-lg">
              THPT Phan Chu Trinh - Phan Thiết
            </h1>
          </div>
        </Link>

        <div className="hidden items-center gap-4 xl:flex">
          <nav className="flex items-center gap-5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `relative py-2 text-sm font-semibold transition-colors duration-200 ${
                    isActive ? 'text-blue-700' : 'text-slate-700 hover:text-blue-700'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span>{item.label}</span>
                    {isActive && (
                      <motion.span
                        layoutId="main-nav-underline"
                        className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-blue-700"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <NavLink to="/#lien-he" className="py-2 text-sm font-semibold text-slate-700 transition hover:text-blue-700">
            Liên hệ
          </NavLink>
          <NavLink
            to="/tim-kiem"
            className={({ isActive }) =>
              `inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
                isActive ? 'border-blue-700 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700'
              }`
            }
            title="Tìm kiếm"
          >
            <Search className="h-4 w-4" />
          </NavLink>

          {!isAuthenticated ? (
            <Link
              to="/dang-nhap"
              className="inline-flex items-center rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"
            >
              Đăng nhập
            </Link>
          ) : (
            <div className="relative flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsNotificationOpen((value) => !value);
                  setIsAccountOpen(false);
                }}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                aria-label="Thông báo"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAccountOpen((value) => !value);
                  setIsNotificationOpen(false);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-800 transition hover:border-blue-300 hover:text-blue-700"
              >
                <span className="relative inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-blue-700 text-xs font-bold text-white">
                  {initial}
                  {avatarUrl && (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(event) => event.currentTarget.remove()}
                    />
                  )}
                </span>
                <span className="max-w-32 truncate">{user?.fullName || user?.email || user?.username}</span>
                <ChevronDown className="h-4 w-4" />
              </button>

              {isNotificationOpen && (
                <div className="absolute right-44 top-12 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex w-full items-center justify-between px-4 pt-3">
                      <p className="font-bold text-slate-950">Thông báo</p>
                      <span className="text-xs text-slate-500">{unreadCount} chưa đọc</span>
                    </div>
                  </div>
                  <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                    {latestNotificationsQuery.isLoading && (
                      <p className="px-4 py-5 text-sm text-slate-500">Đang tải thông báo...</p>
                    )}
                    {!latestNotificationsQuery.isLoading && notifications.length === 0 && (
                      <p className="px-4 py-5 text-sm text-slate-500">Chưa có thông báo.</p>
                    )}
                    {notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => void handleNotificationClick(notification)}
                        className={`block w-full px-4 py-3 text-left transition hover:bg-blue-50 ${
                          notification.read_at ? 'bg-white' : 'bg-blue-50/60'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {!notification.read_at && (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                          )}
                          <p className="text-sm font-semibold text-slate-950">{notification.title}</p>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-600">{notification.message}</p>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 border-t border-slate-200 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => markAllMutation.mutate()}
                      disabled={unreadCount === 0 || markAllMutation.isPending}
                      className="inline-flex items-center justify-center gap-1.5 border-r border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:text-blue-700 disabled:opacity-50"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Đọc tất cả
                    </button>
                    <Link
                      to="/notifications"
                      onClick={() => setIsNotificationOpen(false)}
                      className="px-3 py-2.5 text-center text-xs font-bold text-blue-700 hover:bg-blue-50"
                    >
                      Xem tất cả
                    </Link>
                  </div>
                </div>
              )}

              {isAccountOpen && (
                <div className="absolute right-0 top-12 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                  <div className="rounded-xl bg-blue-50 p-3">
                    <p className="font-bold text-slate-950">{user?.fullName || 'Tài khoản'}</p>
                    <p className="truncate text-sm text-slate-600">{user?.email ?? user?.username}</p>
                    <p className="mt-1 text-xs font-semibold uppercase text-blue-700">{primaryRole}</p>
                  </div>
                  <div className="mt-2 grid gap-1">
                    <Link onClick={() => setIsAccountOpen(false)} to={portalLink} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      Vào portal
                    </Link>
                    <Link onClick={() => setIsAccountOpen(false)} to={profileLink} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      Hồ sơ
                    </Link>
                    <Link onClick={() => setIsAccountOpen(false)} to="/notifications" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      Thông báo
                    </Link>
                    <button onClick={handleLogout} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50">
                      <LogOut className="h-4 w-4" /> Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((value) => !value)}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm transition hover:border-blue-300 hover:text-blue-700 xl:hidden"
          aria-label="Mở menu"
          aria-expanded={isMobileMenuOpen}
        >
          <span className="relative h-5 w-5">
            <span className={`absolute left-0 top-1 h-0.5 w-5 rounded-full bg-current transition ${isMobileMenuOpen ? 'translate-y-1.5 rotate-45' : ''}`} />
            <span className={`absolute left-0 top-2.5 h-0.5 w-5 rounded-full bg-current transition ${isMobileMenuOpen ? 'opacity-0' : ''}`} />
            <span className={`absolute left-0 top-4 h-0.5 w-5 rounded-full bg-current transition ${isMobileMenuOpen ? '-translate-y-1.5 -rotate-45' : ''}`} />
          </span>
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="border-t border-slate-100 bg-white xl:hidden">
          <motion.nav initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="mx-auto grid max-w-7xl gap-2 px-4 py-4">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={closeMobileMenu} className={({ isActive }) => `rounded-xl px-4 py-3 text-sm font-semibold transition ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50 hover:text-blue-700'}`}>
                {item.label}
              </NavLink>
            ))}
            <NavLink to="/tim-kiem" onClick={closeMobileMenu} className={({ isActive }) => `rounded-xl px-4 py-3 text-sm font-semibold transition ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50 hover:text-blue-700'}`}>
              Tìm kiếm
            </NavLink>
            <NavLink to="/#lien-he" onClick={closeMobileMenu} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-blue-700">
              Liên hệ
            </NavLink>

            {!isAuthenticated ? (
              <Link to="/dang-nhap" onClick={closeMobileMenu} className="mt-2 rounded-xl bg-blue-700 px-4 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-blue-800">
                Đăng nhập
              </Link>
            ) : (
              <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-3">
                  <span className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-blue-700 text-sm font-bold text-white">
                    {initial}
                    {avatarUrl && (
                      <img
                        src={avatarUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={(event) => event.currentTarget.remove()}
                      />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-950">{user?.fullName || user?.email || user?.username}</p>
                    <p className="text-xs uppercase text-blue-700">{primaryRole}</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-2">
                  <Link to={portalLink} onClick={closeMobileMenu} className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700">Vào portal</Link>
                  <Link to={profileLink} onClick={closeMobileMenu} className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700">Hồ sơ</Link>
                  <Link to="/notifications" onClick={closeMobileMenu} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                    <span>Thông báo</span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                  <button onClick={handleLogout} className="rounded-xl bg-red-50 px-3 py-2 text-left text-sm font-semibold text-red-700">Đăng xuất</button>
                </div>
              </div>
            )}
          </motion.nav>
        </div>
      )}
    </header>
  );
}
