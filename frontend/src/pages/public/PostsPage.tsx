import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../components/layout/MainLayout';
import { EmptyState } from '../../components/public/EmptyState';
import { PostCard } from '../../components/public/PostCard';
import { SectionHeading } from '../../components/public/SectionHeading';
import { Seo } from '../../components/public/Seo';
import { getCategories } from '../../services/category.service';
import { getPosts } from '../../services/post.service';

function nextSearchParams(input: {
  page?: number;
  q?: string;
  categorySlug?: string;
}) {
  return {
    ...(input.q ? { q: input.q } : {}),
    ...(input.categorySlug ? { category: input.categorySlug } : {}),
    page: String(input.page ?? 1),
  };
}

export function PostsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? 1);
  const q = searchParams.get('q') ?? '';
  const categorySlug = searchParams.get('category') ?? '';
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const [searchValue, setSearchValue] = useState(q);

  const postsQuery = useQuery({
    queryKey: ['public', 'posts', { page: safePage, q, categorySlug }],
    queryFn: () =>
      getPosts({
        page: safePage,
        limit: 10,
        q,
        categorySlug,
      }),
  });
  const categoriesQuery = useQuery({
    queryKey: ['public', 'categories'],
    queryFn: getCategories,
  });

  useEffect(() => {
    setSearchValue(q);
  }, [q]);

  const postsResponse = postsQuery.data;
  const categories = categoriesQuery.data?.data ?? [];
  const isLoading = postsQuery.isLoading || categoriesQuery.isLoading;
  const error =
    postsQuery.isError || categoriesQuery.isError
      ? 'Khong the tai danh sach tin tuc.'
      : null;

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

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
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <SectionHeading
            eyebrow="Tin tuc"
            title="Tin moi va thong bao"
            description="Theo doi cac thong bao, hoat dong, tin tuyen sinh va cap nhat quan trong tu nha truong."
          />

          <form
            onSubmit={handleSearch}
            className="mt-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_240px_auto]"
          >
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              placeholder="Tim theo tieu de, mo ta hoac noi dung..."
            />
            <select
              value={categorySlug}
              onChange={(event) => handleCategoryChange(event.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            >
              <option value="">Tat ca danh muc</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Tim kiem
            </button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        {isLoading && (
          <p className="rounded-lg border border-slate-200 bg-white p-5 text-slate-600">
            Dang tai tin tuc...
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </p>
        )}

        {!isLoading && !error && (
          <>
            {postsResponse?.data.length === 0 ? (
              <EmptyState
                title="Khong co tin phu hop"
                description="Hay thu doi tu khoa tim kiem hoac bo loc danh muc."
              />
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {postsResponse?.data.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    categoryName={
                      post.category_id
                        ? categoryMap.get(post.category_id)
                        : undefined
                    }
                  />
                ))}
              </div>
            )}

            {meta && meta.totalPages > 1 && (
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={meta.page <= 1}
                  onClick={() =>
                    setSearchParams(
                      nextSearchParams({ q, categorySlug, page: meta.page - 1 }),
                    )
                  }
                  className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Truoc
                </button>
                <span className="text-sm text-slate-600">
                  Trang {meta.page} / {meta.totalPages}
                </span>
                <button
                  type="button"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() =>
                    setSearchParams(
                      nextSearchParams({ q, categorySlug, page: meta.page + 1 }),
                    )
                  }
                  className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Sau
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </MainLayout>
  );
}
