import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getAcademicPeriods } from '../../services/academicPeriod.service';
import {
  createClassroom,
  getClassroomDetail,
  updateClassroom,
} from '../../services/classroom.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type { AcademicYear } from '../../types/academic-period';

const emptyForm = {
  name: '',
  academic_year_id: '',
  grade_level: '',
  homeroom_teacher_user_id: '',
  description: '',
  is_active: true,
};

export function AdminClassroomFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [periods, setPeriods] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    Promise.all([
      getAcademicPeriods(accessToken),
      id ? getClassroomDetail(accessToken, Number(id)) : Promise.resolve(null),
    ])
      .then(([years, classroom]) => {
        if (!active) return;
        setPeriods(years);
        if (classroom) {
          setForm({
            name: classroom.name,
            academic_year_id: classroom.academic_year_id
              ? String(classroom.academic_year_id)
              : '',
            grade_level: classroom.grade_level
              ? String(classroom.grade_level)
              : '',
            homeroom_teacher_user_id: classroom.homeroom_teacher_user_id
              ? String(classroom.homeroom_teacher_user_id)
              : '',
            description: classroom.description ?? '',
            is_active: classroom.is_active,
          });
        } else {
          const current = years.find((year) => year.status === 'active');
          if (current) {
            setForm((value) => ({
              ...value,
              academic_year_id: String(current.id),
            }));
          }
        }
      })
      .catch(() => setError('Không thể tải dữ liệu lớp học.'))
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken, id]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || isSaving) return;
    if (!form.academic_year_id) {
      setError('Vui lòng chọn năm học đã cấu hình.');
      return;
    }
    try {
      setIsSaving(true);
      setError(null);
      const payload = {
        name: form.name.trim(),
        academic_year_id: Number(form.academic_year_id),
        grade_level: form.grade_level ? Number(form.grade_level) : null,
        homeroom_teacher_user_id: form.homeroom_teacher_user_id
          ? Number(form.homeroom_teacher_user_id)
          : null,
        description: form.description.trim() || null,
        is_active: form.is_active,
      };
      if (id) await updateClassroom(accessToken, Number(id), payload);
      else await createClassroom(accessToken, payload);
      toast.success(id ? 'Đã cập nhật lớp học.' : 'Đã tạo lớp học.');
      navigate('/admin/classrooms');
    } catch {
      setError(
        'Không thể lưu lớp học. Năm học có thể đã đóng hoặc bị khóa.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminLayout>
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="mx-auto grid max-w-2xl gap-5 border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div>
          <p className="text-sm font-semibold text-blue-700">Quản lý lớp học</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            {id ? 'Sửa lớp học' : 'Tạo lớp học'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Lớp được liên kết với năm học chuẩn thay vì nhập chuỗi thủ công.
          </p>
        </div>

        {isLoading ? (
          <div className="h-40 animate-pulse bg-slate-100" />
        ) : (
          <>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Tên lớp
              <input
                required
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder="Ví dụ: 12A1"
                className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Năm học
              <select
                required
                value={form.academic_year_id}
                onChange={(event) =>
                  setForm({ ...form, academic_year_id: event.target.value })
                }
                className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal"
              >
                <option value="">Chọn năm học</option>
                {periods.map((year) => (
                  <option
                    key={year.id}
                    value={year.id}
                    disabled={
                      (year.status === 'closed' || year.is_locked) &&
                      String(year.id) !== form.academic_year_id
                    }
                  >
                    {year.name}
                    {year.status === 'active' ? ' (đang áp dụng)' : ''}
                    {year.status === 'closed' ? ' (đã đóng)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                Khối
                <input
                  type="number"
                  min={10}
                  max={12}
                  value={form.grade_level}
                  onChange={(event) =>
                    setForm({ ...form, grade_level: event.target.value })
                  }
                  placeholder="10, 11 hoặc 12"
                  className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                ID giáo viên chủ nhiệm
                <input
                  type="number"
                  min={1}
                  value={form.homeroom_teacher_user_id}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      homeroom_teacher_user_id: event.target.value,
                    })
                  }
                  placeholder="Để trống nếu chưa phân công"
                  className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
                />
              </label>
            </div>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Mô tả
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                className="min-h-24 rounded-md border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) =>
                  setForm({ ...form, is_active: event.target.checked })
                }
              />
              Lớp đang hoạt động
            </label>
          </>
        )}

        {error && (
          <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            disabled={isLoading || isSaving}
            className="rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu lớp học'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/classrooms')}
            className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            Hủy
          </button>
        </div>
      </form>
    </AdminLayout>
  );
}
