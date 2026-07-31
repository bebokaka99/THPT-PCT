import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Eye, EyeOff, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/layout/AdminLayout';
import {
  cancelAdminEvent,
  completeAdminEvent,
  deleteAdminEvent,
  getAdminEvents,
  hideAdminEvent,
  publishAdminEvent,
} from '../../services/adminEvent.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type { EventStatus, SchoolEvent } from '../../types/event';

const statusLabels: Record<EventStatus, string> = {
  scheduled: 'Đã lên lịch',
  cancelled: 'Đã hủy',
  completed: 'Đã kết thúc',
};

export function AdminEventsPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['admin', 'events'];
  const query = useQuery({
    queryKey,
    queryFn: () => getAdminEvents(accessToken!, { scope: 'all', limit: 50 }),
    enabled: Boolean(accessToken),
  });

  const action = useMutation({
    mutationFn: async ({
      event,
      type,
    }: {
      event: SchoolEvent;
      type: 'publish' | 'hide' | 'cancel' | 'complete' | 'delete';
    }) => {
      if (type === 'delete') return deleteAdminEvent(accessToken!, event.id);
      if (type === 'publish') return publishAdminEvent(accessToken!, event.id);
      if (type === 'hide') return hideAdminEvent(accessToken!, event.id);
      if (type === 'cancel') return cancelAdminEvent(accessToken!, event.id);
      return completeAdminEvent(accessToken!, event.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['public', 'events'] });
      toast.success('Đã cập nhật sự kiện.');
    },
  });

  function run(event: SchoolEvent, type: Parameters<typeof action.mutate>[0]['type']) {
    if (
      type === 'delete' &&
      !window.confirm(`Xóa vĩnh viễn sự kiện "${event.title}"?`)
    ) return;
    action.mutate({ event, type });
  }

  return (
    <AdminLayout>
      <section className="grid gap-5">
        <header className="flex flex-col gap-4 border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700">Quản trị nội dung</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Sự kiện</h1>
            <p className="mt-1 text-sm text-slate-500">
              Lập lịch và kiểm soát sự kiện hiển thị trên website.
            </p>
          </div>
          <Link
            to="/admin/events/new"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            <Plus className="h-4 w-4" />
            Tạo sự kiện
          </Link>
        </header>

        {query.isLoading && <p className="border border-slate-200 bg-white p-6">Đang tải...</p>}
        {query.isError && (
          <p className="border border-red-200 bg-red-50 p-5 text-red-700">
            Không thể tải danh sách sự kiện.
          </p>
        )}
        {action.isError && (
          <p className="border border-red-200 bg-red-50 p-4 text-red-700">
            Không thể cập nhật sự kiện.
          </p>
        )}

        {query.data && (
          <div className="overflow-hidden border border-slate-200 bg-white">
            {query.data.data.length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                <CalendarDays className="mx-auto h-8 w-8" />
                <p className="mt-3">Chưa có sự kiện.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Sự kiện</th>
                      <th className="px-4 py-3">Thời gian</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3">Public</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {query.data.data.map((event) => (
                      <tr key={event.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-950">{event.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {event.location || 'Chưa có địa điểm'}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {new Intl.DateTimeFormat('vi-VN', {
                            dateStyle: 'short',
                            timeStyle: event.all_day ? undefined : 'short',
                          }).format(new Date(event.start_time))}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {statusLabels[event.status]}
                        </td>
                        <td className="px-4 py-3">
                          <span className={event.is_public ? 'text-emerald-700' : 'text-slate-500'}>
                            {event.is_public ? 'Công khai' : 'Đang ẩn'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Link
                              to={`/admin/events/${event.id}/edit`}
                              className="rounded-md border border-slate-300 px-3 py-1.5 font-semibold text-slate-700"
                            >
                              Sửa
                            </Link>
                            <button
                              onClick={() => run(event, event.is_public ? 'hide' : 'publish')}
                              className="inline-flex items-center gap-1 rounded-md border border-blue-200 px-3 py-1.5 font-semibold text-blue-700"
                            >
                              {event.is_public ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              {event.is_public ? 'Ẩn' : 'Công khai'}
                            </button>
                            {event.status === 'scheduled' && (
                              <>
                                <button onClick={() => run(event, 'complete')} className="rounded-md border border-emerald-200 px-3 py-1.5 font-semibold text-emerald-700">
                                  Hoàn tất
                                </button>
                                <button onClick={() => run(event, 'cancel')} className="rounded-md border border-amber-200 px-3 py-1.5 font-semibold text-amber-700">
                                  Hủy lịch
                                </button>
                              </>
                            )}
                            <button onClick={() => run(event, 'delete')} className="rounded-md border border-red-200 px-3 py-1.5 font-semibold text-red-700">
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
        )}
      </section>
    </AdminLayout>
  );
}
