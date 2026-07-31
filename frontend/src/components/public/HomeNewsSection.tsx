import { Link } from 'react-router-dom';
import { resolvePublicMediaUrl } from '../../lib/media-url';
import type { Post } from '../../types/post';

type HomeNewsSectionProps = {
    posts: Post[];
};

function formatDate(dateString?: string) {
    if (!dateString) return 'Đang cập nhật';

    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    }).format(new Date(dateString));
}

function PostImage({
    src,
    title,
    large = false,
}: {
    src?: string | null;
    title: string;
    large?: boolean;
}) {
    const imageUrl = resolvePublicMediaUrl(src);

    if (imageUrl) {
        return (
            <img
                src={imageUrl}
                alt={title}
                className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
            />
        );
    }

    return (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-slate-950 px-6 text-center">
            <div>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-200">
                    THPT Phan Chu Trinh
                </p>
                <p
                    className={`${large ? 'mt-4 text-2xl' : 'mt-2 text-base'
                        } font-bold text-white`}
                >
                    Tin tức đang được cập nhật
                </p>
            </div>
        </div>
    );
}

export function HomeNewsSection({ posts }: HomeNewsSectionProps) {
    const featuredPost = posts.find((post) => post.cover_image_url) ?? posts[0];
    const sidePosts = posts
        .filter((post) => post.id !== featuredPost?.id)
        .slice(0, 4);

    return (
        <section className="bg-white">
            <div className="mx-auto max-w-7xl px-4 py-14">
                <div className="mb-8 flex flex-col gap-4 border-l-4 border-blue-700 pl-5 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-700">
                            Tin tức
                        </p>
                        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
                            Tin tức & Sự kiện
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            Cập nhật những hoạt động, thông báo và sự kiện mới nhất từ nhà trường.
                        </p>
                    </div>

                    <Link
                        to="/tin-tuc"
                        className="inline-flex w-fit items-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-600 hover:text-blue-700"
                    >
                        Xem tất cả →
                    </Link>
                </div>

                {featuredPost ? (
                    <div className="grid gap-6 lg:grid-cols-[1.45fr_0.9fr]">
                        <Link
                            to={`/tin-tuc/${featuredPost.slug}`}
                            className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg"
                        >
                            <div className="relative h-[380px] overflow-hidden">
                                <PostImage
                                    src={featuredPost.cover_image_url}
                                    title={featuredPost.title}
                                    large
                                />

                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />

                                <span className="absolute bottom-5 left-5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white shadow-lg">
                                    Sự kiện tiêu biểu
                                </span>
                            </div>

                            <div className="p-6">
                                <p className="text-sm font-medium text-slate-500">
                                    {formatDate(featuredPost.published_at ?? featuredPost.created_at)}
                                </p>

                                <h3 className="mt-3 text-2xl font-bold leading-tight text-slate-950 transition group-hover:text-blue-700 md:text-3xl">
                                    {featuredPost.title}
                                </h3>

                                <p className="mt-4 line-clamp-3 text-sm leading-7 text-slate-600 md:text-base">
                                    {featuredPost.excerpt}
                                </p>
                            </div>
                        </Link>

                        <aside className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
                            <div className="mb-4 flex items-center justify-between gap-4 px-1">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">
                                        Thông báo
                                    </p>
                                    <h3 className="mt-1 text-xl font-bold text-slate-950">
                                        Tin mới nhất
                                    </h3>
                                </div>

                                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 shadow-sm">
                                    {sidePosts.length} tin
                                </span>
                            </div>

                            <div className="grid gap-3">
                                {sidePosts.length > 0 ? (
                                    sidePosts.map((post, index) => (
                                        <Link
                                            key={post.id}
                                            to={`/tin-tuc/${post.slug}`}
                                            className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-md"
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-sm font-extrabold text-blue-700 transition group-hover:bg-blue-100">
                                                    {String(index + 1).padStart(2, '0')}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">
                                                        Thông báo
                                                    </p>

                                                    <h4 className="mt-2 line-clamp-2 text-base font-bold leading-6 text-slate-950 transition group-hover:text-blue-700">
                                                        {post.title}
                                                    </h4>

                                                    <p className="mt-2 text-xs font-medium text-slate-500">
                                                        {formatDate(post.published_at ?? post.created_at)}
                                                    </p>

                                                    {post.excerpt && (
                                                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                                                            {post.excerpt}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </Link>
                                    ))
                                ) : (
                                    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center">
                                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                                            <svg
                                                viewBox="0 0 24 24"
                                                className="h-7 w-7"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.8"
                                            >
                                                <path d="M4 5h16v14H4z" />
                                                <path d="M8 9h8M8 13h5" />
                                            </svg>
                                        </div>

                                        <p className="mt-4 text-sm font-semibold text-slate-900">
                                            Chưa có thông báo mới
                                        </p>

                                        <p className="mt-2 text-sm leading-6 text-slate-500">
                                            Các tin vắn mới nhất sẽ được cập nhật tại đây.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </aside>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
                        Chưa có bài viết published.
                    </div>
                )}
            </div>
        </section>
    );
}
