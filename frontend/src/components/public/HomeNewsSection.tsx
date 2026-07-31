import { ArrowRight, CalendarDays, Newspaper } from 'lucide-react';
import { Link } from 'react-router-dom';
import { resolvePublicMediaUrl } from '../../lib/media-url';
import type { Post } from '../../types/post';
import { SectionHeading } from './SectionHeading';

type HomeNewsSectionProps = {
  posts: Post[];
};

function formatDate(value?: string | null) {
  if (!value) return 'Đang cập nhật';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function NewsImage({ post }: { post: Post }) {
  const imageUrl = resolvePublicMediaUrl(post.cover_image_url);

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={post.title}
        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
      />
    );
  }

  return (
    <div className="flex h-full items-center justify-center bg-blue-950 px-8 text-center text-white">
      <div>
        <Newspaper className="mx-auto h-9 w-9 text-blue-200" />
        <p className="mt-3 text-sm font-bold uppercase tracking-[0.16em]">
          THPT Phan Chu Trinh
        </p>
      </div>
    </div>
  );
}

export function HomeNewsSection({ posts }: HomeNewsSectionProps) {
  const featuredPost = posts.find((post) => post.cover_image_url) ?? posts[0];
  const latestPosts = posts
    .filter((post) => post.id !== featuredPost?.id)
    .slice(0, 4);

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 md:py-16">
        <SectionHeading
          eyebrow="Thông tin nhà trường"
          title="Tin tức nổi bật"
          description="Các thông báo, hoạt động và thông tin tuyển sinh mới nhất từ nhà trường."
          actionLabel="Xem tất cả tin tức"
          actionTo="/tin-tuc"
        />

        {featuredPost ? (
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
            <Link
              to={`/tin-tuc/${featuredPost.slug}`}
              className="group overflow-hidden border border-slate-200 bg-white shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <div className="aspect-[16/9] overflow-hidden bg-slate-100">
                <NewsImage post={featuredPost} />
              </div>
              <div className="p-5 md:p-7">
                <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <CalendarDays className="h-4 w-4 text-blue-700" />
                  {formatDate(featuredPost.published_at ?? featuredPost.created_at)}
                </p>
                <h3 className="mt-3 line-clamp-2 text-2xl font-extrabold leading-tight text-slate-950 transition group-hover:text-blue-700 md:text-3xl">
                  {featuredPost.title}
                </h3>
                {featuredPost.excerpt && (
                  <p className="mt-4 line-clamp-3 text-sm leading-7 text-slate-600 md:text-base">
                    {featuredPost.excerpt}
                  </p>
                )}
              </div>
            </Link>

            <aside className="border border-slate-200 bg-slate-50 p-4 md:p-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                    Cập nhật
                  </p>
                  <h3 className="mt-1 text-xl font-extrabold text-slate-950">
                    Tin mới nhất
                  </h3>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  Tối đa 4 tin
                </span>
              </div>

              <div className="divide-y divide-slate-200">
                {latestPosts.length > 0 ? (
                  latestPosts.map((post, index) => (
                    <Link
                      key={post.id}
                      to={`/tin-tuc/${post.slug}`}
                      className="group grid min-h-28 grid-cols-[34px_minmax(0,1fr)] gap-3 py-4"
                    >
                      <span className="pt-0.5 text-lg font-extrabold text-blue-200 group-hover:text-blue-700">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-2 text-sm font-bold leading-6 text-slate-900 transition group-hover:text-blue-700">
                          {post.title}
                        </span>
                        <span className="mt-2 block text-xs text-slate-500">
                          {formatDate(post.published_at ?? post.created_at)}
                        </span>
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="py-10 text-center text-sm text-slate-500">
                    Chưa có tin mới khác.
                  </p>
                )}
              </div>

              <Link
                to="/tin-tuc"
                className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-900"
              >
                Danh sách tin
                <ArrowRight className="h-4 w-4" />
              </Link>
            </aside>
          </div>
        ) : (
          <div className="mt-8 border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
            Chưa có bài viết được công bố.
          </div>
        )}
      </div>
    </section>
  );
}
