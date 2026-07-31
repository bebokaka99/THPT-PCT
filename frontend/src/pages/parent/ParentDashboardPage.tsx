import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, ChevronRight, GraduationCap, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ParentPortalLayout } from '../../components/layout/ParentPortalLayout';
import {
  getGuardianPreferences,
  getMyGuardianChildren,
  updateGuardianPreferences,
} from '../../services/guardian.service';
import { useAuth } from '../../stores/auth-context';
import type { GuardianPreferences } from '../../types/guardian';

const preferenceLabels: Array<{
  key: keyof Omit<GuardianPreferences, 'updated_at'>;
  label: string;
}> = [
  { key: 'in_app_enabled', label: 'Thông báo trong portal' },
  { key: 'attendance_enabled', label: 'Cập nhật chuyên cần' },
  { key: 'grades_enabled', label: 'Kết quả học tập' },
  { key: 'conduct_enabled', label: 'Kết quả rèn luyện' },
];

export function ParentDashboardPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const children = useQuery({
    queryKey: ['guardian', 'children', user?.id],
    queryFn: () => getMyGuardianChildren(accessToken!),
    enabled: Boolean(accessToken),
  });
  const preferences = useQuery({
    queryKey: ['guardian', 'preferences', user?.id],
    queryFn: () => getGuardianPreferences(accessToken!),
    enabled: Boolean(accessToken),
  });
  const updatePreference = useMutation({
    mutationFn: (input: Partial<Omit<GuardianPreferences, 'updated_at'>>) =>
      updateGuardianPreferences(accessToken!, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['guardian', 'preferences', user?.id],
      });
    },
  });

  return (
    <ParentPortalLayout>
      <div className="grid gap-6">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold text-blue-700">Phụ huynh</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
            Xin chào, {user?.fullName}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Theo dõi thông tin đã được nhà trường công bố cho con em được xác minh.
          </p>
        </header>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <UsersRound className="h-5 w-5 text-blue-700" />
            <h2 className="text-lg font-bold text-slate-950">Học sinh liên kết</h2>
          </div>
          {children.isLoading ? (
            <p className="border border-slate-200 bg-white p-6 text-sm text-slate-500">
              Đang tải danh sách học sinh...
            </p>
          ) : children.isError ? (
            <p className="border border-red-200 bg-red-50 p-6 text-sm text-red-700">
              Không thể tải dữ liệu liên kết.
            </p>
          ) : children.data?.data.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {children.data.data.map((child) => (
                <Link
                  key={child.link_id}
                  to={`/parent/students/${child.student_user_id}`}
                  className="group border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                      <GraduationCap className="h-5 w-5" />
                    </span>
                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-blue-700" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-950">
                    {child.full_name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {child.student_code || 'Chưa có mã học sinh'} ·{' '}
                    {child.classroom_name || 'Chưa xếp lớp'}
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase text-blue-700">
                    Quan hệ: {child.relationship}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="border border-slate-200 bg-white p-8 text-center">
              <UsersRound className="mx-auto h-10 w-10 text-blue-200" />
              <h3 className="mt-3 font-bold text-slate-950">
                Chưa có học sinh được xác minh
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Vui lòng liên hệ quản trị viên nhà trường để xác minh liên kết.
              </p>
            </div>
          )}
        </section>

        <section className="border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-700" />
            <h2 className="font-bold text-slate-950">Tùy chọn thông báo</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {preferenceLabels.map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center justify-between gap-3 border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
              >
                {label}
                <input
                  type="checkbox"
                  checked={preferences.data?.data[key] ?? true}
                  disabled={
                    preferences.isLoading || updatePreference.isPending
                  }
                  onChange={(event) =>
                    updatePreference.mutate({ [key]: event.target.checked })
                  }
                  className="h-4 w-4 accent-blue-700"
                />
              </label>
            ))}
          </div>
        </section>
      </div>
    </ParentPortalLayout>
  );
}
