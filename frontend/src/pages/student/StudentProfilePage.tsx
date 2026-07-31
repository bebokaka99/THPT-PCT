import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IdCard, Phone, Save, UserRound, UsersRound } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { StudentPortalLayout } from '../../components/layout/StudentPortalLayout';
import { ProfileAvatarEditor } from '../../components/profile/ProfileAvatarEditor';
import { resolvePublicMediaUrl } from '../../lib/media-url';
import { getMyProfile, updateMyProfile } from '../../services/profile.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type { MyProfile, StudentProfile } from '../../types/profile';

function isStudentProfile(value: MyProfile['profile']): value is StudentProfile {
  return Boolean(value && 'student_code' in value);
}

export function StudentProfilePage() {
  const { accessToken, user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ phone: '', parent_phone: '', avatar_url: '' });
  const profileQuery = useQuery({
    queryKey: ['profile', 'me', user?.id],
    queryFn: () => getMyProfile(accessToken!),
    enabled: Boolean(accessToken),
  });
  const profileData = profileQuery.data;
  const currentProfile = profileData?.profile ?? null;
  const studentProfile = isStudentProfile(currentProfile) ? currentProfile : null;

  useEffect(() => {
    if (!studentProfile) return;
    setForm({
      phone: studentProfile.phone ?? '',
      parent_phone: studentProfile.parent_phone ?? '',
      avatar_url: studentProfile.avatar_url ?? '',
    });
  }, [studentProfile?.id]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateMyProfile(accessToken!, {
        phone: form.phone.trim() || null,
        parent_phone: form.parent_phone.trim() || null,
        avatar_url: form.avatar_url.trim() || null,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['profile', 'me', user?.id], data);
      toast.success('Đã cập nhật hồ sơ học sinh.');
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studentProfile || updateMutation.isPending) return;
    updateMutation.mutate();
  }

  const avatarUrl = form.avatar_url.trim()
    ? resolvePublicMediaUrl(form.avatar_url.trim())
    : null;

  return (
    <StudentPortalLayout>
      <header className="border-b border-slate-200 pb-6">
        <p className="text-sm font-semibold text-blue-700">Tài khoản cá nhân</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
          Hồ sơ học sinh
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Kiểm tra thông tin định danh và cập nhật dữ liệu liên hệ của em.
        </p>
      </header>

      {profileQuery.isLoading && (
        <p className="mt-6 border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Đang tải hồ sơ...
        </p>
      )}

      {profileQuery.isError && (
        <p className="mt-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Không thể tải hồ sơ học sinh.
        </p>
      )}

      {profileQuery.data && !studentProfile && (
        <div className="mt-6 border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Hồ sơ của bạn chưa được thiết lập. Vui lòng liên hệ quản trị viên.
        </div>
      )}

      {profileData && studentProfile && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-blue-700">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={studentProfile.full_name}
                  className="h-full w-full object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <UserRound className="h-10 w-10" />
              )}
            </div>
            <h2 className="mt-4 text-center text-lg font-bold text-slate-950">
              {studentProfile.full_name}
            </h2>
            <p className="mt-1 text-center text-sm text-slate-500">
              {profileData.user.email}
            </p>
            <dl className="mt-5 grid gap-3 border-t border-slate-100 pt-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Mã học sinh</dt>
                <dd className="font-semibold text-slate-900">
                  {studentProfile.student_code || 'Chưa có'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Lớp</dt>
                <dd className="font-semibold text-slate-900">
                  {studentProfile.class_name || 'Chưa gán'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Ngày sinh</dt>
                <dd className="font-semibold text-slate-900">
                  {studentProfile.date_of_birth
                    ? new Intl.DateTimeFormat('vi-VN').format(
                        new Date(studentProfile.date_of_birth),
                      )
                    : 'Chưa có'}
                </dd>
              </div>
            </dl>
          </aside>

          <form
            onSubmit={handleSubmit}
            className="border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <div>
              <h2 className="font-bold text-slate-950">Thông tin liên hệ</h2>
              <p className="mt-1 text-sm text-slate-500">
                Tên, mã học sinh và lớp do quản trị viên nhà trường quản lý.
              </p>
            </div>

            <div className="mt-6 grid gap-5">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                <span className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-400" />
                  Số điện thoại
                </span>
                <input
                  type="tel"
                  maxLength={50}
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, phone: event.target.value }))
                  }
                  placeholder="Nhập số điện thoại"
                  className="rounded-md border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600"
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                <span className="inline-flex items-center gap-2">
                  <UsersRound className="h-4 w-4 text-slate-400" />
                  Số điện thoại phụ huynh
                </span>
                <input
                  type="tel"
                  maxLength={50}
                  value={form.parent_phone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      parent_phone: event.target.value,
                    }))
                  }
                  placeholder="Nhập số điện thoại phụ huynh"
                  className="rounded-md border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600"
                />
              </label>

              <ProfileAvatarEditor
                token={accessToken!}
                value={form.avatar_url}
                onChange={(avatarUrlValue) =>
                  setForm((current) => ({
                    ...current,
                    avatar_url: avatarUrlValue,
                  }))
                }
                onProfileUpdated={(updatedProfile) =>
                  queryClient.setQueryData(
                    ['profile', 'me', user?.id],
                    updatedProfile,
                  )
                }
              />
            </div>

            {updateMutation.isError && (
              <p className="mt-4 text-sm text-red-700">
                Không thể cập nhật hồ sơ. Vui lòng kiểm tra dữ liệu và thử lại.
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
              <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                <IdCard className="h-4 w-4" />
                Dữ liệu định danh không thể tự chỉnh sửa.
              </span>
            </div>
          </form>
        </div>
      )}
    </StudentPortalLayout>
  );
}
