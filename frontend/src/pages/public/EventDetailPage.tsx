import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Clock3, MapPin } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { MainLayout } from '../../components/layout/MainLayout';
import { Seo } from '../../components/public/Seo';
import { resolvePublicMediaUrl } from '../../lib/media-url';
import { getEventBySlug } from '../../services/event.service';

export function EventDetailPage() {
  const { slug = '' } = useParams();
  const query = useQuery({ queryKey: ['public', 'event', slug], queryFn: () => getEventBySlug(slug), enabled: Boolean(slug) });
  const event = query.data;
  const start = event ? new Date(event.start_time) : null;
  const imageUrl = resolvePublicMediaUrl(event?.cover_image_url);

  return (
    <MainLayout>
      <Seo title={event?.title ?? 'Chi tiết sự kiện'} description={event?.description} canonicalPath={`/su-kien/${slug}`} image={event?.cover_image_url} />
      <article className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <Link to="/su-kien" className="text-sm font-bold text-blue-700">← Quay lại lịch sự kiện</Link>
        {query.isLoading && <div className="mt-6 border border-slate-200 p-6 text-sm text-slate-600">Đang tải sự kiện...</div>}
        {query.isError && <div className="mt-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700">Không tìm thấy sự kiện hoặc sự kiện chưa được công khai.</div>}
        {event && start && (
          <>
            <header className="mt-8 border-b border-slate-200 pb-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">{event.category || 'Sự kiện nhà trường'}</p>
              <h1 className="mt-4 text-3xl font-extrabold leading-tight text-slate-950 md:text-5xl">{event.title}</h1>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-600">
                <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-blue-700" />{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full' }).format(start)}</span>
                {!event.all_day && <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-blue-700" />{new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(start)}</span>}
                {event.location && <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-blue-700" />{event.location}</span>}
              </div>
            </header>
            {imageUrl && <img src={imageUrl} alt={event.title} className="mt-8 max-h-[42rem] w-full border border-slate-200 bg-white object-contain" />}
            <section className="mt-8 whitespace-pre-wrap border-t border-slate-200 pt-8 text-base leading-8 text-slate-700">
              {event.description || 'Thông tin chi tiết đang được cập nhật.'}
            </section>
          </>
        )}
      </article>
    </MainLayout>
  );
}
