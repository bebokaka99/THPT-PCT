import { useEffect, useState } from 'react';
import { MainLayout } from '../../components/layout/MainLayout';
import { EmptyState } from '../../components/public/EmptyState';
import { PostCard } from '../../components/public/PostCard';
import { Seo } from '../../components/public/Seo';
import { getCategoryBySlug } from '../../services/category.service';
import { getPosts } from '../../services/post.service';
import type { Category } from '../../types/category';
import type { Post } from '../../types/post';
import { useParams } from 'react-router-dom';

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
        setError('Thiếu đường dẫn danh mục.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const [categoryResponse, postResponse] = await Promise.all([
          getCategoryBySlug(slug),
          getPosts({ page: 1, limit: 12, categorySlug: slug }),
        ]);
        if (isMounted) {
          setCategory(categoryResponse.data);
          setPosts(postResponse.data);
          setError(null);
        }
      } catch {
        if (isMounted) setError('Không thể tải dữ liệu danh mục.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadData();
    return () => { isMounted = false; };
  }, [slug]);

  return (
    <MainLayout>
      <Seo
        title={category?.name ?? 'Danh mục'}
        description={category?.description}
        canonicalPath={slug ? `/danh-muc/${slug}` : '/'}
      />
      <section className="border-b border-slate-200 bg-blue-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 md:py-14">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Chuyên mục</p>
          <h1 className="mt-3 text-3xl font-extrabold md:text-4xl">{category?.name ?? 'Đang tải danh mục'}</h1>
          {category?.description && <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100 md:text-base">{category.description}</p>}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:py-12">
        {isLoading && <div className="border border-slate-200 bg-white p-6 text-sm text-slate-600">Đang tải dữ liệu...</div>}
        {error && <div className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>}
        {!isLoading && !error && category && (
          <>
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 className="text-xl font-extrabold text-slate-950">Bài viết trong danh mục</h2>
              <span className="text-sm text-slate-500">{posts.length} bài viết</span>
            </div>
            {posts.length === 0 ? (
              <EmptyState title="Chưa có bài viết" description="Bài viết thuộc danh mục này sẽ được cập nhật tại đây." />
            ) : (
              <div className="grid items-stretch gap-5 md:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => <PostCard key={post.id} post={post} categoryName={category.name} />)}
              </div>
            )}
          </>
        )}
      </section>
    </MainLayout>
  );
}
