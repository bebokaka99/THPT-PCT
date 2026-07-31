import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MainLayout } from '../../components/layout/MainLayout';
import { Seo } from '../../components/public/Seo';
import { resolvePublicMediaUrl } from '../../lib/media-url';
import { getDocumentBySlug } from '../../services/document.service';
import type { SchoolDocument } from '../../types/document';

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(value))
    : '-';
}

function formatFileSize(value: number) {
  if (!value) {
    return '-';
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

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
      if (!slug) {
        return;
      }

      try {
        setIsLoading(true);
        const response = await getDocumentBySlug(slug);

        if (isMounted) {
          setDocument(response);
          setError(null);
        }
      } catch {
        if (isMounted) {
          setError('Không tìm thấy tài liệu.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadDocument();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  return (
    <MainLayout>
      <Seo
        title={document?.title ?? 'Tài liệu'}
        description={document?.description}
        canonicalPath={slug ? `/tai-lieu/${slug}` : '/tai-lieu'}
        type="article"
        publishedTime={document?.published_at}
      />
      <section className="mx-auto max-w-4xl px-4 py-10">
        <Link to="/tai-lieu" className="text-sm font-semibold text-blue-700">
          Quay lại tài liệu
        </Link>

        {isLoading && <p className="mt-6 text-slate-600">Đang tải tài liệu...</p>}
        {error && <p className="mt-6 rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}

        {!isLoading && !error && document && (
          <article className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase text-blue-700">
              <span>{document.category ?? 'Tài liệu'}</span>
              <span className="text-slate-400">/</span>
              <span className="text-slate-500">{formatDate(document.published_at)}</span>
            </div>
            <h2 className="mt-3 text-3xl font-bold text-slate-950">{document.title}</h2>
            {document.description && <p className="mt-4 leading-7 text-slate-700">{document.description}</p>}

            <div className="mt-6 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-3">
              <p>
                <span className="font-semibold">Loại file:</span> {document.file_type ?? '-'}
              </p>
              <p>
                <span className="font-semibold">Dung lượng:</span> {formatFileSize(document.file_size)}
              </p>
              <p>
                <span className="font-semibold">Người tải:</span> {document.uploaded_by ?? '-'}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={resolvePublicMediaUrl(document.document_url)}
                target="_blank"
                rel="noreferrer"
                className="rounded border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                Mở file
              </a>
              <a
                href={resolvePublicMediaUrl(document.document_url)}
                download
                className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Tải file
              </a>
            </div>
          </article>
        )}
      </section>
    </MainLayout>
  );
}
