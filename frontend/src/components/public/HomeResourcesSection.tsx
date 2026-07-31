import { Link } from 'react-router-dom';

import type { SchoolDocument } from '../../types/document';
import type { Post } from '../../types/post';

type HomeResourcesSectionProps = {
    admissionsPosts: Post[];
    documents: SchoolDocument[];
};

function formatDate(dateString?: string) {
    if (!dateString) return 'Đang cập nhật';

    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(new Date(dateString));
}

function getDocumentBadge(url?: string | null) {
    if (!url) return 'FILE';

    const lower = url.toLowerCase();

    if (lower.includes('.pdf')) return 'PDF';
    if (lower.includes('.doc') || lower.includes('.docx')) return 'DOC';
    if (lower.includes('.xls') || lower.includes('.xlsx')) return 'XLS';

    return 'FILE';
}

export function HomeResourcesSection({
    admissionsPosts,
    documents,
}: HomeResourcesSectionProps) {
    const featuredAdmission = admissionsPosts[0];
    const sideAdmissions = admissionsPosts.slice(1, 3);

    return (
        <section className="bg-slate-50">
            <div className="mx-auto max-w-7xl px-4 py-14">
                <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                    {/* TUYỂN SINH */}
                    <div>
                        <div className="mb-7 flex items-end justify-between gap-4 border-l-4 border-blue-700 pl-5">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-700">
                                    Tuyển sinh
                                </p>

                                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                                    Thông tin tuyển sinh
                                </h2>

                                <p className="mt-2 text-sm leading-6 text-slate-500">
                                    Hướng dẫn, thông báo và các mốc thời gian quan trọng.
                                </p>
                            </div>

                            <Link
                                to="/danh-muc/tuyen-sinh"
                                className="hidden rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-600 hover:text-blue-700 md:inline-flex"
                            >
                                Xem tất cả →
                            </Link>
                        </div>

                        {featuredAdmission ? (
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                <Link
                                    to={`/tin-tuc/${featuredAdmission.slug}`}
                                    className="group block"
                                >
                                    <div className="relative h-[280px] overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-slate-950">
                                        {featuredAdmission.cover_image_url ? (
                                            <img
                                                src={featuredAdmission.cover_image_url}
                                                alt={featuredAdmission.title}
                                                className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="flex h-full items-center justify-center text-center">
                                                <div>
                                                    <p className="text-sm font-bold uppercase tracking-[0.28em] text-blue-200">
                                                        TUYỂN SINH
                                                    </p>

                                                    <p className="mt-4 text-2xl font-bold text-white">
                                                        THPT Phan Chu Trinh
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />

                                        <span className="absolute bottom-5 left-5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">
                                            Tuyển sinh
                                        </span>
                                    </div>

                                    <div className="p-6">
                                        <p className="text-sm font-medium text-slate-500">
                                            {formatDate(
                                                featuredAdmission.published_at ??
                                                featuredAdmission.created_at,
                                            )}
                                        </p>

                                        <h3 className="mt-3 text-2xl font-bold leading-tight text-slate-950 transition group-hover:text-blue-700">
                                            {featuredAdmission.title}
                                        </h3>

                                        <p className="mt-4 line-clamp-3 text-sm leading-7 text-slate-600">
                                            {featuredAdmission.excerpt}
                                        </p>
                                    </div>
                                </Link>

                                {sideAdmissions.length > 0 && (
                                    <div className="border-t border-slate-200">
                                        {sideAdmissions.map((post) => (
                                            <Link
                                                key={post.id}
                                                to={`/tin-tuc/${post.slug}`}
                                                className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-blue-50/40"
                                            >
                                                <div className="min-w-0">
                                                    <h4 className="truncate text-sm font-semibold text-slate-900">
                                                        {post.title}
                                                    </h4>

                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {formatDate(
                                                            post.published_at ?? post.created_at,
                                                        )}
                                                    </p>
                                                </div>

                                                <span className="text-sm font-bold text-blue-700">
                                                    →
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
                                Chưa có thông tin tuyển sinh.
                            </div>
                        )}
                    </div>

                    {/* DOCUMENTS */}
                    <div>
                        <div className="mb-7 flex items-end justify-between gap-4 border-l-4 border-blue-700 pl-5">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-700">
                                    Tài liệu
                                </p>

                                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                                    Văn bản mới
                                </h2>

                                <p className="mt-2 text-sm leading-6 text-slate-500">
                                    Tài liệu và biểu mẫu mới nhất từ nhà trường.
                                </p>
                            </div>

                            <Link
                                to="/tai-lieu"
                                className="hidden rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-600 hover:text-blue-700 md:inline-flex"
                            >
                                Xem thêm →
                            </Link>
                        </div>

                        <div className="space-y-4">
                            {documents.length > 0 ? (
                                documents.slice(0, 5).map((document) => (
                                    <div
                                        key={document.id}
                                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-sm font-bold text-blue-700">
                                                {getDocumentBadge(document.document_url)}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                                                    Tài liệu
                                                </p>

                                                <h3 className="mt-2 line-clamp-2 text-base font-bold leading-6 text-slate-950">
                                                    {document.title}
                                                </h3>

                                                <p className="mt-2 text-xs text-slate-500">
                                                    {formatDate(
                                                        document.published_at ??
                                                        document.created_at,
                                                    )}
                                                </p>

                                                {document.description && (
                                                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                                                        {document.description}
                                                    </p>
                                                )}

                                                <div className="mt-4 flex flex-wrap gap-3">
                                                    <a
                                                        href={document.document_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-600"
                                                    >
                                                        Mở tài liệu
                                                    </a>

                                                    <Link
                                                        to={`/tai-lieu/${document.slug}`}
                                                        className="inline-flex items-center rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-600 hover:text-blue-700"
                                                    >
                                                        Chi tiết
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
                                    Chưa có tài liệu mới.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}