import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, ShieldCheck, ShieldX, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getAdminUsers } from '../../services/adminUser.service';
import {
  getGuardianLinks,
  inviteGuardianLink,
  revokeGuardianLink,
  verifyGuardianLink,
} from '../../services/guardian.service';
import { useAuth } from '../../stores/auth-context';
import type { GuardianLinkStatus } from '../../types/guardian';

const statusLabels: Record<GuardianLinkStatus, string> = {
  pending: 'Chờ xác minh',
  verified: 'Đã xác minh',
  revoked: 'Đã thu hồi',
};

export function AdminGuardiansPage() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'' | GuardianLinkStatus>('');
  const [guardianId, setGuardianId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [relationship, setRelationship] = useState('Cha/Mẹ');
  const [message, setMessage] = useState<string | null>(null);

  const links = useQuery({
    queryKey: ['admin', 'guardian-links', status],
    queryFn: () =>
      getGuardianLinks(accessToken!, {
        page: 1,
        limit: 50,
        status: status || undefined,
      }),
    enabled: Boolean(accessToken),
  });
  const guardians = useQuery({
    queryKey: ['admin', 'users', 'guardian-options'],
    queryFn: () =>
      getAdminUsers(accessToken!, { page: 1, limit: 50, role: 'guardian' }),
    enabled: Boolean(accessToken),
  });
  const students = useQuery({
    queryKey: ['admin', 'users', 'student-options'],
    queryFn: () =>
      getAdminUsers(accessToken!, { page: 1, limit: 50, role: 'student' }),
    enabled: Boolean(accessToken),
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['admin', 'guardian-links'],
    });
  };
  const invite = useMutation({
    mutationFn: () =>
      inviteGuardianLink(accessToken!, {
        guardian_user_id: Number(guardianId),
        student_user_id: Number(studentId),
        relationship,
      }),
    onSuccess: async () => {
      setMessage('Đã tạo liên kết chờ xác minh.');
      setStudentId('');
      await refresh();
    },
    onError: () => setMessage('Không thể tạo liên kết. Kiểm tra lại tài khoản và trạng thái hiện tại.'),
  });
  const verify = useMutation({
    mutationFn: (id: number) => verifyGuardianLink(accessToken!, id),
    onSuccess: refresh,
  });
  const revoke = useMutation({
    mutationFn: (id: number) =>
      revokeGuardianLink(accessToken!, id, 'Thu hồi bởi quản trị viên'),
    onSuccess: refresh,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!guardianId || !studentId || !relationship.trim()) return;
    invite.mutate();
  }

  return (
    <AdminLayout>
      <div className="grid gap-6">
        <header>
          <p className="text-sm font-semibold text-blue-700">Quản lý gia đình</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            Liên kết phụ huynh - học sinh
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Chỉ liên kết đã xác minh mới được quyền xem dữ liệu học sinh.
          </p>
        </header>

        <form
          onSubmit={submit}
          className="grid gap-4 border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_1fr_180px_auto]"
        >
          <select
            value={guardianId}
            onChange={(event) => setGuardianId(event.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Chọn tài khoản phụ huynh</option>
            {guardians.data?.data.map((item) => (
              <option key={item.id} value={item.id}>
                {item.full_name} - {item.email}
              </option>
            ))}
          </select>
          <select
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Chọn học sinh</option>
            {students.data?.data.map((item) => (
              <option key={item.id} value={item.id}>
                {item.full_name} - {item.username || item.email}
              </option>
            ))}
          </select>
          <input
            value={relationship}
            onChange={(event) => setRelationship(event.target.value)}
            placeholder="Quan hệ"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            disabled={invite.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" /> Mời liên kết
          </button>
          {message && (
            <p className="text-sm text-slate-600 md:col-span-4">{message}</p>
          )}
        </form>

        <section className="border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-blue-700" />
              <h2 className="font-bold text-slate-950">Danh sách liên kết</h2>
            </div>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as '' | GuardianLinkStatus)
              }
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Chờ xác minh</option>
              <option value="verified">Đã xác minh</option>
              <option value="revoked">Đã thu hồi</option>
            </select>
          </div>
          {links.isLoading ? (
            <p className="p-6 text-sm text-slate-500">Đang tải...</p>
          ) : links.data?.data.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Phụ huynh</th>
                    <th className="px-4 py-3">Học sinh</th>
                    <th className="px-4 py-3">Quan hệ</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {links.data.data.map((link) => (
                    <tr key={link.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-950">{link.guardian_name}</p>
                        <p className="text-xs text-slate-500">{link.guardian_email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{link.student_name}</p>
                        <p className="text-xs text-slate-500">{link.student_code}</p>
                      </td>
                      <td className="px-4 py-3">{link.relationship}</td>
                      <td className="px-4 py-3">{statusLabels[link.status]}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {link.status === 'pending' && (
                            <button
                              onClick={() => verify.mutate(link.id)}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"
                            >
                              <ShieldCheck className="h-4 w-4" /> Xác minh
                            </button>
                          )}
                          {link.status !== 'revoked' && (
                            <button
                              onClick={() => {
                                if (window.confirm('Thu hồi liên kết này?')) {
                                  revoke.mutate(link.id);
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded-md bg-red-50 px-3 py-2 text-xs font-bold text-red-700"
                            >
                              <ShieldX className="h-4 w-4" /> Thu hồi
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-8 text-center text-sm text-slate-500">
              Chưa có liên kết phụ huynh.
            </p>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
