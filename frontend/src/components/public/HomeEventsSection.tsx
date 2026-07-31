import { CalendarDays, Clock3, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SchoolEvent } from '../../types/event';
import { SectionHeading } from './SectionHeading';

export function HomeEventsSection({ events }: { events: SchoolEvent[] }) {
  const visibleEvents = events.slice(0, 3);

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-16">
        <SectionHeading
          eyebrow="Lịch nhà trường"
          title="Sự kiện sắp diễn ra"
          description="Theo dõi các chương trình, hoạt động và mốc thời gian quan trọng."
          actionLabel="Xem lịch sự kiện"
          actionTo="/su-kien"
        />

        {visibleEvents.length > 0 ? (
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {visibleEvents.map((event) => {
              const start = new Date(event.start_time);
              return (
                <Link
                  key={event.id}
                  to={`/su-kien/${event.slug}`}
                  className="group flex min-h-52 flex-col border border-slate-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="block bg-blue-700 px-3 py-2 text-center text-white">
                      <span className="block text-2xl font-extrabold leading-none">
                        {start.getDate()}
                      </span>
                      <span className="mt-1 block text-[11px] font-bold uppercase">
                        Tháng {start.getMonth() + 1}
                      </span>
                    </span>
                    <span className="line-clamp-1 text-xs font-bold uppercase tracking-wide text-blue-700">
                      {event.category || 'Sự kiện'}
                    </span>
                  </div>
                  <h3 className="mt-5 line-clamp-2 text-lg font-extrabold leading-7 text-slate-950 transition group-hover:text-blue-700">
                    {event.title}
                  </h3>
                  <div className="mt-auto space-y-2 pt-5 text-xs text-slate-500">
                    <p className="flex items-center gap-2">
                      {event.all_day ? <CalendarDays className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                      {event.all_day
                        ? 'Cả ngày'
                        : new Intl.DateTimeFormat('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(start)}
                    </p>
                    {event.location && (
                      <p className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span className="line-clamp-1">{event.location}</span>
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
            Chưa có sự kiện sắp diễn ra.
          </div>
        )}
      </div>
    </section>
  );
}
