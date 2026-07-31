import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  CalendarCheck,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ClipboardList,
  FileSignature,
  GraduationCap,
  History,
  Home,
  School,
  UserRound,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../stores/auth-context';
import { getMyProfile } from '../../services/profile.service';
import { resolvePublicMediaUrl } from '../../lib/media-url';
import { MainLayout } from './MainLayout';

const navigation = [
  { label: 'Tổng quan', to: '/student', end: true, icon: Home },
  { label: 'Lớp học', to: '/student/classes', end: false, icon: School },
  { label: 'Thời khóa biểu', to: '/student/timetable', end: false, icon: CalendarDays },
  { label: 'Lịch sử lớp', to: '/student/enrollments', end: false, icon: History },
  { label: 'Chuyên cần', to: '/student/attendance', end: false, icon: CalendarCheck },
  { label: 'Bài tập', to: '/student/assignments', end: false, icon: ClipboardList },
  { label: 'Bảng điểm', to: '/student/grades', end: false, icon: ChartNoAxesColumnIncreasing },
  { label: 'Đơn & yêu cầu', to: '/student/requests', end: false, icon: FileSignature },
  { label: 'Hồ sơ', to: '/student/profile', end: false, icon: UserRound },
];

export function StudentPortalLayout({ children }: { children: ReactNode }) {
  const { accessToken, user } = useAuth();
  const profileQuery = useQuery({
    queryKey: ['profile', 'me', user?.id],
    queryFn: () => getMyProfile(accessToken!),
    enabled: Boolean(accessToken && user),
  });
  const initial = (user?.fullName || user?.email || 'H').trim().charAt(0).toUpperCase();
  const avatarUrl = resolvePublicMediaUrl(profileQuery.data?.profile?.avatar_url);

  return (
    <MainLayout>
      <div className="min-h-[calc(100vh-5rem)] bg-slate-50">
        <div className="border-b border-blue-900 bg-blue-800 text-white">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
            <GraduationCap className="h-5 w-5" aria-hidden="true" />
            <p className="text-sm font-semibold">Cổng thông tin học sinh</p>
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:py-8">
          <aside className="min-w-0">
            <div className="hidden border border-slate-200 bg-white p-4 shadow-sm lg:block">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-700 text-sm font-bold text-white">
                  {initial}
                  {avatarUrl && <img src={avatarUrl} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(event) => event.currentTarget.remove()} />}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950">{user?.fullName || 'Học sinh'}</p>
                  <p className="truncate text-xs text-slate-500">{user?.email || user?.username}</p>
                </div>
              </div>

              <nav className="mt-3 grid gap-1" aria-label="Điều hướng học sinh">
                {navigation.map(({ end, icon: Icon, label, to }) => (
                  <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />{label}
                  </NavLink>
                ))}
              </nav>
            </div>

            <nav className="flex gap-2 overflow-x-auto border border-slate-200 bg-white p-2 shadow-sm lg:hidden" aria-label="Điều hướng học sinh">
              {navigation.map(({ end, icon: Icon, label, to }) => (
                <NavLink key={to} to={to} end={end} className={({ isActive }) => `inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${isActive ? 'bg-blue-700 text-white' : 'text-slate-600'}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />{label}
                </NavLink>
              ))}
            </nav>
          </aside>

          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </MainLayout>
  );
}
