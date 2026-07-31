import DOMPurify from 'dompurify';
import { CalendarDays, Copy, Newspaper, School, Share2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
    : 'Đang cập nhật';
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
  if (/<\/?[a-z][\s\S]*>/i.test(content)) return content;
  return content
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('');
}

function sanitizePostContent(content: string) {
  return DOMPurify.sanitize(toRenderableHtml(content), {
    ALLOWED_TAGS: ['a', 'blockquote', 'br', 'em', 'figcaption', 'figure', 'h2', 'h3', 'img', 'li', 'ol', 'p', 'strong', 'ul'],
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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!slug) {
        setError('Thiếu đường dẫn bài viết.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const [postResponse, categoryResponse, postsResponse] = await Promise.all([
          getPostBySlug(slug),
          getCategories(),
          getPosts({ page: 1, limit: 6 }),
        ]);
        if (isMounted) {
          setPost(postResponse.data);
          setCategories(categoryResponse.data);
          setRelatedPosts(postsResponse.data.filter((item) => item.slug !== slug).slice(0, 3));
          setError(null);
        }
      } catch {
        if (isMounted) setError('Không thể tải chi tiết bài viết hoặc bài viết chưa được công bố.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadData();
    return () => { isMounted = false; };
  }, [slug]);

  const category = useMemo(
    () => categories.find((item) => item.id === post?.category_id),
    [categories, post?.category_id],
  );
  const sanitizedContent = useMemo(
    () => sanitizePostContent(post?.content ?? ''),
    [post?.content],
  );
  const coverUrl = resolvePublicMediaUrl(post?.cover_image_url);
  const galleryImages = useMemo(
    () => (post?.post_images ?? []).filter((image) => image.image_url).map((image) => ({
      ...image,
      publicUrl: resolvePublicMediaUrl(image.image_url),
    })),
    [post?.post_images],
  );
  const hasContent = Boolean(sanitizedContent.replace(/<[^>]+>/g, '').trim());

  async function shareArticle() {
    if (navigator.share && post) {
      await navigator.share({ title: post.title, url: window.location.href });
      return;
    }
    await navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
  }

  async function copyLink() {
    await navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

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
      <main className="bg-white">
        {isLoading && <section className="mx-auto max-w-7xl px-4 py-16"><div className="border border-slate-200 p-6 text-sm text-slate-600">Đang tải bài viết...</div></section>}
        {error && <section className="mx-auto max-w-7xl px-4 py-16"><div className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div></section>}

        {!isLoading && !error && post && (
          <section className="mx-auto grid max-w-7xl items-start gap-10 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:py-14">
            <article className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <Link to="/tin-tuc" className="text-sm font-bold text-blue-700 hover:text-blue-900">← Quay lại tin tức</Link>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => void shareArticle()} className="flex h-10 w-10 items-center justify-center border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700" title="Chia sẻ bài viết">
                    <Share2 className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => void copyLink()} className="flex h-10 w-10 items-center justify-center border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700" title="Sao chép liên kết">
                    <Copy className="h-4 w-4" />
                  </button>
                  {copied && <span className="text-xs font-semibold text-emerald-700">Đã sao chép</span>}
                </div>
              </div>

              <header className="py-8">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">{category?.name ?? 'Tin tức'}</span>
                <h1 className="mt-4 max-w-4xl text-3xl font-extrabold leading-tight tracking-tight text-slate-950 md:text-5xl">{post.title}</h1>
                {post.excerpt && <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">{post.excerpt}</p>}
                <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-blue-700" />{formatDate(post.published_at ?? post.created_at)}</span>
                  <span className="inline-flex items-center gap-2"><School className="h-4 w-4 text-blue-700" />THPT Phan Chu Trinh</span>
                </div>
              </header>

              {coverUrl && (
                <figure className="mb-9 border border-slate-200 bg-slate-50">
                  <img src={coverUrl} alt={post.title} className="max-h-[48rem] w-full bg-white object-contain" />
                  <figcaption className="border-t border-slate-200 px-4 py-3 text-center text-xs text-slate-500">Ảnh đại diện bài viết</figcaption>
                </figure>
              )}

              {hasContent && (
                <div className="rich-content max-w-none border-t border-slate-200 pt-8 text-base text-slate-700" dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
              )}

              {galleryImages.length > 0 && (
                <section className={`${hasContent ? 'mt-10' : ''} border-t border-slate-200 pt-8`}>
                  <h2 className="text-2xl font-extrabold text-slate-950">Hình ảnh bài viết</h2>
                  <div className="mt-6 grid gap-8">
                    {galleryImages.map((image, index) => (
                      <figure key={`${image.image_url}-${index}`} className="border border-slate-200 bg-white">
                        <img src={image.publicUrl} alt={image.alt_text || image.caption || `${post.title} - ảnh ${index + 1}`} className="h-auto w-full bg-white object-contain" />
                        {image.caption && <figcaption className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm text-slate-500">{image.caption}</figcaption>}
                      </figure>
                    ))}
                  </div>
                </section>
              )}

              {!hasContent && galleryImages.length === 0 && (
                <div className="border-t border-slate-200 py-8 text-slate-600">Nội dung bài viết đang được cập nhật.</div>
              )}
            </article>

            <aside className="border border-slate-200 bg-slate-50 p-5 lg:sticky lg:top-28">
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-950"><Newspaper className="h-5 w-5 text-blue-700" />Tin liên quan</h2>
              <div className="mt-5 divide-y divide-slate-200">
                {relatedPosts.length > 0 ? relatedPosts.map((item) => {
                  const imageUrl = resolvePublicMediaUrl(item.cover_image_url);
                  return (
                    <Link key={item.id} to={`/tin-tuc/${item.slug}`} className="group grid grid-cols-[88px_minmax(0,1fr)] gap-3 py-4 first:pt-0">
                      <span className="h-16 overflow-hidden bg-blue-100">
                        {imageUrl ? <img src={imageUrl} alt={item.title} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-xs font-bold text-blue-700">PCT</span>}
                      </span>
                      <span className="line-clamp-3 text-sm font-bold leading-5 text-slate-900 group-hover:text-blue-700">{item.title}</span>
                    </Link>
                  );
                }) : <p className="py-5 text-sm text-slate-500">Chưa có tin liên quan.</p>}
              </div>
              <Link to="/tin-tuc" className="mt-3 inline-flex text-sm font-bold text-blue-700">Xem tất cả tin tức →</Link>
            </aside>
          </section>
        )}
      </main>
    </MainLayout>
  );
}
