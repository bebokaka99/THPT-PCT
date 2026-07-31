import { Download, ExternalLink, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { resolvePublicMediaUrl } from '../../lib/media-url';
import type { SchoolDocument } from '../../types/document';

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(value))
    : 'Đang cập nhật';
}

function formatFileSize(value: number) {
  if (!value) return 'Chưa rõ dung lượng';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function fileLabel(document: SchoolDocument) {
  const value = `${document.file_type ?? ''} ${document.document_url}`.toLowerCase();
  if (value.includes('pdf')) return 'PDF';
  if (value.includes('doc')) return 'DOC';
  if (value.includes('xls')) return 'XLS';
  return 'FILE';
}

export function DocumentCard({ document }: { document: SchoolDocument }) {
  return (
    <article className="flex h-full gap-4 border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md">
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center bg-amber-50 text-amber-700">
        <FileText className="h-5 w-5" />
        <span className="mt-1 text-[10px] font-extrabold">{fileLabel(document)}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
          <span className="text-blue-700">{document.category ?? 'Tài liệu'}</span>
          <span className="text-slate-500">{formatDate(document.published_at ?? document.created_at)}</span>
        </div>
        <Link to={`/tai-lieu/${document.slug}`}>
          <h3 className="mt-2 line-clamp-2 font-extrabold leading-6 text-slate-950 hover:text-blue-700">
            {document.title}
          </h3>
        </Link>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
          {document.description ?? 'Tài liệu do nhà trường công bố.'}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-4 text-xs font-bold">
          <span className="text-slate-500">{formatFileSize(document.file_size)}</span>
          <Link to={`/tai-lieu/${document.slug}`} className="inline-flex items-center gap-1.5 text-blue-700">
            <ExternalLink className="h-3.5 w-3.5" />
            Chi tiết
          </Link>
          <a
            href={resolvePublicMediaUrl(document.document_url)}
            download
            className="inline-flex items-center gap-1.5 text-slate-700 hover:text-blue-700"
          >
            <Download className="h-3.5 w-3.5" />
            Tải tệp
          </a>
        </div>
      </div>
    </article>
  );
}
