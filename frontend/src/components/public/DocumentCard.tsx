import { Link } from 'react-router-dom';
import { resolvePublicMediaUrl } from '../../lib/media-url';
import type { SchoolDocument } from '../../types/document';

type DocumentCardProps = {
  document: SchoolDocument;
};

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(value))
    : 'Chưa xuất bản';
}

function formatFileSize(value: number) {
  if (!value) {
    return '-';
  }

  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentCard({ document }: DocumentCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-amber-50 text-sm font-bold uppercase text-amber-700">
          {document.file_type?.split('/').pop()?.slice(0, 3) ?? 'doc'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-700">
            <span>{document.category ?? 'Tài liệu'}</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500">{formatDate(document.published_at)}</span>
          </div>
          <Link to={`/tai-lieu/${document.slug}`} className="mt-2 block line-clamp-2 font-bold text-slate-950 hover:text-blue-700">
            {document.title}
          </Link>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{document.description ?? 'Tài liệu công khai của nhà trường.'}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">{formatFileSize(document.file_size)}</span>
            <Link to={`/tai-lieu/${document.slug}`} className="rounded border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:border-blue-600 hover:text-blue-700">
              Xem
            </Link>
            <a href={resolvePublicMediaUrl(document.document_url)} download className="rounded bg-blue-700 px-3 py-1.5 font-semibold text-white hover:bg-blue-800">
              Tải file
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
