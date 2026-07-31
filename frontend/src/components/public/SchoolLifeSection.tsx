import { Image as ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { resolvePublicMediaUrl } from '../../lib/media-url';
import type { Post } from '../../types/post';
import { SectionHeading } from './SectionHeading';

function formatDate(value?: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function ActivityImage({ post }: { post: Post }) {
  const imageUrl = resolvePublicMediaUrl(post.cover_image_url);
  return imageUrl ? (
    <img
      src={imageUrl}
      alt={post.title}
      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
    />
  ) : (
    <div className="flex h-full items-center justify-center bg-blue-950 text-blue-100">
      <ImageIcon className="h-8 w-8" />
    </div>
  );
}

export function SchoolLifeSection({ posts }: { posts: Post[] }) {
  const featuredPost = posts[0];
  const secondaryPosts = posts.slice(1, 4);

  if (!featuredPost) return null;

  return (
    <section className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-16">
        <SectionHeading
          eyebrow="Hoạt động"
          title="Nhịp sống học đường"
          description="Những hoạt động nổi bật và khoảnh khắc đáng nhớ của học sinh nhà trường."
          actionLabel="Xem các hoạt động"
          actionTo="/danh-muc/hoat-dong"
        />

        <div className="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
          <Link
            to={`/tin-tuc/${featuredPost.slug}`}
            className="group overflow-hidden border border-slate-200 bg-white shadow-sm transition hover:border-blue-300 hover:shadow-md"
          >
            <div className="aspect-[16/9] overflow-hidden bg-slate-100">
              <ActivityImage post={featuredPost} />
            </div>
            <div className="p-5 md:p-6">
              <p className="text-xs font-semibold text-slate-500">
                {formatDate(featuredPost.published_at ?? featuredPost.created_at)}
              </p>
              <h3 className="mt-2 line-clamp-2 text-xl font-extrabold leading-7 text-slate-950 group-hover:text-blue-700 md:text-2xl">
                {featuredPost.title}
              </h3>
            </div>
          </Link>

          <div className="grid gap-4">
            {secondaryPosts.map((post) => (
              <Link
                key={post.id}
                to={`/tin-tuc/${post.slug}`}
                className="group grid min-h-32 grid-cols-[120px_minmax(0,1fr)] overflow-hidden border border-slate-200 bg-white transition hover:border-blue-300 hover:shadow-sm sm:grid-cols-[150px_minmax(0,1fr)]"
              >
                <div className="overflow-hidden bg-slate-100">
                  <ActivityImage post={post} />
                </div>
                <div className="min-w-0 p-4">
                  <p className="text-xs text-slate-500">
                    {formatDate(post.published_at ?? post.created_at)}
                  </p>
                  <h4 className="mt-2 line-clamp-3 text-sm font-bold leading-6 text-slate-950 group-hover:text-blue-700">
                    {post.title}
                  </h4>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
