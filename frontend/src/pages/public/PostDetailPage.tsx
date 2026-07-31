import DOMPurify from 'dompurify';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  CalendarDays,
  Clock3,
  Copy,
  Newspaper,
  School,
  Share2,
} from 'lucide-react';

import { MainLayout } from '../../components/layout/MainLayout';
import { Seo } from '../../components/public/Seo';
import { resolvePublicMediaUrl } from '../../lib/media-url';

import { getCategories } from '../../services/category.service';
import { getPostBySlug, getPosts } from '../../services/post.service';

import type { Category } from '../../types/category';
import type { Post } from '../../types/post';

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(value))
    : 'Chưa xuất bản';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toRenderableHtml(content: string) {
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(content);

  if (looksLikeHtml) return content;

  return content
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('');
}

function sanitizePostContent(content: string) {
  return DOMPurify.sanitize(toRenderableHtml(content), {
    ALLOWED_TAGS: [
      'a',
      'blockquote',
      'br',
      'em',
      'figcaption',
      'figure',
      'h2',
      'h3',
      'img',
      'li',
      'ol',
      'p',
      'strong',
      'ul',
    ],
    ALLOWED_ATTR: ['alt', 'href', 'src', 'target', 'rel', 'title'],
    ADD_ATTR: ['target'],
  });
}

export function PostDetailPage() {
  const { slug } = useParams();

  const [post, setPost] = useState<Post | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!slug) {
        setError('Thiếu slug bài viết.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        const [postResponse, categoryResponse, postsResponse] =
          await Promise.all([
            getPostBySlug(slug),
            getCategories(),
            getPosts({ page: 1, limit: 6 }),
          ]);

        if (isMounted) {
          setPost(postResponse.data);
          setCategories(categoryResponse.data);

          setRelatedPosts(
            postsResponse.data
              .filter((item) => item.slug !== slug)
              .slice(0, 3),
          );

          setError(null);
        }
      } catch {
        if (isMounted) {
          setError('Không thể tải chi tiết bài viết.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const category = useMemo(
    () => categories.find((item) => item.id === post?.category_id),
    [categories, post?.category_id],
  );

  const sanitizedContent = useMemo(
    () => (post ? sanitizePostContent(post.content) : ''),
    [post],
  );

  const coverUrl = post ? resolvePublicMediaUrl(post.cover_image_url) : '';
  const galleryImages = useMemo(
    () =>
      (post?.post_images ?? [])
        .filter((image) => image.image_url)
        .map((image) => ({
          ...image,
      publicUrl: resolvePublicMediaUrl(image.image_url),
        })),
    [post?.post_images],
  );
  const hasContent = Boolean(sanitizedContent.trim());

  return (
    <MainLayout>
      <Seo
        title={post?.title ?? 'Tin tức'}
        description={post?.excerpt ?? post?.content}
        canonicalPath={slug ? `/tin-tuc/${slug}` : '/tin-tuc'}
        image={coverUrl}
        type="article"
        publishedTime={post?.published_at}
      />
      <main className="bg-slate-50">
        {isLoading && (
          <section className="mx-auto max-w-7xl px-4 py-16">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
              Đang tải dữ liệu...
            </div>
          </section>
        )}

        {error && (
          <section className="mx-auto max-w-7xl px-4 py-16">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
              {error}
            </div>
          </section>
        )}

        {!isLoading && !error && post && (
          <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_340px]">
            {/* MAIN ARTICLE */}
            <article className="min-w-0">
              {/* TOP BAR */}
              <div className="mb-8 flex items-center justify-between gap-4">
                <Link
                  to="/tin-tuc"
                  className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 transition hover:gap-3 hover:text-blue-900"
                >
                  ← Quay lại tin tức
                </Link>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
                    title="Chia sẻ"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void navigator.clipboard?.writeText(window.location.href)
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
                    title="Sao chép liên kết"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* HEADER */}
              <header className="mb-8">
                <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                  {category?.name ?? 'Tin tức'}
                </span>

                <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight text-slate-950 md:text-5xl">
                  {post.title}
                </h1>

                {post.excerpt && (
                  <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">
                    {post.excerpt}
                  </p>
                )}

                <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-slate-200 py-4 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-blue-700" />
                    {formatDate(post.published_at)}
                  </span>

                  <span className="inline-flex items-center gap-2">
                    <School className="h-4 w-4 text-blue-700" />
                    THPT Phan Chu Trinh
                  </span>

                  <span className="inline-flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-blue-700" />
                    {new Intl.DateTimeFormat('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    }).format(new Date(post.published_at ?? ''))}
                  </span>
                </div>
              </header>

              {/* COVER IMAGE */}
              {coverUrl && (
                <figure className="mb-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <img
                    src={coverUrl}
                    alt={post.title}
                    className="w-full bg-white object-contain"
                  />

                  <figcaption className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs text-slate-500">
                    Hình ảnh minh họa bài viết từ THPT Phan Chu Trinh - Phan
                    Thiết.
                  </figcaption>
                </figure>
              )}

              {/* CONTENT */}
              {hasContent && (
                <div
                  className="rich-content rounded-2xl border border-slate-200 bg-white p-6 text-base text-slate-700 shadow-sm md:p-8"
                  dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                />
              )}

              {galleryImages.length > 0 && (
                <section className={`${hasContent ? 'mt-8' : ''} rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6`}>
                  <h2 className="text-xl font-bold text-slate-950">Hình ảnh bài viết</h2>
                  <div className="mt-5 grid gap-6">
                    {galleryImages.map((image, index) => (
                      <figure key={`${image.image_url}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        <img
                          src={image.publicUrl}
                          alt={image.alt_text || image.caption || `${post.title} - ảnh ${index + 1}`}
                          className="h-auto w-full bg-white object-contain"
                        />
                        {image.caption && (
                          <figcaption className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm text-slate-500">
                            {image.caption}
                          </figcaption>
                        )}
                      </figure>
                    ))}
                  </div>
                </section>
              )}

              {!hasContent && galleryImages.length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-base text-slate-600 shadow-sm md:p-8">
                  Nội dung bài viết đang được cập nhật.
                </div>
              )}

              {/* TAGS */}
              <div className="mt-10 flex flex-wrap gap-3 border-t border-slate-200 pt-6">
                <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700">
                  #TinTuc
                </span>

                <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700">
                  #THPTPhanChuTrinh
                </span>

                {category?.name && (
                  <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700">
                    #{category.name.replace(/\s+/g, '')}
                  </span>
                )}
              </div>
            </article>

            {/* SIDEBAR */}
            <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
              {/* RELATED POSTS */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-950">
                  <Newspaper className="h-5 w-5 text-blue-700" />
                  Tin liên quan
                </h3>

                <div className="mt-5 space-y-5">
                  {relatedPosts.length > 0 ? (
                    relatedPosts.map((item) => {
                  const relatedCover = resolvePublicMediaUrl(
                        item.cover_image_url,
                      );

                      return (
                        <Link
                          key={item.id}
                          to={`/tin-tuc/${item.slug}`}
                          className="group flex gap-4"
                        >
                          <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-blue-50">
                            {relatedCover ? (
                              <img
                                src={relatedCover}
                                alt={item.title}
                                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-blue-700">
                                PCT
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                              Tin tức
                            </p>

                            <h4 className="mt-1 line-clamp-2 text-sm font-bold leading-6 text-slate-950 transition group-hover:text-blue-700">
                              {item.title}
                            </h4>
                          </div>
                        </Link>
                      );
                    })
                  ) : (
                    <p className="text-sm leading-6 text-slate-500">
                      Chưa có tin liên quan.
                    </p>
                  )}
                </div>
              </div>

              {/* INFO BOX */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-slate-950">
                  Kênh thông tin
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Theo dõi các thông báo mới nhất từ nhà trường dành cho học
                  sinh, phụ huynh và giáo viên.
                </p>

                <Link
                  to="/tin-tuc"
                  className="mt-5 inline-flex w-full justify-center rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
                >
                  Xem tất cả tin tức
                </Link>
              </div>
            </aside>
          </section>
        )}
      </main>
    </MainLayout>
  );
}
