import { useEffect, useState, type FormEvent } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import {
  createAdminCategory,
  deleteAdminCategory,
  getAllAdminCategories,
  updateAdminCategory,
} from '../../services/adminCategory.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type { Category, CategoryFormInput } from '../../types/category';

const emptyForm: CategoryFormInput = {
  name: '',
  slug: '',
  description: '',
  sort_order: 0,
  is_active: true,
};

export function AdminCategoriesPage() {
  const { accessToken } = useAuth();
  const { success } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<CategoryFormInput>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCategories() {
    if (!accessToken) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await getAllAdminCategories(accessToken);
      setCategories(response.data);
      setError(null);
    } catch {
      setError('Không thể tải danh sách danh mục.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCategories();
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function handleEdit(category: Category) {
    setEditingId(category.id);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description ?? '',
      sort_order: category.sort_order,
      is_active: category.is_active,
    });
  }

  function normalizeInput(): CategoryFormInput {
    return {
      name: form.name.trim(),
      slug: form.slug?.trim() || undefined,
      description: form.description?.trim() || null,
      sort_order: Number(form.sort_order ?? 0),
      is_active: Boolean(form.is_active),
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

      if (editingId) {
        await updateAdminCategory(accessToken, editingId, input);
      } else {
        await createAdminCategory(accessToken, input);
      }

      resetForm();
      await loadCategories();
      success(editingId ? 'Đã cập nhật danh mục.' : 'Đã tạo danh mục.');
    } catch {
      setError('Không thể lưu danh mục. Vui lòng kiểm tra dữ liệu.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(category: Category) {
    if (!accessToken || !window.confirm(`Xóa danh mục "${category.name}"?`)) {
      return;
    }

    try {
      await deleteAdminCategory(accessToken, category.id);
      await loadCategories();
      success('Đã xóa danh mục.');
    } catch {
      setError('Không thể xóa danh mục.');
    }
  }

  return (
    <AdminLayout>
      <section className="grid gap-5">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold uppercase text-blue-700">Quản trị</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">Danh mục</h2>
        </div>

        {error && <p className="rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}

        <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-bold text-slate-950">
            {editingId ? 'Sửa danh mục' : 'Tạo danh mục'}
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Tên danh mục
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Slug tùy chọn
              <input
                value={form.slug ?? ''}
                onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                className="rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
              Mô tả
              <textarea
                value={form.description ?? ''}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                className="min-h-24 rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Thứ tự
              <input
                type="number"
                min="0"
                value={form.sort_order ?? 0}
                onChange={(event) =>
                  setForm((current) => ({ ...current, sort_order: Number(event.target.value) }))
                }
                className="rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
              />
            </label>
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(form.is_active)}
                onChange={(event) =>
                  setForm((current) => ({ ...current, is_active: event.target.checked }))
                }
                className="h-4 w-4"
              />
              Đang hoạt động
            </label>
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Hủy sửa
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Đang lưu...' : editingId ? 'Cập nhật danh mục' : 'Tạo danh mục'}
            </button>
          </div>
        </form>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {isLoading ? (
            <p className="p-5 text-slate-600">Đang tải danh mục...</p>
          ) : categories.length === 0 ? (
            <p className="p-5 text-slate-600">Chưa có danh mục.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Tên</th>
                    <th className="px-4 py-3">Slug</th>
                    <th className="px-4 py-3">Thứ tự</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <td className="px-4 py-3 font-semibold text-slate-950">{category.name}</td>
                      <td className="px-4 py-3 text-slate-600">{category.slug}</td>
                      <td className="px-4 py-3 text-slate-600">{category.sort_order}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {category.is_active ? 'Active' : 'Inactive'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(category)}
                            className="rounded border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:border-blue-600 hover:text-blue-700"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(category)}
                            className="rounded border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50"
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </AdminLayout>
  );
}
