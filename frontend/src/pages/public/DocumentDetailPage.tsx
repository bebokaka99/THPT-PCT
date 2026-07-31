import { Download, ExternalLink, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MainLayout } from '../../components/layout/MainLayout';
import { Seo } from '../../components/public/Seo';
import { resolvePublicMediaUrl } from '../../lib/media-url';
import { getDocumentBySlug } from '../../services/document.service';
import type { SchoolDocument } from '../../types/document';

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)) : 'Đang cập nhật';
}

function formatFileSize(value: number) {
  if (!value) return 'Chưa rõ';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentDetailPage() {
  const { slug } = useParams();
  const [document, setDocument] = useState<SchoolDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadDocument() {
      if (!slug) { setError('Thiếu đường dẫn tài liệu.'); setIsLoading(false); return; }
      try {
        setIsLoading(true);
        const response = await getDocumentBySlug(slug);
        if (isMounted) { setDocument(response); setError(null); }
      } catch {
        if (isMounted) setError('Không tìm thấy tài liệu hoặc tài liệu chưa được công bố.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void loadDocument();
    return () => { isMounted = false; };
  }, [slug]);

  const fileUrl = resolvePublicMediaUrl(document?.document_url);

  return (
    <MainLayout>
      <Seo title={document?.title ?? 'Tài liệu'} description={document?.description} canonicalPath={slug ? `/tai-lieu/${slug}` : '/tai-lieu'} type="article" publishedTime={document?.published_at} />
      <section className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <Link to="/tai-lieu" className="text-sm font-bold text-blue-700">← Quay lại tài liệu</Link>
        {isLoading && <div className="mt-6 border border-slate-200 bg-white p-6 text-sm text-slate-600">Đang tải tài liệu...</div>}
        {error && <div className="mt-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>}
        {!isLoading && !error && document && (
          <article className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_260px]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">{document.category ?? 'Tài liệu'}</p>
              <h1 className="mt-4 text-3xl font-extrabold leading-tight text-slate-950 md:text-4xl">{document.title}</h1>
              {document.description && <p className="mt-5 whitespace-pre-wrap text-base leading-8 text-slate-700">{document.description}</p>}
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-blue-200 px-5 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50"><ExternalLink className="h-4 w-4" />Mở tài liệu</a>
                <a href={fileUrl} download className="inline-flex items-center gap-2 bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800"><Download className="h-4 w-4" />Tải tài liệu</a>
              </div>
            </div>
            <aside className="border border-slate-200 bg-slate-50 p-5">
              <FileText className="h-8 w-8 text-blue-700" />
              <h2 className="mt-4 font-extrabold text-slate-950">Thông tin tệp</h2>
              <dl className="mt-5 grid gap-4 text-sm">
                <div><dt className="text-slate-500">Ngày công bố</dt><dd className="mt-1 font-semibold text-slate-900">{formatDate(document.published_at ?? document.created_at)}</dd></div>
                <div><dt className="text-slate-500">Loại tệp</dt><dd className="mt-1 break-all font-semibold text-slate-900">{document.file_type ?? 'Không xác định'}</dd></div>
                <div><dt className="text-slate-500">Dung lượng</dt><dd className="mt-1 font-semibold text-slate-900">{formatFileSize(document.file_size)}</dd></div>
              </dl>
            </aside>
          </article>
        )}
      </section>
    </MainLayout>
  );
}
