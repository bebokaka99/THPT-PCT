import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../components/layout/MainLayout';
import { DocumentCard } from '../../components/public/DocumentCard';
import { EmptyState } from '../../components/public/EmptyState';
import { Seo } from '../../components/public/Seo';
import { getDocuments } from '../../services/document.service';

function nextSearchParams(input: { page?: number; q?: string; category?: string }) {
  return {
    ...(input.q ? { q: input.q } : {}),
    ...(input.category ? { category: input.category } : {}),
    page: String(input.page ?? 1),
  };
}

export function DocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawPage = Number(searchParams.get('page') ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const q = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const [searchValue, setSearchValue] = useState(q);

  const documentsQuery = useQuery({
    queryKey: ['public', 'documents', { page, q, category }],
    queryFn: () => getDocuments({ page, limit: 10, q, category }),
  });

  useEffect(() => setSearchValue(q), [q]);

  const response = documentsQuery.data;
  const categories = useMemo(() => {
    const values = new Set<string>();
    response?.data.forEach((document) => document.category && values.add(document.category));
    if (category) values.add(category);
    return Array.from(values).sort();
  }, [category, response]);
  const meta = response?.meta;

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchParams(nextSearchParams({ q: searchValue.trim(), category }));
  }

  return (
    <MainLayout>
      <Seo
        title="Tài liệu"
        description="Tra cứu tài liệu, văn bản, biểu mẫu và thông tin công khai của Trường THPT Phan Chu Trinh - Phan Thiết."
        canonicalPath="/tai-lieu"
      />
      <section className="border-b border-slate-200 bg-blue-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 md:py-14">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Kho tài nguyên</p>
          <h1 className="mt-3 text-3xl font-extrabold md:text-4xl">Tài liệu và văn bản</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100 md:text-base">
            Tra cứu văn bản, biểu mẫu, tài liệu công khai và các tệp do nhà trường phát hành.
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
                className="h-11 w-full border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-blue-600"
                placeholder="Tìm theo tên tài liệu..."
              />
            </label>
            <select
              value={category}
              onChange={(event) => setSearchParams(nextSearchParams({ q, category: event.target.value }))}
              className="h-11 border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-600"
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <button type="submit" className="h-11 bg-blue-700 px-6 text-sm font-bold text-white hover:bg-blue-800">Tìm kiếm</button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold text-slate-950">Danh sách tài liệu</h2>
          {meta && <p className="text-sm text-slate-500">{meta.total} tài liệu</p>}
        </div>
        {documentsQuery.isLoading && <div className="border border-slate-200 bg-white p-6 text-sm text-slate-600">Đang tải tài liệu...</div>}
        {documentsQuery.isError && <div className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">Không thể tải danh sách tài liệu.</div>}

        {!documentsQuery.isLoading && !documentsQuery.isError && (
          <>
            {response?.data.length === 0 ? (
              <EmptyState title="Không có tài liệu phù hợp" description="Hãy thử đổi từ khóa hoặc bộ lọc danh mục." />
            ) : (
              <div className="grid items-stretch gap-5 lg:grid-cols-2">
                {response?.data.map((document) => <DocumentCard key={document.id} document={document} />)}
              </div>
            )}
            {meta && meta.totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-3 border-t border-slate-200 pt-7">
                <button
                  type="button"
                  disabled={meta.page <= 1}
                  onClick={() => setSearchParams(nextSearchParams({ q, category, page: meta.page - 1 }))}
                  className="border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-40"
                >Trang trước</button>
                <span className="text-sm text-slate-600">Trang {meta.page} / {meta.totalPages}</span>
                <button
                  type="button"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setSearchParams(nextSearchParams({ q, category, page: meta.page + 1 }))}
                  className="border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-40"
                >Trang sau</button>
              </div>
            )}
          </>
        )}
      </section>
    </MainLayout>
  );
}
