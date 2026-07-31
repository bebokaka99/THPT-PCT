import type { ReactNode } from 'react';
import { Bell, CalendarDays, Home, ShieldCheck } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../stores/auth-context';
import { MainLayout } from './MainLayout';

const navigation = [
  { label: 'Tổng quan', to: '/parent', end: true, icon: Home },
  { label: 'Thông báo', to: '/notifications', end: false, icon: Bell },
  { label: 'Lịch học vụ', to: '/parent/academic-calendar', end: false, icon: CalendarDays },
];

export function ParentPortalLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const initial = (user?.fullName || user?.email || 'P')
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <MainLayout>
      <div className="min-h-[calc(100vh-5rem)] bg-slate-50">
        <div className="border-b border-blue-900 bg-blue-800 text-white">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
            <ShieldCheck className="h-5 w-5" />
            <p className="text-sm font-semibold">Cổng thông tin phụ huynh</p>
          </div>
        </div>
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:py-8">
          <aside>
            <div className="border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-700 text-sm font-bold text-white">
                  {initial}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950">
                    {user?.fullName || 'Phụ huynh'}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {user?.email || user?.username}
                  </p>
                </div>
              </div>
              <nav className="mt-3 flex gap-2 overflow-x-auto lg:grid lg:gap-1">
                {navigation.map(({ end, icon: Icon, label, to }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `inline-flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold ${
                        isActive
                          ? 'bg-blue-50 text-blue-800'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </aside>
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </MainLayout>
  );
}
