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
    : 'Chưa xuất bản';
}

export function PostCard({ categoryName = 'Tin tức', compact = false, post }: PostCardProps) {
  const coverUrl = resolvePublicMediaUrl(post.cover_image_url);

  return (
    <Link
      to={`/tin-tuc/${post.slug}`}
      className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-blue-300 hover:shadow-md"
    >
      {!compact && (
        <div className="aspect-[16/9] bg-slate-100">
          {coverUrl ? (
            <img src={coverUrl} alt={post.title} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-blue-50 via-white to-emerald-50 text-sm font-semibold text-blue-700">
              THPT PCT
            </div>
          )}
        </div>
      )}
      <div className={compact ? 'p-4' : 'p-5'}>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-700">
          <span>{categoryName}</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-500">{formatDate(post.published_at)}</span>
        </div>
        <h3 className={`${compact ? 'mt-2 text-base' : 'mt-3 text-lg'} line-clamp-2 font-bold text-slate-950 group-hover:text-blue-700`}>
          {post.title}
        </h3>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{post.excerpt ?? post.content}</p>
      </div>
    </Link>
  );
}
