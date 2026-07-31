import { CalendarDays, Clock3, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { resolvePublicMediaUrl } from '../../lib/media-url';
import type { SchoolEvent } from '../../types/event';

const statusLabels = {
  scheduled: 'Sắp diễn ra',
  cancelled: 'Đã hủy',
  completed: 'Đã kết thúc',
};

export function EventCard({ event }: { event: SchoolEvent }) {
  const start = new Date(event.start_time);
  const imageUrl = resolvePublicMediaUrl(event.cover_image_url);

  return (
    <article className="group grid h-full overflow-hidden border border-slate-200 bg-white shadow-sm transition hover:border-blue-300 hover:shadow-md sm:grid-cols-[160px_minmax(0,1fr)]">
      <Link to={`/su-kien/${event.slug}`} className="relative min-h-44 overflow-hidden bg-blue-50">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={event.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex h-full flex-col items-center justify-center bg-blue-950 p-4 text-blue-50">
            <span className="text-4xl font-extrabold">{start.getDate()}</span>
            <span className="mt-1 text-sm font-semibold">Tháng {start.getMonth() + 1}</span>
          </span>
        )}
      </Link>
      <div className="flex min-w-0 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="bg-blue-50 px-2.5 py-1 text-blue-700">
            {event.category || 'Sự kiện'}
          </span>
          <span className={event.status === 'cancelled' ? 'text-red-700' : 'text-emerald-700'}>
            {statusLabels[event.status]}
          </span>
        </div>
        <Link to={`/su-kien/${event.slug}`}>
          <h2 className="mt-3 line-clamp-2 text-lg font-extrabold leading-7 text-slate-950 transition group-hover:text-blue-700">
            {event.title}
          </h2>
        </Link>
        <div className="mt-4 grid gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-blue-700" />
            {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full' }).format(start)}
          </span>
          {!event.all_day && (
            <span className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-blue-700" />
              {new Intl.DateTimeFormat('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              }).format(start)}
            </span>
          )}
          {event.location && (
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-700" />
              <span className="line-clamp-1">{event.location}</span>
            </span>
          )}
        </div>
        {event.description && (
          <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">
            {event.description}
          </p>
        )}
      </div>
    </article>
  );
}
