import { Search } from 'lucide-react';
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
    ? new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(value))
    : 'Chưa xuất bản';
}

function nextSearchParams(input: { q: string; type: SearchType; page?: number }) {
  return {
    q: input.q,
    type: input.type,
    page: String(input.page ?? 1),
  };
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const type = normalizeType(searchParams.get('type'));
  const page = Number(searchParams.get('page') ?? 1);
  const [searchValue, setSearchValue] = useState(q);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSearchValue(q);
  }, [q]);

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
        const response = await searchSite({
          q: keyword,
          type,
          page: Number.isFinite(page) && page > 0 ? page : 1,
          limit: 10,
        });

        if (isMounted) {
          setResult(response);
          setError(null);
        }
      } catch {
        if (isMounted) {
          setError('Không thể tải kết quả tìm kiếm. Vui lòng thử lại sau.');
          setResult(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadSearchResults();

    return () => {
      isMounted = false;
    };
  }, [page, q, type]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const keyword = searchValue.trim();

    if (keyword.length < 2) {
      setSearchParams(nextSearchParams({ q: keyword, type }));
      return;
    }

    setSearchParams(nextSearchParams({ q: keyword, type }));
  }

  function handleTypeChange(nextType: SearchType) {
    setSearchParams(nextSearchParams({ q: q.trim(), type: nextType }));
  }

  const posts = result?.posts?.data ?? [];
  const documents = result?.documents?.data ?? [];
  const totalResults = (result?.posts?.total ?? 0) + (result?.documents?.total ?? 0);
  const shouldShowHint = q.trim().length > 0 && q.trim().length < 2;

  return (
    <MainLayout>
      <Seo
        title={q ? `Tìm kiếm: ${q}` : 'Tìm kiếm'}
        description="Tra cứu tin tức, thông báo và tài liệu của nhà trường."
        canonicalPath="/tim-kiem"
        noIndex
      />
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">Tra cứu</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-950 md:text-5xl">
              Tìm kiếm
            </h1>
            <p className="mt-4 text-base leading-8 text-slate-600">
              Tra cứu tin tức, thông báo và tài liệu của nhà trường.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                className="h-12 w-full rounded-xl border border-slate-300 pl-12 pr-4 text-base text-slate-900 outline-none transition focus:border-blue-600"
                placeholder="Nhập từ khóa cần tìm..."
              />
            </label>
            <button type="submit" className="rounded-xl bg-blue-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-800">
              Tìm kiếm
            </button>
          </form>

          <div className="mt-5 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => handleTypeChange(tab.value)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  type === tab.value
                    ? 'bg-blue-700 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        {!q && (
          <EmptyState
            title="Nhập từ khóa để bắt đầu"
            description="Bạn có thể tìm theo tiêu đề tin tức, nội dung thông báo hoặc tên tài liệu."
          />
        )}

        {shouldShowHint && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm font-semibold text-blue-800">
            Vui lòng nhập ít nhất 2 ký tự để tìm kiếm.
          </div>
        )}

        {isLoading && (
          <p className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
            Đang tìm kiếm...
          </p>
        )}

        {error && (
          <p className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            {error}
          </p>
        )}

        {!isLoading && !error && q.trim().length >= 2 && result && (
          <div className="grid gap-8">
            {totalResults === 0 && (
              <EmptyState
                title="Không tìm thấy kết quả"
                description="Hãy thử từ khóa khác hoặc chọn phạm vi tìm kiếm rộng hơn."
              />
            )}

            {posts.length > 0 && (
              <section>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-bold text-slate-950">Tin tức</h2>
                  <span className="text-sm font-semibold text-slate-500">{result.posts?.total ?? 0} kết quả</span>
                </div>
                <div className="grid gap-4">
                  {posts.map((post) => {
              const coverUrl = resolvePublicMediaUrl(post.cover_image_url);

                    return (
                      <Link
                        key={post.id}
                        to={`/tin-tuc/${post.slug}`}
                        className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md md:grid-cols-[180px_1fr]"
                      >
                        <div className="h-36 overflow-hidden rounded-xl bg-blue-50">
                          {coverUrl ? (
                            <img src={coverUrl} alt={post.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm font-bold text-blue-700">
                              THPT PCT
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                            Tin tức / {formatDate(post.published_at ?? post.created_at)}
                          </p>
                          <h3 className="mt-2 text-xl font-bold text-slate-950">{post.title}</h3>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                            {post.excerpt ?? 'Xem chi tiết bài viết.'}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {documents.length > 0 && (
              <section>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-bold text-slate-950">Tài liệu</h2>
                  <span className="text-sm font-semibold text-slate-500">{result.documents?.total ?? 0} kết quả</span>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {documents.map((document) => (
                    <Link
                      key={document.id}
                      to={`/tai-lieu/${document.slug}`}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
                    >
                      <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                        {document.category ?? 'Tài liệu'} / {formatDate(document.published_at ?? document.created_at)}
                      </p>
                      <h3 className="mt-2 text-lg font-bold text-slate-950">{document.title}</h3>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                        {document.description ?? 'Xem chi tiết tài liệu.'}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </section>
    </MainLayout>
  );
}
