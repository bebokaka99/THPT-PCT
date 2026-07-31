import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getAdminRoles } from '../../services/adminRole.service';
import { createAdminUser, getAdminUserById, updateAdminUser } from '../../services/adminUser.service';
import { useAuth } from '../../stores/auth-context';
import type { Role } from '../../types/role';
import type { UserFormInput, UserStatus } from '../../types/user';

const emptyForm: UserFormInput = {
  email: '',
  full_name: '',
  password: '',
  status: 'active',
  roles: [],
};

export function AdminUserFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { accessToken, user: currentUser } = useAuth();
  const isEdit = Boolean(id);
  const [form, setForm] = useState<UserFormInput>(emptyForm);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!accessToken) {
        return;
      }

      try {
        setIsLoading(true);
        const roleResponse = await getAdminRoles(accessToken);
        let nextForm = emptyForm;

        if (id) {
          const user = await getAdminUserById(accessToken, Number(id));
          nextForm = {
            email: user.email ?? '',
            full_name: user.full_name,
            password: '',
            status: user.status,
            roles: user.roles,
          };
        }

        if (isMounted) {
          setRoles(roleResponse.data);
          setForm(nextForm);
          setError(null);
        }
      } catch {
        if (isMounted) {
          setError('Không thể tải dữ liệu form tài khoản.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [accessToken, id]);

  function updateField<K extends keyof UserFormInput>(key: K, value: UserFormInput[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleRole(roleName: string) {
    setForm((current) => {
      const currentRoles = current.roles ?? [];
      return {
        ...current,
        roles: currentRoles.includes(roleName)
          ? currentRoles.filter((item) => item !== roleName)
          : [...currentRoles, roleName],
      };
    });
  }

  function normalizeInput(): UserFormInput {
    return {
      email: form.email.trim(),
      full_name: form.full_name.trim(),
      password: form.password?.trim() || undefined,
      status: form.status ?? 'active',
      roles: form.roles ?? [],
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setError('Phiên đăng nhập không hợp lệ.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      const input = normalizeInput();

      if (id) {
        await updateAdminUser(accessToken, Number(id), input);
      } else {
        await createAdminUser(accessToken, input);
      }

      navigate('/admin/users');
    } catch {
      setError('Không thể lưu tài khoản. Vui lòng kiểm tra email, password và roles.');
    } finally {
      setIsSaving(false);
    }
  }

  const isEditingSelf = isEdit && Number(id) === currentUser?.id;

  return (
    <AdminLayout>
      <section className="mx-auto max-w-3xl">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <Link to="/admin/users" className="text-sm font-semibold text-blue-700">
            Quay lại danh sách
          </Link>
          <h2 className="mt-3 text-2xl font-bold text-slate-950">
            {isEdit ? 'Sửa tài khoản' : 'Tạo tài khoản mới'}
          </h2>
        </div>

        {error && <p className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
        {isLoading ? (
          <p className="mt-4 rounded border border-slate-200 bg-white p-5 text-slate-600">Đang tải form...</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 grid gap-4 rounded-lg border border-slate-200 bg-white p-5">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
                required
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Họ tên
              <input
                value={form.full_name}
                onChange={(event) => updateField('full_name', event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
                required
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Password {isEdit && <span className="font-normal text-slate-500">(để trống nếu không đổi)</span>}
              <input
                type="password"
                value={form.password ?? ''}
                onChange={(event) => updateField('password', event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
                required={!isEdit}
                minLength={10}
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Trạng thái
              <select
                value={form.status}
                onChange={(event) => updateField('status', event.target.value as UserStatus)}
                disabled={isEditingSelf}
                className="rounded border border-slate-300 px-3 py-2 font-normal text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Tạm ngưng</option>
                <option value="locked">Đã khóa</option>
              </select>
            </label>

            <fieldset className="grid gap-3">
              <legend className="text-sm font-semibold text-slate-700">Roles</legend>
              <div className="grid gap-2 rounded border border-slate-200 p-3 sm:grid-cols-3">
                {roles.map((role) => (
                  <label key={role.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={(form.roles ?? []).includes(role.name)}
                      onChange={() => toggleRole(role.name)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span>{role.display_name}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap justify-end gap-3">
              <Link
                to="/admin/users"
                className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Hủy
              </Link>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu tài khoản'}
              </button>
            </div>
          </form>
        )}
      </section>
    </AdminLayout>
  );
}
