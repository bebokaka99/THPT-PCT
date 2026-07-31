import { ArrowRight, Download, FileText, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { resolvePublicMediaUrl } from '../../lib/media-url';
import type { SchoolDocument } from '../../types/document';
import type { Post } from '../../types/post';
import { SectionHeading } from './SectionHeading';

type HomeResourcesSectionProps = {
  admissionsPosts: Post[];
  documents: SchoolDocument[];
};

function formatDate(value?: string | null) {
  if (!value) return 'Đang cập nhật';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function getFileLabel(document: SchoolDocument) {
  const source = `${document.file_type ?? ''} ${document.document_url}`.toLowerCase();
  if (source.includes('pdf')) return 'PDF';
  if (source.includes('doc')) return 'DOC';
  if (source.includes('xls')) return 'XLS';
  return 'FILE';
}

export function HomeResourcesSection({
  admissionsPosts,
  documents,
}: HomeResourcesSectionProps) {
  const admissions = admissionsPosts.slice(0, 3);
  const visibleDocuments = documents.slice(0, 4);

  return (
    <section className="border-y border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-7xl items-start gap-10 px-4 py-14 md:py-16 lg:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow="Dành cho học sinh"
            title="Thông tin tuyển sinh"
            description="Mốc thời gian, hướng dẫn và thông báo tuyển sinh được nhà trường công bố."
            actionLabel="Xem thông tin tuyển sinh"
            actionTo="/danh-muc/tuyen-sinh"
          />

          <div className="mt-7 border border-slate-200 bg-white">
            {admissions.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {admissions.map((post, index) => (
                  <Link
                    key={post.id}
                    to={`/tin-tuc/${post.slug}`}
                    className="group grid min-h-32 grid-cols-[52px_minmax(0,1fr)] gap-4 p-5 transition hover:bg-blue-50/50"
                  >
                    <span className="flex h-12 w-12 items-center justify-center bg-blue-50 text-blue-700">
                      {index === 0 ? (
                        <GraduationCap className="h-6 w-6" />
                      ) : (
                        <span className="text-sm font-extrabold">0{index + 1}</span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="text-xs font-semibold text-slate-500">
                        {formatDate(post.published_at ?? post.created_at)}
                      </span>
                      <span className="mt-2 line-clamp-2 block font-bold leading-6 text-slate-950 transition group-hover:text-blue-700">
                        {post.title}
                      </span>
                      {post.excerpt && (
                        <span className="mt-2 line-clamp-1 block text-sm text-slate-600">
                          {post.excerpt}
                        </span>
                      )}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                Chưa có thông tin tuyển sinh mới.
              </div>
            )}
          </div>
        </div>

        <div>
          <SectionHeading
            eyebrow="Tra cứu"
            title="Tài liệu mới"
            description="Văn bản, biểu mẫu và tài liệu công khai mới nhất của nhà trường."
            actionLabel="Xem kho tài liệu"
            actionTo="/tai-lieu"
          />

          <div className="mt-7 divide-y divide-slate-200 border border-slate-200 bg-white">
            {visibleDocuments.length > 0 ? (
              visibleDocuments.map((document) => (
                <article key={document.id} className="flex min-h-28 gap-4 p-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-amber-50 text-xs font-extrabold text-amber-700">
                    {getFileLabel(document)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-500">
                      {formatDate(document.published_at ?? document.created_at)}
                    </p>
                    <Link
                      to={`/tai-lieu/${document.slug}`}
                      className="mt-1 line-clamp-2 block font-bold leading-6 text-slate-950 hover:text-blue-700"
                    >
                      {document.title}
                    </Link>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs font-bold">
                      <Link to={`/tai-lieu/${document.slug}`} className="inline-flex items-center gap-1.5 text-blue-700">
                        <FileText className="h-3.5 w-3.5" />
                        Chi tiết
                      </Link>
                      <a
                        href={resolvePublicMediaUrl(document.document_url)}
                        download
                        className="inline-flex items-center gap-1.5 text-slate-600 hover:text-blue-700"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Tải tệp
                      </a>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                Chưa có tài liệu mới.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
