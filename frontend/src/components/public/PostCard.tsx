import { ArrowRight, CalendarDays, Newspaper } from 'lucide-react';
import { Link } from 'react-router-dom';
import { resolvePublicMediaUrl } from '../../lib/media-url';
import type { Post } from '../../types/post';

type PostCardProps = {
  post: Post;
  categoryName?: string;
  compact?: boolean;
};

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(value))
    : 'Đang cập nhật';
}

export function PostCard({
  categoryName = 'Tin tức',
  compact = false,
  post,
}: PostCardProps) {
  const coverUrl = resolvePublicMediaUrl(post.cover_image_url);

  return (
    <article className="group flex h-full flex-col overflow-hidden border border-slate-200 bg-white shadow-sm transition hover:border-blue-300 hover:shadow-md">
      {!compact && (
        <Link to={`/tin-tuc/${post.slug}`} className="block aspect-[16/9] overflow-hidden bg-slate-100">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={post.title}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <span className="flex h-full items-center justify-center bg-blue-950 text-blue-100">
              <Newspaper className="h-9 w-9" />
            </span>
          )}
        </Link>
      )}
      <div className={`flex flex-1 flex-col ${compact ? 'p-4' : 'p-5'}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
          <span className="text-blue-700">{categoryName}</span>
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDate(post.published_at ?? post.created_at)}
          </span>
        </div>
        <Link to={`/tin-tuc/${post.slug}`}>
          <h3 className={`${compact ? 'mt-2 text-base' : 'mt-3 text-lg'} line-clamp-2 font-extrabold leading-7 text-slate-950 transition group-hover:text-blue-700`}>
            {post.title}
          </h3>
        </Link>
        {post.excerpt && (
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
            {post.excerpt}
          </p>
        )}
        <Link
          to={`/tin-tuc/${post.slug}`}
          className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-bold text-blue-700"
        >
          Đọc bài viết
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
