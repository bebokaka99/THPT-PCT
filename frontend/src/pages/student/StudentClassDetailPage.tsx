import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  Download,
  ExternalLink,
  FileText,
  School,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { TimetablePrintView } from '../../components/classrooms/TimetablePrintView';
import { DailySchedulePanel } from '../../components/timetable/DailySchedulePanel';
import { StudentPortalLayout } from '../../components/layout/StudentPortalLayout';
import { resolvePublicMediaUrl } from '../../lib/media-url';
import {
  getClassroomDetail,
  getClassroomDocuments,
  getClassroomMembers,
  getClassroomPosts,
  getClassroomTimetable,
} from '../../services/classroom.service';
import { useAuth } from '../../stores/auth-context';
import type {
  Classroom,
  ClassroomDocument,
  ClassroomMember,
  ClassroomPost,
  Timetable,
} from '../../types/classroom';

type TabKey = 'posts' | 'documents' | 'timetable' | 'members';

type ClassDetailData = {
  classroom: Classroom;
  documents: ClassroomDocument[];
  members: ClassroomMember[];
  posts: ClassroomPost[];
  timetable: Timetable | null;
};

const tabs: Array<{
  key: TabKey;
  label: string;
  icon: typeof Bell;
}> = [
  { key: 'posts', label: 'Thông báo', icon: Bell },
  { key: 'documents', label: 'Tài liệu', icon: FileText },
  { key: 'timetable', label: 'Thời khóa biểu', icon: CalendarDays },
  { key: 'members', label: 'Thành viên', icon: UsersRound },
];

function formatDate(value?: string | null) {
  if (!value) return 'Chưa có ngày đăng';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function fileNameFromUrl(value: string) {
  try {
    return decodeURIComponent(value.split('/').pop() || value);
  } catch {
    return value;
  }
}

function EmptyPanel({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: typeof Bell;
  title: string;
}) {
  return (
    <div className="border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <Icon className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
      <h3 className="mt-3 font-bold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}

async function loadClassDetail(token: string, classroomId: number): Promise<ClassDetailData> {
  const [classroom, posts, documents, members, timetable] = await Promise.all([
    getClassroomDetail(token, classroomId),
    getClassroomPosts(token, classroomId),
    getClassroomDocuments(token, classroomId),
    getClassroomMembers(token, classroomId),
    getClassroomTimetable(token, classroomId).catch(() => ({ data: null })),
  ]);

  return {
    classroom,
    posts: posts.data,
    documents: documents.data,
    members: members.data,
    timetable: timetable.data,
  };
}

function ClassroomPosts({ posts }: { posts: ClassroomPost[] }) {
  if (posts.length === 0) {
    return (
      <EmptyPanel
        icon={Bell}
        title="Chưa có thông báo"
        description="Thông báo mới của giáo viên sẽ xuất hiện tại đây."
      />
    );
  }

  return (
    <div className="grid gap-4">
      {posts.map((post) => (
        <article key={post.id} className="border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-slate-950">{post.title}</h3>
              <p className="mt-1 text-xs text-slate-500">
                {post.author_name && `${post.author_name} · `}
                {formatDate(post.published_at || post.created_at)}
              </p>
            </div>
            {post.status !== 'published' && (
              <span className="w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                {post.status}
              </span>
            )}
          </div>
          {post.content ? (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {post.content}
            </p>
          ) : (
            <p className="mt-4 text-sm italic text-slate-400">Thông báo không có nội dung chi tiết.</p>
          )}
        </article>
      ))}
    </div>
  );
}

function ClassroomDocuments({ documents }: { documents: ClassroomDocument[] }) {
  if (documents.length === 0) {
    return (
      <EmptyPanel
        icon={FileText}
        title="Chưa có tài liệu"
        description="Tài liệu được giáo viên chia sẻ sẽ xuất hiện tại đây."
      />
    );
  }

  return (
    <div className="grid gap-3">
      {documents.map((document) => {
        const fileUrl = resolvePublicMediaUrl(document.file_url);
        return (
          <article
            key={document.id}
            className="border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-950">{document.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {document.author_name && `${document.author_name} · `}
                      {formatDate(document.published_at || document.created_at)}
                    </p>
                  </div>
                </div>
                {document.description && (
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {document.description}
                  </p>
                )}
                <p className="mt-2 break-all text-xs text-slate-400">
                  {fileNameFromUrl(document.file_url)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  Mở
                </a>
                <a
                  href={fileUrl}
                  download
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                >
                  <Download className="h-4 w-4" />
                  Tải
                </a>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ClassroomTimetable({
  classroom,
  token,
  timetable,
}: {
  classroom: Classroom;
  token: string;
  timetable: Timetable | null;
}) {
  if (!timetable) {
    return (
      <EmptyPanel
        icon={CalendarDays}
        title="Chưa có thời khóa biểu"
        description="Thời khóa biểu đang được giáo viên cập nhật."
      />
    );
  }

  return <div className="grid gap-6"><DailySchedulePanel classroomId={classroom.id} token={token} /><TimetablePrintView classroom={classroom} timetable={timetable} /></div>;
}

function ClassroomMembers({ members }: { members: ClassroomMember[] }) {
  if (members.length === 0) {
    return (
      <EmptyPanel
        icon={UsersRound}
        title="Chưa có thành viên"
        description="Danh sách lớp đang được nhà trường cập nhật."
      />
    );
  }

  const teachers = members.filter((member) => member.role === 'teacher');
  const students = members.filter((member) => member.role === 'student');

  return (
    <div className="grid gap-6">
      <section>
        <h3 className="text-sm font-bold uppercase text-slate-500">Giáo viên</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {teachers.map((member) => (
            <MemberRow key={member.id} member={member} />
          ))}
          {teachers.length === 0 && (
            <p className="text-sm text-slate-500">Chưa có giáo viên được gán.</p>
          )}
        </div>
      </section>
      <section>
        <h3 className="text-sm font-bold uppercase text-slate-500">
          Học sinh ({students.length})
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {students.map((member) => (
            <MemberRow key={member.id} member={member} />
          ))}
        </div>
      </section>
    </div>
  );
}

function MemberRow({ member }: { member: ClassroomMember }) {
  return (
    <div className="flex items-center gap-3 border border-slate-200 bg-white p-3">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
        <UserRound className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">{member.full_name}</p>
        <p className="text-xs text-slate-500">
          {member.role === 'teacher' ? 'Giáo viên' : 'Học sinh'}
        </p>
      </div>
    </div>
  );
}

export function StudentClassDetailPage() {
  const { id } = useParams();
  const { accessToken, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const classroomId = Number(id);
  const requestedTab = searchParams.get('tab');
  const activeTab = tabs.some((tab) => tab.key === requestedTab)
    ? (requestedTab as TabKey)
    : 'posts';

  const detailQuery = useQuery({
    queryKey: ['student', 'classroom', classroomId, user?.id],
    queryFn: () => loadClassDetail(accessToken!, classroomId),
    enabled: Boolean(accessToken && Number.isInteger(classroomId) && classroomId > 0),
  });

  const data = detailQuery.data;

  return (
    <StudentPortalLayout>
      <Link
        to="/student/classes"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Danh sách lớp
      </Link>

      {detailQuery.isLoading && (
        <p className="mt-5 border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Đang tải thông tin lớp học...
        </p>
      )}

      {detailQuery.isError && (
        <div className="mt-5 border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Không thể mở lớp học này. Hãy kiểm tra lớp đã được gán cho tài khoản của em.
        </div>
      )}

      {data && (
        <>
          <header className="mt-5 border-b border-slate-200 pb-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-700">Lớp học của em</p>
                <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
                  {data.classroom.name}
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  Năm học {data.classroom.school_year}
                  {data.classroom.grade_level
                    ? ` · Khối ${data.classroom.grade_level}`
                    : ''}
                </p>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <p className="font-bold text-slate-950">{data.classroom.student_count ?? 0}</p>
                  <p className="text-slate-500">Học sinh</p>
                </div>
                <div>
                  <p className="font-bold text-slate-950">{data.posts.length}</p>
                  <p className="text-slate-500">Thông báo</p>
                </div>
                <div>
                  <p className="font-bold text-slate-950">{data.documents.length}</p>
                  <p className="text-slate-500">Tài liệu</p>
                </div>
              </div>
            </div>
            {data.classroom.description && (
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
                {data.classroom.description}
              </p>
            )}
          </header>

          <nav
            className="mt-6 flex gap-2 overflow-x-auto border-b border-slate-200"
            aria-label="Nội dung lớp học"
          >
            {tabs.map(({ icon: Icon, key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setSearchParams({ tab: key })}
                className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition ${
                  activeTab === key
                    ? 'border-blue-700 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>

          <div className="mt-6">
            {activeTab === 'posts' && <ClassroomPosts posts={data.posts} />}
            {activeTab === 'documents' && (
              <ClassroomDocuments documents={data.documents} />
            )}
            {activeTab === 'timetable' && (
              <ClassroomTimetable
                classroom={data.classroom}
                token={accessToken!}
                timetable={data.timetable}
              />
            )}
            {activeTab === 'members' && <ClassroomMembers members={data.members} />}
          </div>
        </>
      )}
    </StudentPortalLayout>
  );
}
