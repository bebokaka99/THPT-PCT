import { Link } from 'react-router-dom';

import type { Post } from '../../types/post';

type SchoolLifeSectionProps = {
    posts: Post[];
};

function formatDate(dateString?: string) {
    if (!dateString) return '';

    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(new Date(dateString));
}

function ActivityImage({
    src,
    title,
}: {
    src?: string | null;
    title: string;
}) {
    if (src) {
        return (
            <img
                src={src}
                alt={title}
                className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
            />
        );
    }

    return (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-slate-950">
            <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-200">
                    SCHOOL LIFE
                </p>

                <p className="mt-4 text-xl font-bold text-white">
                    THPT Phan Chu Trinh
                </p>
            </div>
        </div>
    );
}

export function SchoolLifeSection({
    posts,
}: SchoolLifeSectionProps) {
    const featuredPost = posts[0];
    const smallPosts = posts.slice(1, 4);

    if (!featuredPost) {
        return null;
    }

    return (
        <section className="bg-white">
            <div className="mx-auto max-w-7xl px-4 py-14">
                <div className="mb-8 flex flex-col gap-4 border-l-4 border-blue-700 pl-5 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-700">
                            School Life
                        </p>

                        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
                            Đời sống học đường
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            Những hoạt động nổi bật và khoảnh khắc đáng nhớ tại trường.
                        </p>
                    </div>

                    <Link
                        to="/danh-muc/hoat-dong"
                        className="inline-flex w-fit items-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-600 hover:text-blue-700"
                    >
                        Xem hoạt động →
                    </Link>
                </div>

                <div className="grid gap-5 lg:grid-cols-[1.45fr_0.75fr]">
                    {/* BIG FEATURE */}
                    <Link
                        to={`/tin-tuc/${featuredPost.slug}`}
                        className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-xl"
                    >
                        <div className="relative h-[520px] overflow-hidden">
                            <ActivityImage
                                src={featuredPost.cover_image_url}
                                title={featuredPost.title}
                            />

                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />

                            <div className="absolute bottom-0 left-0 w-full p-7">
                                <div className="inline-flex items-center rounded-full bg-blue-700/90 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white backdrop-blur">
                                    Hoạt động nổi bật
                                </div>

                                <p className="mt-5 text-sm font-medium text-slate-200">
                                    {formatDate(
                                        featuredPost.published_at ??
                                        featuredPost.created_at,
                                    )}
                                </p>

                                <h3 className="mt-3 max-w-2xl text-3xl font-bold leading-tight text-white transition group-hover:text-blue-200 md:text-4xl">
                                    {featuredPost.title}
                                </h3>

                                <p className="mt-4 max-w-2xl line-clamp-2 text-sm leading-7 text-slate-200 md:text-base">
                                    {featuredPost.excerpt}
                                </p>
                            </div>
                        </div>
                    </Link>

                    {/* SMALL POSTS */}
                    <div className="grid gap-5">
                        {smallPosts.map((post) => (
                            <Link
                                key={post.id}
                                to={`/tin-tuc/${post.slug}`}
                                className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg"
                            >
                                <div className="grid h-full md:grid-cols-[160px_1fr]">
                                    <div className="relative h-52 overflow-hidden md:h-full">
                                        <ActivityImage
                                            src={post.cover_image_url}
                                            title={post.title}
                                        />

                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/30 to-transparent" />
                                    </div>

                                    <div className="flex flex-col justify-center p-5">
                                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">
                                            Hoạt động
                                        </p>

                                        <h4 className="mt-3 line-clamp-2 text-lg font-bold leading-7 text-slate-950 transition group-hover:text-blue-700">
                                            {post.title}
                                        </h4>

                                        <p className="mt-3 text-xs font-medium text-slate-500">
                                            {formatDate(
                                                post.published_at ??
                                                post.created_at,
                                            )}
                                        </p>

                                        <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">
                                            {post.excerpt}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}