import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../components/layout/MainLayout';
import { DocumentCard } from '../../components/public/DocumentCard';
import { EmptyState } from '../../components/public/EmptyState';
import { SectionHeading } from '../../components/public/SectionHeading';
import { Seo } from '../../components/public/Seo';
import { getDocuments } from '../../services/document.service';

function nextSearchParams(input: {
  page?: number;
  q?: string;
  category?: string;
}) {
  return {
    ...(input.q ? { q: input.q } : {}),
    ...(input.category ? { category: input.category } : {}),
    page: String(input.page ?? 1),
  };
}

export function DocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? 1);
  const q = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const [searchValue, setSearchValue] = useState(q);

  const documentsQuery = useQuery({
    queryKey: ['public', 'documents', { page: safePage, q, category }],
    queryFn: () =>
      getDocuments({
        page: safePage,
        limit: 10,
        q,
        category,
      }),
  });

  useEffect(() => {
    setSearchValue(q);
  }, [q]);

  const documentsResponse = documentsQuery.data;
  const isLoading = documentsQuery.isLoading;
  const error = documentsQuery.isError
    ? 'Khong the tai danh sach tai lieu.'
    : null;

  const categories = useMemo(() => {
    const values = new Set<string>();
    documentsResponse?.data.forEach((document) => {
      if (document.category) {
        values.add(document.category);
      }
    });
    return Array.from(values);
  }, [documentsResponse]);

  const meta = documentsResponse?.meta;

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchParams(nextSearchParams({ q: searchValue.trim(), category }));
  }

  function updateCategory(nextCategory: string) {
    setSearchParams(nextSearchParams({ q, category: nextCategory }));
  }

  return (
    <MainLayout>
      <Seo
        title="Tài liệu"
        description="Tra cứu tài liệu, văn bản, biểu mẫu và thông tin công khai của Trường THPT Phan Chu Trinh - Phan Thiết."
        canonicalPath="/tai-lieu"
      />
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <SectionHeading
            eyebrow="Tai lieu"
            title="Tai lieu va van ban nha truong"
            description="Tra cuu van ban, bieu mau, tai lieu cong khai va cac file duoc nha truong phat hanh."
          />

          <form
            onSubmit={handleSearch}
            className="mt-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_240px_auto]"
          >
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              placeholder="Tim theo tieu de tai lieu..."
            />
            <select
              value={category}
              onChange={(event) => updateCategory(event.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            >
              <option value="">Tat ca danh muc</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
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
            Dang tai tai lieu...
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </p>
        )}

        {!isLoading && !error && (
          <>
            {documentsResponse?.data.length === 0 ? (
              <EmptyState
                title="Khong co tai lieu phu hop"
                description="Hay thu doi tu khoa tim kiem hoac bo loc danh muc."
              />
            ) : (
              <div className="grid gap-5 lg:grid-cols-2">
                {documentsResponse?.data.map((document) => (
                  <DocumentCard key={document.id} document={document} />
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
                      nextSearchParams({ q, category, page: meta.page - 1 }),
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
                      nextSearchParams({ q, category, page: meta.page + 1 }),
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
