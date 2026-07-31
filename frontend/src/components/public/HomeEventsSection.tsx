import { ArrowRight, CalendarDays, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SchoolEvent } from '../../types/event';

export function HomeEventsSection({ events }: { events: SchoolEvent[] }) {
  return (
    <section className="border-y border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-700">Lịch nhà trường</p>
            <h2 className="mt-1 text-3xl font-bold text-slate-950">Sự kiện sắp diễn ra</h2>
          </div>
          <Link to="/su-kien" className="inline-flex items-center gap-2 text-sm font-bold text-blue-700">
            Xem lịch <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {events.length === 0 ? (
          <div className="mt-7 border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
            Chưa có sự kiện sắp diễn ra.
          </div>
        ) : (
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {events.slice(0, 3).map((event) => {
              const start = new Date(event.start_time);
              return (
                <Link key={event.id} to={`/su-kien/${event.slug}`} className="group border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300">
                  <div className="flex items-start gap-4">
                    <div className="w-14 shrink-0 rounded-md bg-blue-700 px-2 py-2 text-center text-white">
                      <p className="text-2xl font-bold">{start.getDate()}</p>
                      <p className="text-[11px] font-semibold uppercase">Tháng {start.getMonth() + 1}</p>
                    </div>
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 font-bold text-slate-950 group-hover:text-blue-700">{event.title}</h3>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {event.all_day ? 'Cả ngày' : new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(start)}
                      </p>
                      {event.location && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin className="h-3.5 w-3.5" /> {event.location}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
