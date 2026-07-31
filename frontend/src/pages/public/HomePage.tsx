import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { MainLayout } from '../../components/layout/MainLayout';
import { EmptyState } from '../../components/public/EmptyState';
import { HeroSection } from '../../components/public/HeroSection';
import { HomeNewsSection } from '../../components/public/HomeNewsSection';
import { HomeResourcesSection } from '../../components/public/HomeResourcesSection';
import { HomeEventsSection } from '../../components/public/HomeEventsSection';
import { SchoolLifeSection } from '../../components/public/SchoolLifeSection';
import { SectionHeading } from '../../components/public/SectionHeading';
import { Seo } from '../../components/public/Seo';
import { FadeInSection } from '../../components/ui/FadeInSection';

import { getCategories } from '../../services/category.service';
import { getDocuments } from '../../services/document.service';
import { getPosts } from '../../services/post.service';
import { getEvents } from '../../services/event.service';

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
    () =>
      new Map(categories.map((category) => [category.id, category.slug])),
    [categories],
  );

  const admissionsPosts = posts
    .filter(
      (post) =>
        post.category_id &&
        categorySlugById.get(post.category_id)?.includes('tuyen-sinh'),
    )
    .slice(0, 3);

  const activityPosts = posts
    .filter(
      (post) =>
        post.category_id &&
        categorySlugById.get(post.category_id)?.includes('hoat-dong'),
    )
    .slice(0, 4);

  const featuredCategories = categories.slice(0, 6);

  return (
    <MainLayout>
      <Seo canonicalPath="/" />
      <HeroSection />

      {!isLoading && !hasError && (
        <FadeInSection>
          <HomeNewsSection posts={posts} />
        </FadeInSection>
      )}

      {hasError && (
        <FadeInSection>
          <section className="mx-auto max-w-7xl px-4 py-10">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
              Khong the tai du lieu tu backend. Vui long kiem tra API server.
            </div>
          </section>
        </FadeInSection>
      )}

      {isLoading && (
        <FadeInSection>
          <section className="mx-auto max-w-7xl px-4 py-10">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
              Dang tai du lieu...
            </div>
          </section>
        </FadeInSection>
      )}

      {!isLoading && !hasError && (
        <FadeInSection delay={0.05}>
          <HomeResourcesSection
            admissionsPosts={admissionsPosts}
            documents={documents}
          />
        </FadeInSection>
      )}

      {!isLoading && !hasError && (
        <FadeInSection delay={0.07}>
          <HomeEventsSection events={events} />
        </FadeInSection>
      )}

      {!isLoading && !hasError && (
        <FadeInSection delay={0.08}>
          <SchoolLifeSection
            posts={activityPosts.length > 0 ? activityPosts : posts.slice(0, 4)}
          />
        </FadeInSection>
      )}

      <FadeInSection delay={0.1}>
        <section className="mx-auto max-w-7xl px-4 py-14">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <SectionHeading
              eyebrow="Danh muc"
              title="Kenh thong tin noi bat"
              description="Truy cap nhanh theo nhom noi dung dang duoc nha truong cong bo."
            />

            <div className="mt-8 flex flex-wrap gap-3">
              {featuredCategories.length > 0 ? (
                featuredCategories.map((category) => (
                  <a
                    key={category.id}
                    href={`/danh-muc/${category.slug}`}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition-all duration-200 hover:border-blue-600 hover:bg-blue-50 hover:text-blue-700"
                  >
                    {category.name}
                  </a>
                ))
              ) : (
                <EmptyState
                  title="Chua co danh muc"
                  description="Danh muc public se hien thi sau khi admin tao va kich hoat."
                />
              )}
            </div>
          </div>
        </section>
      </FadeInSection>
    </MainLayout>
  );
}
