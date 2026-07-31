import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../components/layout/MainLayout';
import { EmptyState } from '../../components/public/EmptyState';
import { PostCard } from '../../components/public/PostCard';
import { Seo } from '../../components/public/Seo';
import { getCategories } from '../../services/category.service';
import { getPosts } from '../../services/post.service';

function nextSearchParams(input: { page?: number; q?: string; categorySlug?: string }) {
  return {
    ...(input.q ? { q: input.q } : {}),
    ...(input.categorySlug ? { category: input.categorySlug } : {}),
    page: String(input.page ?? 1),
  };
}

export function PostsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawPage = Number(searchParams.get('page') ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const q = searchParams.get('q') ?? '';
  const categorySlug = searchParams.get('category') ?? '';
  const [searchValue, setSearchValue] = useState(q);

  const postsQuery = useQuery({
    queryKey: ['public', 'posts', { page, q, categorySlug }],
    queryFn: () => getPosts({ page, limit: 9, q, categorySlug }),
  });
  const categoriesQuery = useQuery({
    queryKey: ['public', 'categories'],
    queryFn: getCategories,
  });

  useEffect(() => setSearchValue(q), [q]);

  const postsResponse = postsQuery.data;
  const categories = categoriesQuery.data?.data ?? [];
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const isLoading = postsQuery.isLoading || categoriesQuery.isLoading;
  const hasError = postsQuery.isError || categoriesQuery.isError;
  const meta = postsResponse?.meta;

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchParams(nextSearchParams({ q: searchValue.trim(), categorySlug }));
  }

  function handleCategoryChange(nextCategory: string) {
    setSearchParams(nextSearchParams({ q, categorySlug: nextCategory }));
  }

  return (
    <MainLayout>
      <Seo
        title="Tin tức"
        description="Tin tức, thông báo, hoạt động và thông tin tuyển sinh của Trường THPT Phan Chu Trinh - Phan Thiết."
        canonicalPath="/tin-tuc"
      />
      <section className="border-b border-slate-200 bg-blue-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 md:py-14">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Thông tin nhà trường</p>
          <h1 className="mt-3 text-3xl font-extrabold md:text-4xl">Tin tức và thông báo</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100 md:text-base">
            Theo dõi các thông báo, hoạt động, tin tuyển sinh và cập nhật quan trọng từ nhà trường.
          </p>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5">
          <form onSubmit={handleSearch} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                className="h-11 w-full border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-600"
                placeholder="Tìm theo tiêu đề, mô tả hoặc nội dung..."
              />
            </label>
            <select
              value={categorySlug}
              onChange={(event) => handleCategoryChange(event.target.value)}
              className="h-11 border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-600"
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>{category.name}</option>
              ))}
            </select>
            <button type="submit" className="h-11 bg-blue-700 px-6 text-sm font-bold text-white transition hover:bg-blue-800">
              Tìm kiếm
            </button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold text-slate-950">Danh sách bài viết</h2>
          {meta && <p className="text-sm text-slate-500">{meta.total} bài viết</p>}
        </div>

        {isLoading && <div className="border border-slate-200 bg-white p-6 text-sm text-slate-600">Đang tải tin tức...</div>}
        {hasError && <div className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">Không thể tải danh sách tin tức.</div>}

        {!isLoading && !hasError && (
          <>
            {postsResponse?.data.length === 0 ? (
              <EmptyState title="Không có tin phù hợp" description="Hãy thử đổi từ khóa tìm kiếm hoặc bộ lọc danh mục." />
            ) : (
              <div className="grid items-stretch gap-5 md:grid-cols-2 lg:grid-cols-3">
                {postsResponse?.data.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    categoryName={post.category_id ? categoryMap.get(post.category_id) : undefined}
                  />
                ))}
              </div>
            )}

            {meta && meta.totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-3 border-t border-slate-200 pt-7">
                <button
                  type="button"
                  disabled={meta.page <= 1}
                  onClick={() => setSearchParams(nextSearchParams({ q, categorySlug, page: meta.page - 1 }))}
                  className="border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Trang trước
                </button>
                <span className="text-sm text-slate-600">Trang {meta.page} / {meta.totalPages}</span>
                <button
                  type="button"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setSearchParams(nextSearchParams({ q, categorySlug, page: meta.page + 1 }))}
                  className="border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Trang sau
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </MainLayout>
  );
}
