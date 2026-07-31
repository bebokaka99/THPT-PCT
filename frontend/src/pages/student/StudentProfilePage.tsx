import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AtSign, Home, IdCard, Phone, Save, UserRound, UsersRound } from 'lucide-react';
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
  const [form, setForm] = useState({
    phone: '',
    parent_name: '',
    parent_phone: '',
    permanent_address: '',
    avatar_url: '',
  });
  const profileQuery = useQuery({
    queryKey: ['profile', 'me', user?.id],
    queryFn: () => getMyProfile(accessToken!),
    enabled: Boolean(accessToken),
  });
  const profileData = profileQuery.data;
  const currentProfile = profileData?.profile ?? null;
  const studentProfile = isStudentProfile(currentProfile)
    ? currentProfile
    : null;

  useEffect(() => {
    if (!studentProfile) return;
    setForm({
      phone: studentProfile.phone ?? '',
      parent_name: studentProfile.parent_name ?? '',
      parent_phone: studentProfile.parent_phone ?? '',
      permanent_address: studentProfile.permanent_address ?? '',
      avatar_url: studentProfile.avatar_url ?? '',
    });
  }, [studentProfile]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateMyProfile(accessToken!, {
        phone: form.phone.trim() || null,
        parent_name: form.parent_name.trim() || null,
        parent_phone: form.parent_phone.trim() || null,
        permanent_address: form.permanent_address.trim() || null,
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

  const avatarUrl = resolvePublicMediaUrl(form.avatar_url.trim());

  return (
    <StudentPortalLayout>
      <header className="border-b border-slate-200 pb-6">
        <p className="text-sm font-semibold text-blue-700">Thông tin cá nhân</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Hồ sơ học sinh</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Kiểm tra thông tin định danh và cập nhật dữ liệu liên hệ của học sinh, phụ huynh.
        </p>
      </header>

      {profileQuery.isLoading && <div className="mt-6 h-64 animate-pulse border border-slate-200 bg-white" />}
      {profileQuery.isError && <p className="mt-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700">Không thể tải hồ sơ học sinh.</p>}
      {profileData && !studentProfile && (
        <div className="mt-6 border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Hồ sơ chưa được thiết lập. Vui lòng liên hệ quản trị viên.
        </div>
      )}

      {profileData && studentProfile && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-blue-700">
              {avatarUrl ? (
                <img src={avatarUrl} alt={studentProfile.full_name} className="h-full w-full object-cover" onError={(event) => event.currentTarget.remove()} />
              ) : (
                <UserRound className="h-12 w-12" />
              )}
            </div>
            <h2 className="mt-4 text-center text-lg font-bold text-slate-950">{studentProfile.full_name}</h2>
            <p className="mt-1 text-center text-sm text-slate-500">{studentProfile.student_code || 'Chưa có mã học sinh'}</p>
            <dl className="mt-5 divide-y divide-slate-100 border-y border-slate-100 text-sm">
              <div className="flex justify-between gap-3 py-3"><dt className="text-slate-500">Lớp</dt><dd className="font-semibold">{studentProfile.class_name || 'Chưa xếp lớp'}</dd></div>
              <div className="flex justify-between gap-3 py-3">
                <dt className="text-slate-500">Ngày sinh</dt>
                <dd className="font-semibold">
                  {studentProfile.date_of_birth
                    ? new Intl.DateTimeFormat('vi-VN').format(new Date(studentProfile.date_of_birth))
                    : 'Chưa cập nhật'}
                </dd>
              </div>
            </dl>
            <div className="mt-5">
              <ProfileAvatarEditor
                token={accessToken!}
                value={form.avatar_url}
                accent="blue"
                onChange={(avatar_url) => setForm((current) => ({ ...current, avatar_url }))}
                onProfileUpdated={(profile) => queryClient.setQueryData(['profile', 'me', user?.id], profile)}
              />
            </div>
          </aside>

          <form onSubmit={handleSubmit} className="border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-bold text-slate-950">Thông tin liên hệ</h2>
              <p className="mt-1 text-sm text-slate-500">Các trường định danh chỉ quản trị viên mới có thể thay đổi.</p>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                <span className="inline-flex items-center gap-2"><IdCard className="h-4 w-4 text-slate-400" /> Họ và tên</span>
                <input value={studentProfile.full_name} disabled className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-500" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                <span className="inline-flex items-center gap-2"><AtSign className="h-4 w-4 text-slate-400" /> Email đăng nhập</span>
                <input value={profileData.user.email ?? ''} disabled className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-500" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" /> Số điện thoại học sinh</span>
                <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Ví dụ: 0912 345 678" className="rounded-md border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                <span className="inline-flex items-center gap-2"><UsersRound className="h-4 w-4 text-slate-400" /> Tên phụ huynh</span>
                <input value={form.parent_name} onChange={(event) => setForm((current) => ({ ...current, parent_name: event.target.value }))} placeholder="Họ và tên phụ huynh" className="rounded-md border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" /> Số điện thoại phụ huynh</span>
                <input value={form.parent_phone} onChange={(event) => setForm((current) => ({ ...current, parent_phone: event.target.value }))} placeholder="Số điện thoại liên hệ" className="rounded-md border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                <span className="inline-flex items-center gap-2"><Home className="h-4 w-4 text-slate-400" /> Địa chỉ thường trú</span>
                <textarea value={form.permanent_address} onChange={(event) => setForm((current) => ({ ...current, permanent_address: event.target.value }))} rows={3} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố" className="resize-y rounded-md border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500" />
              </label>
            </div>
            {updateMutation.isError && <p className="mx-5 mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">Không thể cập nhật hồ sơ. Vui lòng kiểm tra dữ liệu và thử lại.</p>}
            <div className="flex justify-end border-t border-slate-100 px-5 py-4">
              <button type="submit" disabled={updateMutation.isPending} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">
                <Save className="h-4 w-4" /> {updateMutation.isPending ? 'Đang lưu...' : 'Lưu hồ sơ'}
              </button>
            </div>
          </form>
        </div>
      )}
    </StudentPortalLayout>
  );
}
