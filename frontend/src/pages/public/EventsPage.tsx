import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../components/layout/MainLayout';
import { EmptyState } from '../../components/public/EmptyState';
import { EventCard } from '../../components/public/EventCard';
import { Seo } from '../../components/public/Seo';
import { getEvents } from '../../services/event.service';
import type { EventScope } from '../../types/event';

export function EventsPage() {
  const [params, setParams] = useSearchParams();
  const scope = (['upcoming', 'past'].includes(params.get('scope') ?? '')
    ? params.get('scope')
    : 'upcoming') as EventScope;
  const q = params.get('q') ?? '';
  const page = Math.max(Number(params.get('page') ?? 1) || 1, 1);
  const [search, setSearch] = useState(q);
  const eventsQuery = useQuery({
    queryKey: ['public', 'events', { scope, q, page }],
    queryFn: () => getEvents({ scope, q, page, limit: 8 }),
  });
  const meta = eventsQuery.data?.meta;

  function update(next: { scope?: EventScope; q?: string; page?: number }) {
    const nextQuery = next.q ?? q;
    setParams({
      scope: next.scope ?? scope,
      ...(nextQuery ? { q: nextQuery } : {}),
      page: String(next.page ?? 1),
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    update({ q: search.trim(), page: 1 });
  }

  return (
    <MainLayout>
      <Seo
        title="Sự kiện"
        description="Lịch hoạt động và sự kiện của Trường THPT Phan Chu Trinh - Phan Thiết."
        canonicalPath="/su-kien"
      />
      <section className="border-b border-slate-200 bg-blue-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <p className="text-sm font-semibold text-blue-200">Hoạt động nhà trường</p>
          <h1 className="mt-2 text-4xl font-bold">Lịch sự kiện</h1>
          <p className="mt-3 max-w-2xl text-blue-100">
            Theo dõi các chương trình, hoạt động và mốc thời gian quan trọng.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex w-fit rounded-md border border-slate-200 bg-white p-1">
            {[
              ['upcoming', 'Sắp diễn ra'],
              ['past', 'Đã diễn ra'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => update({ scope: value as EventScope, page: 1 })}
                className={`rounded px-4 py-2 text-sm font-semibold ${
                  scope === value ? 'bg-blue-700 text-white' : 'text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="flex w-full gap-2 md:max-w-md">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm sự kiện..."
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
            />
            <button className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
              Tìm
            </button>
          </form>
        </div>

        {eventsQuery.isLoading && (
          <p className="mt-6 border border-slate-200 bg-white p-6 text-slate-500">
            Đang tải sự kiện...
          </p>
        )}
        {eventsQuery.isError && (
          <p className="mt-6 border border-red-200 bg-red-50 p-5 text-red-700">
            Không thể tải lịch sự kiện.
          </p>
        )}
        {eventsQuery.data?.data.length === 0 && (
          <div className="mt-6">
            <EmptyState
              title="Chưa có sự kiện phù hợp"
              description="Các sự kiện mới sẽ được nhà trường cập nhật tại đây."
            />
          </div>
        )}
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {eventsQuery.data?.data.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
        {meta && meta.totalPages > 1 && (
          <div className="mt-7 flex items-center justify-center gap-3">
            <button
              disabled={page <= 1}
              onClick={() => update({ page: page - 1 })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
            >
              Trước
            </button>
            <span className="text-sm text-slate-600">
              Trang {page}/{meta.totalPages}
            </span>
            <button
              disabled={page >= meta.totalPages}
              onClick={() => update({ page: page + 1 })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        )}
      </section>
    </MainLayout>
  );
}
