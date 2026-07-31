import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  ChevronRight,
  ClipboardList,
  FileText,
  Megaphone,
  School,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { TeacherPortalLayout } from '../../components/layout/TeacherPortalLayout';
import {
  getClassroomDocuments,
  getClassroomPosts,
  getClassrooms,
} from '../../services/classroom.service';
import { getUnreadNotificationCount } from '../../services/notification.service';
import { getAssignments } from '../../services/assignment.service';
import { getMyProfile } from '../../services/profile.service';
import { useAuth } from '../../stores/auth-context';
import type {
  Classroom,
  ClassroomDocument,
  ClassroomPost,
} from '../../types/classroom';
import type { MyProfile, TeacherProfile } from '../../types/profile';

type TeacherPost = ClassroomPost & { classroomName: string };
type TeacherDocument = ClassroomDocument & { classroomName: string };

function isTeacherProfile(value: MyProfile['profile']): value is TeacherProfile {
  return Boolean(value && 'teacher_code' in value);
}

function itemDate(item: { published_at: string | null; created_at: string }) {
  return new Date(item.published_at || item.created_at).getTime();
}

function formatDate(value?: string | null) {
  if (!value) return 'Chưa xuất bản';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(
    new Date(value),
  );
}

async function loadDashboard(token: string, userId: number) {
  const [classroomResponse, profile, unread, assignments] = await Promise.all([
    getClassrooms(token, { page: 1, limit: 50 }),
    getMyProfile(token),
    getUnreadNotificationCount(token).catch(() => ({ count: 0 })),
    getAssignments(token, { page: 1, limit: 100 }).catch(() => ({ data: [] })),
  ]);
  const classroomContents = await Promise.all(
    classroomResponse.data.map(async (classroom) => {
      const [posts, documents] = await Promise.all([
        getClassroomPosts(token, classroom.id).catch(() => ({ data: [] })),
        getClassroomDocuments(token, classroom.id).catch(() => ({ data: [] })),
      ]);
      return { classroom, posts: posts.data, documents: documents.data };
    }),
  );

  const posts = classroomContents
    .flatMap(({ classroom, posts: items }) =>
      items
        .filter((item) => item.author_user_id === userId)
        .map((item) => ({ ...item, classroomName: classroom.name })),
    )
    .sort((a, b) => itemDate(b) - itemDate(a));
  const documents = classroomContents
    .flatMap(({ classroom, documents: items }) =>
      items
        .filter((item) => item.author_user_id === userId)
        .map((item) => ({ ...item, classroomName: classroom.name })),
    )
    .sort((a, b) => itemDate(b) - itemDate(a));

  return {
    classrooms: classroomResponse.data,
    documents,
    posts,
    profile,
    unreadCount: unread.count,
    assignments: assignments.data,
  };
}

function StatCard({
  accent,
  icon: Icon,
  label,
  value,
}: {
  accent: string;
  icon: typeof School;
  label: string;
  value: number;
}) {
  return (
    <div className="border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-2xl font-bold text-slate-950">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{label}</p>
        </div>
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-md ${accent}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

function statusLabel(status: string) {
  if (status === 'published') return 'Đã đăng';
  if (status === 'archived') return 'Lưu trữ';
  return 'Bản nháp';
}

function LatestContent({
  documents,
  posts,
}: {
  documents: TeacherDocument[];
  posts: TeacherPost[];
}) {
  const items = [
    ...posts.map((item) => ({ ...item, kind: 'post' as const })),
    ...documents.map((item) => ({ ...item, kind: 'document' as const })),
  ]
    .sort((a, b) => itemDate(b) - itemDate(a))
    .slice(0, 6);

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-bold text-slate-950">Nội dung gần đây</h2>
          <p className="mt-1 text-sm text-slate-500">Thông báo và tài liệu do thầy/cô tạo.</p>
        </div>
        <Megaphone className="h-5 w-5 text-emerald-700" />
      </div>
      <div className="divide-y divide-slate-100">
        {items.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            Chưa có nội dung lớp học.
          </p>
        )}
        {items.map((item) => (
          <Link
            key={`${item.kind}-${item.id}`}
            to={`/teacher/classes/${item.classroom_id}?tab=${
              item.kind === 'post' ? 'posts' : 'documents'
            }`}
            className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-slate-50"
          >
            <div className="flex min-w-0 gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                {item.kind === 'post' ? (
                  <Megaphone className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0">
                <p className="line-clamp-1 font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.classroomName} · {statusLabel(item.status)} ·{' '}
                  {formatDate(item.published_at || item.created_at)}
                </p>
              </div>
            </div>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function TeacherDashboardPage() {
  const { accessToken, user } = useAuth();
  const dashboardQuery = useQuery({
    queryKey: ['teacher', 'dashboard', user?.id],
    queryFn: () => loadDashboard(accessToken!, user!.id),
    enabled: Boolean(accessToken && user),
  });
  const data = dashboardQuery.data;
  const currentProfile = data?.profile.profile ?? null;
  const teacherProfile = isTeacherProfile(currentProfile) ? currentProfile : null;
  const draftCount =
    (data?.posts.filter((item) => item.status === 'draft').length ?? 0) +
    (data?.documents.filter((item) => item.status === 'draft').length ?? 0);

  return (
    <TeacherPortalLayout>
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Tổng quan giảng dạy</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
            Xin chào, {user?.fullName || 'giáo viên'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {teacherProfile?.department
              ? `${teacherProfile.department}${
                  teacherProfile.teacher_code
                    ? ` · Mã giáo viên ${teacherProfile.teacher_code}`
                    : ''
                }`
              : 'Quản lý lớp, thông báo và tài liệu giảng dạy tại đây.'}
          </p>
        </div>
        <Link
          to="/teacher/classes"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <School className="h-4 w-4" />
          Mở lớp phụ trách
        </Link>
      </header>

      {dashboardQuery.isLoading && (
        <p className="mt-6 border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Đang tải dữ liệu giảng dạy...
        </p>
      )}
      {dashboardQuery.isError && (
        <p className="mt-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Không thể tải tổng quan giáo viên.
        </p>
      )}

      {data && (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              icon={School}
              label="Lớp phụ trách"
              value={data.classrooms.length}
              accent="bg-blue-50 text-blue-700"
            />
            <StatCard
              icon={UsersRound}
              label="Học sinh"
              value={data.classrooms.reduce(
                (total, item) => total + (item.student_count ?? 0),
                0,
              )}
              accent="bg-emerald-50 text-emerald-700"
            />
            <StatCard
              icon={FileText}
              label="Bản nháp cần xử lý"
              value={draftCount}
              accent="bg-amber-50 text-amber-700"
            />
            <StatCard
              icon={Bell}
              label="Thông báo chưa đọc"
              value={data.unreadCount}
              accent="bg-violet-50 text-violet-700"
            />
            <StatCard
              icon={ClipboardList}
              label="Bai tap dang quan ly"
              value={data.assignments.length}
              accent="bg-cyan-50 text-cyan-700"
            />
          </section>

          {data.classrooms.length === 0 ? (
            <div className="mt-6 border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <School className="mx-auto h-8 w-8 text-slate-400" />
              <h2 className="mt-3 font-bold text-slate-900">Chưa có lớp học được gán</h2>
              <p className="mt-2 text-sm text-slate-500">
                Vui lòng liên hệ quản trị viên để được phân công lớp.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
              <LatestContent posts={data.posts} documents={data.documents} />
              <section className="border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="font-bold text-slate-950">Lớp đang phụ trách</h2>
                  <p className="mt-1 text-sm text-slate-500">Truy cập nhanh không gian lớp.</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {data.classrooms.slice(0, 6).map((classroom: Classroom) => (
                    <Link
                      key={classroom.id}
                      to={`/teacher/classes/${classroom.id}`}
                      className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{classroom.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {classroom.school_year} · {classroom.student_count ?? 0} học sinh
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </TeacherPortalLayout>
  );
}
