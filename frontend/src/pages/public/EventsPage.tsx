import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
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
        <div className="mx-auto max-w-7xl px-4 py-12 md:py-14">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Hoạt động nhà trường</p>
          <h1 className="mt-3 text-3xl font-extrabold md:text-4xl">Lịch sự kiện</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100 md:text-base">
            Theo dõi các chương trình, hoạt động và mốc thời gian quan trọng của nhà trường.
          </p>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex w-fit border border-slate-200 bg-slate-50 p-1">
            {([
              ['upcoming', 'Sắp diễn ra'],
              ['past', 'Đã diễn ra'],
            ] as Array<[EventScope, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => update({ scope: value, page: 1 })}
                className={`px-4 py-2 text-sm font-bold transition ${scope === value ? 'bg-blue-700 text-white' : 'text-slate-600 hover:text-blue-700'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="flex w-full md:max-w-md">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm sự kiện..."
                className="h-11 w-full border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-blue-600"
              />
            </label>
            <button type="submit" className="h-11 bg-blue-700 px-5 text-sm font-bold text-white hover:bg-blue-800">Tìm</button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold text-slate-950">
            {scope === 'upcoming' ? 'Sự kiện sắp diễn ra' : 'Sự kiện đã diễn ra'}
          </h2>
          {meta && <p className="text-sm text-slate-500">{meta.total} sự kiện</p>}
        </div>
        {eventsQuery.isLoading && <div className="border border-slate-200 bg-white p-6 text-sm text-slate-600">Đang tải sự kiện...</div>}
        {eventsQuery.isError && <div className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">Không thể tải lịch sự kiện.</div>}
        {eventsQuery.data?.data.length === 0 && (
          <EmptyState title="Chưa có sự kiện phù hợp" description="Các sự kiện mới sẽ được nhà trường cập nhật tại đây." />
        )}
        <div className="grid items-stretch gap-5 lg:grid-cols-2">
          {eventsQuery.data?.data.map((event) => <EventCard key={event.id} event={event} />)}
        </div>
        {meta && meta.totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-3 border-t border-slate-200 pt-7">
            <button disabled={page <= 1} onClick={() => update({ page: page - 1 })} className="border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-40">Trang trước</button>
            <span className="text-sm text-slate-600">Trang {page} / {meta.totalPages}</span>
            <button disabled={page >= meta.totalPages} onClick={() => update({ page: page + 1 })} className="border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-40">Trang sau</button>
          </div>
        )}
      </section>
    </MainLayout>
  );
}
