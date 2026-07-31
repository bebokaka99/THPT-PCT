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
    <Link
      to={`/su-kien/${event.slug}`}
      className="group grid overflow-hidden border border-slate-200 bg-white shadow-sm transition hover:border-blue-300 hover:shadow-md sm:grid-cols-[150px_minmax(0,1fr)]"
    >
      <div className="relative min-h-40 bg-blue-50">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={event.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-4 text-blue-800">
            <span className="text-4xl font-bold">{start.getDate()}</span>
            <span className="text-sm font-semibold">Tháng {start.getMonth() + 1}</span>
          </div>
        )}
      </div>
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
            {event.category || 'Sự kiện'}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 ${
              event.status === 'cancelled'
                ? 'bg-red-50 text-red-700'
                : event.status === 'completed'
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {statusLabels[event.status]}
          </span>
        </div>
        <h2 className="mt-3 text-lg font-bold text-slate-950 transition group-hover:text-blue-700">
          {event.title}
        </h2>
        <div className="mt-3 grid gap-1.5 text-sm text-slate-500">
          <span className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full' }).format(start)}
          </span>
          {!event.all_day && (
            <span className="flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              {new Intl.DateTimeFormat('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              }).format(start)}
            </span>
          )}
          {event.location && (
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {event.location}
            </span>
          )}
        </div>
        {event.description && (
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
            {event.description}
          </p>
        )}
      </div>
    </Link>
  );
}
