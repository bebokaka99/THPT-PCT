import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronRight,
  FileText,
  School,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { StudentPortalLayout } from '../../components/layout/StudentPortalLayout';
import {
  getClassroomDocuments,
  getClassroomPosts,
  getClassrooms,
  getClassroomTimetable,
} from '../../services/classroom.service';
import { getUnreadNotificationCount } from '../../services/notification.service';
import { getMyProfile } from '../../services/profile.service';
import { useAuth } from '../../stores/auth-context';
import type {
  Classroom,
  ClassroomDocument,
  ClassroomPost,
  Timetable,
  TimetableItem,
} from '../../types/classroom';
import type { MyProfile, StudentProfile } from '../../types/profile';

type DashboardClass = {
  classroom: Classroom;
  documents: ClassroomDocument[];
  posts: ClassroomPost[];
  timetable: Timetable | null;
};

type DashboardPost = ClassroomPost & { classroomName: string };
type DashboardDocument = ClassroomDocument & { classroomName: string };

function itemDate(item: { published_at: string | null; created_at: string }) {
  return new Date(item.published_at || item.created_at).getTime();
}

function formatDate(value?: string | null) {
  if (!value) return 'Chưa có ngày đăng';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function isStudentProfile(value: MyProfile['profile']): value is StudentProfile {
  return Boolean(value && 'student_code' in value);
}

async function loadDashboard(token: string) {
  const [classroomResponse, profile, unread] = await Promise.all([
    getClassrooms(token, { page: 1, limit: 20 }),
    getMyProfile(token),
    getUnreadNotificationCount(token).catch(() => ({ count: 0 })),
  ]);

  const classData: DashboardClass[] = await Promise.all(
    classroomResponse.data.map(async (classroom) => {
      const [posts, documents, timetable] = await Promise.all([
        getClassroomPosts(token, classroom.id).catch(() => ({ data: [] })),
        getClassroomDocuments(token, classroom.id).catch(() => ({ data: [] })),
        getClassroomTimetable(token, classroom.id).catch(() => ({ data: null })),
      ]);
      return {
        classroom,
        posts: posts.data,
        documents: documents.data,
        timetable: timetable.data,
      };
    }),
  );

  const posts = classData
    .flatMap(({ classroom, posts: items }) =>
      items.map((item) => ({ ...item, classroomName: classroom.name })),
    )
    .sort((a, b) => itemDate(b) - itemDate(a));
  const documents = classData
    .flatMap(({ classroom, documents: items }) =>
      items.map((item) => ({ ...item, classroomName: classroom.name })),
    )
    .sort((a, b) => itemDate(b) - itemDate(a));

  return {
    classData,
    classrooms: classroomResponse.data,
    documents,
    posts,
    profile,
    unreadCount: unread.count,
  };
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
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
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-blue-700">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

function LatestPosts({ posts }: { posts: DashboardPost[] }) {
  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-bold text-slate-950">Thông báo mới nhất</h2>
          <p className="mt-1 text-sm text-slate-500">Thông tin đã xuất bản từ lớp học.</p>
        </div>
        <Bell className="h-5 w-5 text-blue-700" aria-hidden="true" />
      </div>
      <div className="divide-y divide-slate-100">
        {posts.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            Chưa có thông báo mới.
          </p>
        )}
        {posts.slice(0, 4).map((post) => (
          <Link
            key={post.id}
            to={`/student/classes/${post.classroom_id}?tab=posts`}
            className="flex items-start justify-between gap-4 px-5 py-4 transition hover:bg-slate-50"
          >
            <div className="min-w-0">
              <p className="line-clamp-1 font-semibold text-slate-900">{post.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {post.classroomName} · {formatDate(post.published_at || post.created_at)}
              </p>
            </div>
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function LatestDocuments({ documents }: { documents: DashboardDocument[] }) {
  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-bold text-slate-950">Tài liệu gần đây</h2>
          <p className="mt-1 text-sm text-slate-500">Tệp mới được chia sẻ cho lớp.</p>
        </div>
        <FileText className="h-5 w-5 text-blue-700" aria-hidden="true" />
      </div>
      <div className="divide-y divide-slate-100">
        {documents.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            Chưa có tài liệu mới.
          </p>
        )}
        {documents.slice(0, 4).map((document) => (
          <Link
            key={document.id}
            to={`/student/classes/${document.classroom_id}?tab=documents`}
            className="flex items-start justify-between gap-4 px-5 py-4 transition hover:bg-slate-50"
          >
            <div className="min-w-0">
              <p className="line-clamp-1 font-semibold text-slate-900">{document.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {document.classroomName} ·{' '}
                {formatDate(document.published_at || document.created_at)}
              </p>
            </div>
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function TodaySchedule({ classes }: { classes: DashboardClass[] }) {
  const dayOfWeek = new Date().getDay();
  const items = classes
    .flatMap(({ classroom, timetable }) =>
      (timetable?.items ?? [])
        .filter((item) => item.day_of_week === dayOfWeek)
        .map((item) => ({ ...item, classroom })),
    )
    .sort((a, b) => a.lesson_index - b.lesson_index);

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-bold text-slate-950">Lịch học hôm nay</h2>
          <p className="mt-1 text-sm text-slate-500">
            {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full' }).format(new Date())}
          </p>
        </div>
        <CalendarDays className="h-5 w-5 text-blue-700" aria-hidden="true" />
      </div>
      <div className="divide-y divide-slate-100">
        {items.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            Hôm nay chưa có tiết học trong thời khóa biểu.
          </p>
        )}
        {items.map((item: TimetableItem & { classroom: Classroom }) => (
          <div
            key={`${item.classroom.id}-${item.lesson_index}`}
            className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 px-5 py-3"
          >
            <span className="rounded-md bg-blue-50 px-2 py-1 text-center text-xs font-bold text-blue-700">
              Tiết {item.lesson_index}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{item.subject_name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {[item.teacher_name, item.room && `Phòng ${item.room}`]
                  .filter(Boolean)
                  .join(' · ') || item.classroom.name}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function StudentDashboardPage() {
  const { accessToken, user } = useAuth();
  const dashboardQuery = useQuery({
    queryKey: ['student', 'dashboard', user?.id],
    queryFn: () => loadDashboard(accessToken!),
    enabled: Boolean(accessToken),
  });

  const data = dashboardQuery.data;
  const currentProfile = data?.profile.profile ?? null;
  const studentProfile = isStudentProfile(currentProfile) ? currentProfile : null;

  return (
    <StudentPortalLayout>
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-700">Tổng quan học tập</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
            Xin chào, {user?.fullName || 'học sinh'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {studentProfile?.student_code
              ? `Mã học sinh: ${studentProfile.student_code}`
              : 'Theo dõi lớp học, thông báo và tài liệu của em tại đây.'}
          </p>
        </div>
        <Link
          to="/student/classes"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
        >
          <School className="h-4 w-4" />
          Xem lớp học
        </Link>
      </header>

      {dashboardQuery.isLoading && (
        <div className="mt-6 border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Đang tải dữ liệu học tập...
        </div>
      )}

      {dashboardQuery.isError && (
        <div className="mt-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Không thể tải tổng quan học sinh. Vui lòng thử tải lại trang.
        </div>
      )}

      {data && (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={School} label="Lớp đang tham gia" value={data.classrooms.length} />
            <StatCard icon={Bell} label="Thông báo lớp" value={data.posts.length} />
            <StatCard icon={BookOpen} label="Tài liệu lớp" value={data.documents.length} />
            <StatCard icon={Bell} label="Chưa đọc" value={data.unreadCount} />
          </section>

          {data.classrooms.length === 0 ? (
            <section className="mt-6 border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <School className="mx-auto h-8 w-8 text-slate-400" />
              <h2 className="mt-3 font-bold text-slate-900">Chưa có lớp học nào được gán</h2>
              <p className="mt-2 text-sm text-slate-500">
                Vui lòng liên hệ giáo viên chủ nhiệm hoặc quản trị viên.
              </p>
            </section>
          ) : (
            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
              <div className="grid content-start gap-6">
                <LatestPosts posts={data.posts} />
                <LatestDocuments documents={data.documents} />
              </div>
              <TodaySchedule classes={data.classData} />
            </div>
          )}
        </>
      )}
    </StudentPortalLayout>
  );
}
