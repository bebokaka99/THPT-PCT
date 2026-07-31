import { FileText, Newspaper, Search } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../components/layout/MainLayout';
import { EmptyState } from '../../components/public/EmptyState';
import { Seo } from '../../components/public/Seo';
import { resolvePublicMediaUrl } from '../../lib/media-url';
import { searchSite } from '../../services/search.service';
import type { SearchResponse, SearchType } from '../../types/search';

const tabs: Array<{ label: string; value: SearchType }> = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Tin tức', value: 'posts' },
  { label: 'Tài liệu', value: 'documents' },
];

function normalizeType(value: string | null): SearchType {
  return value === 'posts' || value === 'documents' || value === 'all' ? value : 'all';
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
    : 'Đang cập nhật';
}

function nextSearchParams(input: { q: string; type: SearchType; page?: number }) {
  return { q: input.q, type: input.type, page: String(input.page ?? 1) };
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const type = normalizeType(searchParams.get('type'));
  const rawPage = Number(searchParams.get('page') ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const [searchValue, setSearchValue] = useState(q);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setSearchValue(q), [q]);

  useEffect(() => {
    let isMounted = true;
    const keyword = q.trim();
    if (keyword.length < 2) {
      setResult(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    async function loadSearchResults() {
      try {
        setIsLoading(true);
        const response = await searchSite({ q: keyword, type, page, limit: 10 });
        if (isMounted) { setResult(response); setError(null); }
      } catch {
        if (isMounted) { setError('Không thể tải kết quả tìm kiếm. Vui lòng thử lại sau.'); setResult(null); }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadSearchResults();
    return () => { isMounted = false; };
  }, [page, q, type]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchParams(nextSearchParams({ q: searchValue.trim(), type }));
  }

  const posts = result?.posts?.data ?? [];
  const documents = result?.documents?.data ?? [];
  const totalResults = (result?.posts?.total ?? 0) + (result?.documents?.total ?? 0);
  const maxGroupTotal = Math.max(result?.posts?.total ?? 0, result?.documents?.total ?? 0);
  const totalPages = Math.ceil(maxGroupTotal / 10);

  return (
    <MainLayout>
      <Seo title={q ? `Tìm kiếm: ${q}` : 'Tìm kiếm'} description="Tra cứu tin tức, thông báo và tài liệu của nhà trường." canonicalPath="/tim-kiem" noIndex />
      <section className="border-b border-slate-200 bg-blue-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 md:py-14">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Tra cứu toàn site</p>
          <h1 className="mt-3 text-3xl font-extrabold md:text-4xl">Tìm kiếm</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100 md:text-base">Tra cứu tin tức, thông báo và tài liệu của nhà trường.</p>
          <form onSubmit={handleSubmit} className="mt-7 flex max-w-3xl bg-white p-1">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} className="h-12 w-full pl-12 pr-4 text-base text-slate-900 outline-none" placeholder="Nhập từ khóa cần tìm..." />
            </label>
            <button type="submit" className="bg-blue-700 px-5 text-sm font-bold text-white hover:bg-blue-800 md:px-7">Tìm kiếm</button>
          </form>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl gap-1 px-4 py-4">
          {tabs.map((tab) => (
            <button key={tab.value} type="button" onClick={() => setSearchParams(nextSearchParams({ q: q.trim(), type: tab.value }))} className={`px-4 py-2 text-sm font-bold transition ${type === tab.value ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-blue-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:py-12">
        {!q && <EmptyState title="Nhập từ khóa để bắt đầu" description="Bạn có thể tìm theo tiêu đề tin tức, nội dung thông báo hoặc tên tài liệu." />}
        {q.trim().length > 0 && q.trim().length < 2 && <div className="border border-blue-200 bg-blue-50 p-5 text-sm font-semibold text-blue-800">Vui lòng nhập ít nhất 2 ký tự để tìm kiếm.</div>}
        {isLoading && <div className="border border-slate-200 bg-white p-6 text-sm text-slate-600">Đang tìm kiếm...</div>}
        {error && <div className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>}

        {!isLoading && !error && q.trim().length >= 2 && result && (
          <div className="grid gap-10">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5">
              <h2 className="text-xl font-extrabold text-slate-950">Kết quả cho “{result.query}”</h2>
              <span className="text-sm text-slate-500">{totalResults} kết quả</span>
            </div>
            {totalResults === 0 && <EmptyState title="Không tìm thấy kết quả" description="Hãy thử từ khóa khác hoặc chọn phạm vi tìm kiếm rộng hơn." />}

            {posts.length > 0 && (
              <section>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-950"><Newspaper className="h-5 w-5 text-blue-700" />Tin tức</h2>
                  <span className="text-sm text-slate-500">{result.posts?.total ?? 0} kết quả</span>
                </div>
                <div className="divide-y divide-slate-200 border-y border-slate-200">
                  {posts.map((post) => {
                    const coverUrl = resolvePublicMediaUrl(post.cover_image_url);
                    return (
                      <Link key={post.id} to={`/tin-tuc/${post.slug}`} className="group grid gap-4 bg-white py-5 md:grid-cols-[180px_minmax(0,1fr)]">
                        <div className="aspect-[16/9] overflow-hidden bg-blue-50 md:aspect-auto md:h-28">
                          {coverUrl ? <img src={coverUrl} alt={post.title} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-sm font-bold text-blue-700">THPT PCT</span>}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-500">Tin tức · {formatDate(post.published_at ?? post.created_at)}</p>
                          <h3 className="mt-2 line-clamp-2 text-lg font-extrabold text-slate-950 group-hover:text-blue-700">{post.title}</h3>
                          {post.excerpt && <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{post.excerpt}</p>}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {documents.length > 0 && (
              <section>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-950"><FileText className="h-5 w-5 text-blue-700" />Tài liệu</h2>
                  <span className="text-sm text-slate-500">{result.documents?.total ?? 0} kết quả</span>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {documents.map((document) => (
                    <Link key={document.id} to={`/tai-lieu/${document.slug}`} className="group border border-slate-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-sm">
                      <p className="text-xs font-semibold text-slate-500">{document.category ?? 'Tài liệu'} · {formatDate(document.published_at ?? document.created_at)}</p>
                      <h3 className="mt-2 line-clamp-2 text-lg font-extrabold text-slate-950 group-hover:text-blue-700">{document.title}</h3>
                      {document.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{document.description}</p>}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 border-t border-slate-200 pt-7">
                <button type="button" disabled={page <= 1} onClick={() => setSearchParams(nextSearchParams({ q, type, page: page - 1 }))} className="border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-40">Trang trước</button>
                <span className="text-sm text-slate-600">Trang {page} / {totalPages}</span>
                <button type="button" disabled={page >= totalPages} onClick={() => setSearchParams(nextSearchParams({ q, type, page: page + 1 }))} className="border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-40">Trang sau</button>
              </div>
            )}
          </div>
        )}
      </section>
    </MainLayout>
  );
}
