import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, FileText, GraduationCap, Newspaper } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MainLayout } from '../../components/layout/MainLayout';
import { EmptyState } from '../../components/public/EmptyState';
import { HeroSection } from '../../components/public/HeroSection';
import { HomeEventsSection } from '../../components/public/HomeEventsSection';
import { HomeNewsSection } from '../../components/public/HomeNewsSection';
import { HomeResourcesSection } from '../../components/public/HomeResourcesSection';
import { SchoolLifeSection } from '../../components/public/SchoolLifeSection';
import { SectionHeading } from '../../components/public/SectionHeading';
import { Seo } from '../../components/public/Seo';
import { FadeInSection } from '../../components/ui/FadeInSection';
import { getCategories } from '../../services/category.service';
import { getDocuments } from '../../services/document.service';
import { getEvents } from '../../services/event.service';
import { getPosts } from '../../services/post.service';

const quickLinks = [
  { icon: Newspaper, label: 'Tin tức', description: 'Thông báo và hoạt động mới', to: '/tin-tuc' },
  { icon: FileText, label: 'Tài liệu', description: 'Văn bản và biểu mẫu', to: '/tai-lieu' },
  { icon: GraduationCap, label: 'Tuyển sinh', description: 'Hướng dẫn và mốc thời gian', to: '/danh-muc/tuyen-sinh' },
  { icon: CalendarDays, label: 'Sự kiện', description: 'Lịch hoạt động nhà trường', to: '/su-kien' },
];

export function HomePage() {
  const postsQuery = useQuery({
    queryKey: ['public', 'home', 'posts'],
    queryFn: () => getPosts({ page: 1, limit: 10 }),
  });
  const categoriesQuery = useQuery({
    queryKey: ['public', 'categories'],
    queryFn: getCategories,
  });
  const documentsQuery = useQuery({
    queryKey: ['public', 'home', 'documents'],
    queryFn: () => getDocuments({ page: 1, limit: 5 }),
  });
  const eventsQuery = useQuery({
    queryKey: ['public', 'home', 'events'],
    queryFn: () => getEvents({ scope: 'upcoming', page: 1, limit: 3 }),
  });

  const posts = postsQuery.data?.data ?? [];
  const categories = categoriesQuery.data?.data ?? [];
  const documents = documentsQuery.data?.data ?? [];
  const events = eventsQuery.data?.data ?? [];
  const isLoading =
    postsQuery.isLoading ||
    categoriesQuery.isLoading ||
    documentsQuery.isLoading ||
    eventsQuery.isLoading;
  const hasError =
    postsQuery.isError ||
    categoriesQuery.isError ||
    documentsQuery.isError ||
    eventsQuery.isError;

  const categorySlugById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.slug])),
    [categories],
  );

  const admissionsPosts = posts
    .filter((post) => post.category_id && categorySlugById.get(post.category_id)?.includes('tuyen-sinh'))
    .slice(0, 3);
  const activityPosts = posts
    .filter((post) => post.category_id && categorySlugById.get(post.category_id)?.includes('hoat-dong'))
    .slice(0, 4);
  const featuredCategories = categories.slice(0, 6);

  return (
    <MainLayout>
      <Seo canonicalPath="/" />
      <HeroSection />

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-slate-200 px-4 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          {quickLinks.map(({ description, icon: Icon, label, to }) => (
            <Link
              key={to}
              to={to}
              className="group flex min-h-32 items-center gap-4 px-4 py-6 transition hover:bg-blue-50/60 lg:px-6"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-blue-50 text-blue-700 transition group-hover:bg-blue-700 group-hover:text-white">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-extrabold text-slate-950 group-hover:text-blue-700">
                  {label}
                  <ArrowRight className="h-4 w-4" />
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {isLoading && (
        <section className="mx-auto max-w-7xl px-4 py-12">
          <div className="border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Đang tải dữ liệu từ nhà trường...
          </div>
        </section>
      )}

      {hasError && (
        <section className="mx-auto max-w-7xl px-4 py-12">
          <div className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            Không thể tải dữ liệu. Vui lòng kiểm tra kết nối tới API và thử lại.
          </div>
        </section>
      )}

      {!isLoading && !hasError && (
        <>
          <FadeInSection><HomeNewsSection posts={posts} /></FadeInSection>
          <FadeInSection delay={0.05}>
            <HomeResourcesSection admissionsPosts={admissionsPosts} documents={documents} />
          </FadeInSection>
          <FadeInSection delay={0.07}><HomeEventsSection events={events} /></FadeInSection>
          <FadeInSection delay={0.08}>
            <SchoolLifeSection posts={activityPosts.length > 0 ? activityPosts : posts.slice(0, 4)} />
          </FadeInSection>
        </>
      )}

      <FadeInSection delay={0.1}>
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 md:py-16">
            <SectionHeading
              eyebrow="Chuyên mục"
              title="Kênh thông tin theo chủ đề"
              description="Truy cập nhanh các nhóm nội dung đang được nhà trường công bố."
            />
            {featuredCategories.length > 0 ? (
              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {featuredCategories.map((category) => (
                  <Link
                    key={category.id}
                    to={`/danh-muc/${category.slug}`}
                    className="group flex min-h-20 items-center justify-between border border-slate-200 bg-slate-50 px-5 py-4 font-bold text-slate-800 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <span className="line-clamp-2">{category.name}</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-8">
                <EmptyState
                  title="Chưa có danh mục"
                  description="Danh mục sẽ hiển thị sau khi được quản trị viên tạo và kích hoạt."
                />
              </div>
            )}
          </div>
        </section>
      </FadeInSection>
    </MainLayout>
  );
}
