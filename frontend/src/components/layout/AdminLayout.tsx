import { useState, type ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../stores/auth-context';

type AdminLayoutProps = {
  children: ReactNode;
};

const sidebarItems = [
  { label: 'Tài khoản học sinh', to: '/admin/users/bulk-students' },
  { label: 'Tổng quan', to: '/admin', end: true },
  { label: 'Sức khỏe hệ thống', to: '/admin/system-health' },
  { label: 'Năm học & học kỳ', to: '/admin/academic-periods' },
  { label: 'Import / Báo cáo học vụ', to: '/admin/academic-operations' },
  { label: 'Môn học & chương trình', to: '/admin/subjects' },
  { label: 'Xếp lớp học sinh', to: '/admin/enrollments' },
  { label: 'Phân công giảng dạy', to: '/admin/teaching-assignments' },
  { label: 'Duyệt kế hoạch dạy học', to: '/admin/teaching-plans' },
  { label: 'Sổ đầu bài', to: '/admin/class-journal' },
  { label: 'Lịch kiểm tra & học vụ', to: '/admin/academic-calendar' },
  { label: 'Duyệt thay đổi lịch', to: '/admin/schedule-overrides' },
  { label: 'Ca học & giờ tiết', to: '/admin/timetable-settings' },
  { label: 'Cấu hình đầu điểm', to: '/admin/assessment-configurations' },
  { label: 'Chuyên cần', to: '/admin/attendance' },
  { label: 'Bài tập & bài nộp', to: '/admin/assignments' },
  { label: 'Sổ điểm', to: '/admin/gradebooks' },
  { label: 'Phiếu điểm', to: '/admin/report-cards' },
  { label: 'Hạnh kiểm', to: '/admin/conduct' },
  { label: 'Phụ huynh', to: '/admin/guardians' },
  { label: 'Đơn học sinh', to: '/admin/student-requests' },
  { label: 'Bài viết', to: '/admin/posts' },
  { label: 'Danh mục', to: '/admin/categories' },
  { label: 'Tài liệu', to: '/admin/documents' },
  { label: 'Sự kiện', to: '/admin/events' },
  { label: 'Media / Tệp tin', to: '/admin/media' },
  { label: 'Import dữ liệu', to: '/admin/importer' },
  { label: 'Gửi thông báo', to: '/admin/communications' },
  { label: 'Tài khoản', to: '/admin/users' },
  { label: 'Lớp học', to: '/admin/classrooms' },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/dang-nhap', { replace: true });
  }

  function Navigation() {
    return (
      <nav className="grid gap-2 text-sm">
        {sidebarItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setIsMobileNavOpen(false)}
            className={({ isActive }) =>
              `rounded px-3 py-2.5 transition ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="grid min-h-screen lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-screen overflow-y-auto border-r border-slate-800 bg-slate-950 px-4 py-5 text-white lg:block">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-blue-600 text-sm font-bold">
              PCT
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Admin Portal</p>
              <p className="truncate text-xs text-slate-300">
                THPT Phan Chu Trinh
              </p>
            </div>
          </div>
          <div className="mt-8">
            <Navigation />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950 px-3 py-3 text-white lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-blue-600 text-xs font-bold">
                  PCT
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Admin Portal</p>
                  <p className="truncate text-xs text-slate-300">
                    {user?.fullName ?? user?.email ?? 'Quản trị viên'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileNavOpen((current) => !current)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-slate-700 text-slate-100"
                aria-label={isMobileNavOpen ? 'Đóng menu quản trị' : 'Mở menu quản trị'}
                aria-expanded={isMobileNavOpen}
              >
                {isMobileNavOpen ? (
                  <X className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Menu className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>

            {isMobileNavOpen && (
              <div className="max-h-[calc(100vh-4.5rem)] overflow-y-auto pb-2 pt-4">
                <Navigation />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-3 w-full rounded border border-red-400/40 px-3 py-2.5 text-left text-sm font-semibold text-red-200"
                >
                  Đăng xuất
                </button>
              </div>
            )}
          </header>

          <header className="hidden border-b border-slate-200 bg-white px-4 py-4 lg:block">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-slate-500">Đang đăng nhập</p>
                <h1 className="truncate text-lg font-bold text-slate-950">
                  {user?.fullName ?? 'Admin'}
                </h1>
              </div>
              <div className="flex min-w-0 items-center gap-3">
                <span className="max-w-64 truncate text-sm text-slate-600">
                  {user?.email ?? user?.username ?? 'Tài khoản quản trị'}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="shrink-0 rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-red-500 hover:text-red-600"
                >
                  Đăng xuất
                </button>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 p-3 sm:p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
