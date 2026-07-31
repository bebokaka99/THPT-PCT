import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MainLayout } from '../../components/layout/MainLayout';
import { Seo } from '../../components/public/Seo';
import { getCategoryBySlug } from '../../services/category.service';
import { getPosts } from '../../services/post.service';
import type { Category } from '../../types/category';
import type { Post } from '../../types/post';

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(value))
    : 'Chưa xuất bản';
}

export function CategoryPage() {
  const { slug } = useParams();
  const [category, setCategory] = useState<Category | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!slug) {
        setError('Thiếu slug danh mục.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const [categoryResponse, postResponse] = await Promise.all([
          getCategoryBySlug(slug),
          getPosts({ page: 1, limit: 10, categorySlug: slug }),
        ]);

        if (isMounted) {
          setCategory(categoryResponse.data);
          setPosts(postResponse.data);
          setError(null);
        }
      } catch {
        if (isMounted) {
          setError('Không thể tải dữ liệu danh mục.');
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

  return (
    <MainLayout>
      <Seo
        title={category?.name ?? 'Danh mục'}
        description={category?.description}
        canonicalPath={slug ? `/danh-muc/${slug}` : '/'}
      />
      <section className="mx-auto max-w-6xl px-4 py-10">
        {isLoading && <p className="text-slate-600">Đang tải dữ liệu...</p>}
        {error && <p className="rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}

        {!isLoading && !error && category && (
          <>
            <p className="text-sm font-semibold uppercase text-blue-700">Danh mục</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-950">{category.name}</h2>
            {category.description && (
              <p className="mt-3 max-w-2xl text-slate-600">{category.description}</p>
            )}

            <div className="mt-8 grid gap-4">
              {posts.length === 0 && (
                <p className="rounded border border-slate-200 bg-white p-5 text-slate-600">
                  Chưa có bài viết published trong danh mục này.
                </p>
              )}
              {posts.map((post) => (
                <Link
                  key={post.id}
                  to={`/tin-tuc/${post.slug}`}
                  className="rounded-lg border border-slate-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-sm"
                >
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    {formatDate(post.published_at)}
                  </p>
                  <h3 className="mt-2 text-xl font-bold text-slate-950">{post.title}</h3>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                    {post.excerpt ?? post.content}
                  </p>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </MainLayout>
  );
}
