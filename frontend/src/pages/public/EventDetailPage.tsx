import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Clock3, MapPin } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { MainLayout } from '../../components/layout/MainLayout';
import { Seo } from '../../components/public/Seo';
import { resolvePublicMediaUrl } from '../../lib/media-url';
import { getEventBySlug } from '../../services/event.service';

export function EventDetailPage() {
  const { slug = '' } = useParams();
  const query = useQuery({
    queryKey: ['public', 'event', slug],
    queryFn: () => getEventBySlug(slug),
    enabled: Boolean(slug),
  });
  const event = query.data;
  const start = event ? new Date(event.start_time) : null;
  const imageUrl = resolvePublicMediaUrl(event?.cover_image_url);

  return (
    <MainLayout>
      <Seo
        title={event?.title ?? 'Chi tiết sự kiện'}
        description={event?.description}
        canonicalPath={`/su-kien/${slug}`}
        image={event?.cover_image_url}
      />
      <article className="mx-auto max-w-5xl px-4 py-10">
        <Link to="/su-kien" className="text-sm font-semibold text-blue-700">
          ← Lịch sự kiện
        </Link>
        {query.isLoading && <p className="mt-6">Đang tải sự kiện...</p>}
        {query.isError && (
          <p className="mt-6 border border-red-200 bg-red-50 p-5 text-red-700">
            Không tìm thấy sự kiện hoặc sự kiện chưa được công khai.
          </p>
        )}
        {event && start && (
          <>
            <header className="mt-6 border-b border-slate-200 pb-7">
              <p className="text-sm font-semibold text-blue-700">
                {event.category || 'Sự kiện nhà trường'}
              </p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950 md:text-5xl">
                {event.title}
              </h1>
              <div className="mt-5 flex flex-wrap gap-4 text-sm text-slate-600">
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
            </header>
            {imageUrl && (
              <img
                src={imageUrl}
                alt={event.title}
                className="mt-7 max-h-[34rem] w-full rounded-lg border border-slate-200 bg-white object-contain"
              />
            )}
            <section className="mt-7 whitespace-pre-wrap text-base leading-8 text-slate-700">
              {event.description || 'Thông tin chi tiết đang được cập nhật.'}
            </section>
          </>
        )}
      </article>
    </MainLayout>
  );
}
