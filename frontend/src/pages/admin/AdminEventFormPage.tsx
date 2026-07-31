import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MediaPickerModal } from '../../components/admin/MediaPickerModal';
import { AdminLayout } from '../../components/layout/AdminLayout';
import {
  createAdminEvent,
  getAdminEventById,
  updateAdminEvent,
} from '../../services/adminEvent.service';
import { useAuth } from '../../stores/auth-context';
import type { EventFormInput, EventStatus } from '../../types/event';

type FormState = Omit<EventFormInput, 'start_time' | 'end_time'> & {
  start_time: string;
  end_time: string;
};

const emptyForm: FormState = {
  title: '',
  slug: '',
  description: '',
  category: '',
  location: '',
  cover_image_url: '',
  start_time: '',
  end_time: '',
  all_day: false,
  status: 'scheduled',
  is_public: false,
};

function localDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function AdminEventFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [isSaving, setIsSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !accessToken) return;
    getAdminEventById(accessToken, Number(id))
      .then((event) =>
        setForm({
          title: event.title,
          slug: event.slug,
          description: event.description ?? '',
          category: event.category ?? '',
          location: event.location ?? '',
          cover_image_url: event.cover_image_url ?? '',
          start_time: localDateTime(event.start_time),
          end_time: event.end_time ? localDateTime(event.end_time) : '',
          all_day: event.all_day,
          status: event.status,
          is_public: event.is_public,
        }),
      )
      .catch(() => setError('Không thể tải sự kiện.'))
      .finally(() => setIsLoading(false));
  }, [accessToken, id]);

  function field<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !form.start_time) return;
    const input: EventFormInput = {
      title: form.title.trim(),
      slug: form.slug?.trim() || undefined,
      description: form.description?.trim() || null,
      category: form.category?.trim() || null,
      location: form.location?.trim() || null,
      cover_image_url: form.cover_image_url?.trim() || null,
      start_time: new Date(form.start_time).toISOString(),
      end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
      all_day: form.all_day,
      status: form.status,
      is_public: form.is_public,
    };
    try {
      setIsSaving(true);
      setError(null);
      if (id) await updateAdminEvent(accessToken, Number(id), input);
      else await createAdminEvent(accessToken, input);
      navigate('/admin/events');
    } catch {
      setError('Không thể lưu sự kiện. Kiểm tra thời gian, slug và dữ liệu nhập.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminLayout>
      <section className="mx-auto max-w-4xl">
        <header className="border border-slate-200 bg-white p-5">
          <Link to="/admin/events" className="text-sm font-semibold text-blue-700">← Danh sách sự kiện</Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">
            {id ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện'}
          </h1>
        </header>
        {error && <p className="mt-4 border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
        {isLoading ? (
          <p className="mt-4 border border-slate-200 bg-white p-6">Đang tải...</p>
        ) : (
          <form onSubmit={submit} className="mt-4 grid gap-5 border border-slate-200 bg-white p-5 sm:p-6">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Tên sự kiện
              <input required maxLength={255} value={form.title} onChange={(e) => field('title', e.target.value)} className="rounded-md border border-slate-300 px-3 py-2.5 font-normal" />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Slug tùy chọn
                <input value={form.slug} onChange={(e) => field('slug', e.target.value)} className="rounded-md border border-slate-300 px-3 py-2.5 font-normal" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Nhóm sự kiện
                <input value={form.category ?? ''} onChange={(e) => field('category', e.target.value)} placeholder="Học thuật, Văn nghệ..." className="rounded-md border border-slate-300 px-3 py-2.5 font-normal" />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Mô tả
              <textarea maxLength={10000} value={form.description ?? ''} onChange={(e) => field('description', e.target.value)} className="min-h-36 rounded-md border border-slate-300 px-3 py-2.5 font-normal leading-6" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Địa điểm
              <input value={form.location ?? ''} onChange={(e) => field('location', e.target.value)} className="rounded-md border border-slate-300 px-3 py-2.5 font-normal" />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Bắt đầu
                <input required type="datetime-local" value={form.start_time} onChange={(e) => field('start_time', e.target.value)} className="rounded-md border border-slate-300 px-3 py-2.5 font-normal" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Kết thúc
                <input type="datetime-local" value={form.end_time} onChange={(e) => field('end_time', e.target.value)} className="rounded-md border border-slate-300 px-3 py-2.5 font-normal" />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={form.all_day} onChange={(e) => field('all_day', e.target.checked)} />
              Sự kiện cả ngày
            </label>
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-slate-700">Ảnh cover</label>
              <div className="flex gap-2">
                <input value={form.cover_image_url ?? ''} onChange={(e) => field('cover_image_url', e.target.value)} className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2.5 text-sm" />
                <button type="button" onClick={() => setPickerOpen(true)} className="rounded-md border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700">Chọn Media</button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Trạng thái lịch
                <select value={form.status} onChange={(e) => field('status', e.target.value as EventStatus)} className="rounded-md border border-slate-300 px-3 py-2.5 font-normal">
                  <option value="scheduled">Đã lên lịch</option>
                  <option value="cancelled">Đã hủy</option>
                  <option value="completed">Đã kết thúc</option>
                </select>
              </label>
              <label className="flex items-center gap-2 self-end rounded-md border border-slate-200 p-3 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={form.is_public} onChange={(e) => field('is_public', e.target.checked)} />
                Hiển thị công khai
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
              <Link to="/admin/events" className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold">Hủy</Link>
              <button disabled={isSaving} className="rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {isSaving ? 'Đang lưu...' : 'Lưu sự kiện'}
              </button>
            </div>
          </form>
        )}
      </section>
      {accessToken && (
        <MediaPickerModal
          isOpen={pickerOpen}
          token={accessToken}
          onClose={() => setPickerOpen(false)}
          onSelect={(url) => {
            field('cover_image_url', url);
            setPickerOpen(false);
          }}
        />
      )}
    </AdminLayout>
  );
}
