import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  Megaphone,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { TimetablePrintView } from '../../components/classrooms/TimetablePrintView';
import { TeacherPortalLayout } from '../../components/layout/TeacherPortalLayout';
import {
  TeacherClassDocumentsPanel,
  TeacherClassPostsPanel,
} from '../../components/teacher/TeacherClassContentPanels';
import { TeacherTimetableEditor } from '../../components/teacher/TeacherTimetableEditor';
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

const tabs: Array<{ key: TabKey; label: string; icon: typeof Megaphone }> = [
  { key: 'posts', label: 'Thông báo', icon: Megaphone },
  { key: 'documents', label: 'Tài liệu', icon: FileText },
  { key: 'timetable', label: 'Thời khóa biểu', icon: CalendarDays },
  { key: 'members', label: 'Thành viên', icon: UsersRound },
];

async function loadClassDetail(
  token: string,
  classroomId: number,
): Promise<ClassDetailData> {
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

function MembersPanel({ members }: { members: ClassroomMember[] }) {
  const teachers = members.filter((member) => member.role === 'teacher');
  const students = members.filter((member) => member.role === 'student');

  return (
    <div className="grid gap-6">
      <section>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-950">Giáo viên trong lớp</h2>
            <p className="mt-1 text-sm text-slate-500">
              Danh sách do quản trị viên nhà trường phân công.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {teachers.length}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {teachers.length === 0 && (
            <p className="border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
              Chưa có giáo viên được gán.
            </p>
          )}
          {teachers.map((member) => (
            <MemberRow key={member.id} member={member} />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-950">Danh sách học sinh</h2>
            <p className="mt-1 text-sm text-slate-500">
              Liên hệ quản trị viên nếu danh sách chưa chính xác.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            {students.length}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {students.length === 0 && (
            <p className="border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
              Chưa có học sinh trong lớp.
            </p>
          )}
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
    <div className="flex items-center gap-3 border border-slate-200 bg-white p-3 shadow-sm">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
        <UserRound className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">{member.full_name}</p>
        <p className="truncate text-xs text-slate-500">
          {member.email ||
            (member.role === 'teacher' ? 'Giáo viên' : 'Học sinh')}
        </p>
      </div>
    </div>
  );
}

export function TeacherClassDetailPage() {
  const { id } = useParams();
  const { accessToken, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const classroomId = Number(id);
  const requestedTab = searchParams.get('tab');
  const activeTab = tabs.some((tab) => tab.key === requestedTab)
    ? (requestedTab as TabKey)
    : 'posts';
  const detailQuery = useQuery({
    queryKey: ['teacher', 'classroom', classroomId, user?.id],
    queryFn: () => loadClassDetail(accessToken!, classroomId),
    enabled: Boolean(accessToken && Number.isInteger(classroomId) && classroomId > 0),
  });
  const data = detailQuery.data;

  return (
    <TeacherPortalLayout>
      <Link
        to="/teacher/classes"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Danh sách lớp
      </Link>

      {detailQuery.isLoading && (
        <p className="mt-5 border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Đang tải không gian lớp học...
        </p>
      )}
      {detailQuery.isError && (
        <div className="mt-5 border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Không thể mở lớp học này. Giáo viên chỉ được truy cập lớp đã được phân công.
        </div>
      )}

      {data && (
        <>
          <header className="mt-5 border-b border-slate-200 pb-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-700">Không gian quản lý lớp</p>
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
                  <p className="font-bold text-slate-950">
                    {data.classroom.student_count ?? 0}
                  </p>
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
            aria-label="Quản lý lớp học"
          >
            {tabs.map(({ icon: Icon, key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setSearchParams({ tab: key })}
                className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition ${
                  activeTab === key
                    ? 'border-emerald-700 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>

          <div className="mt-6">
            {activeTab === 'posts' && (
              <TeacherClassPostsPanel
                classroomId={classroomId}
                items={data.posts}
                onChanged={() => detailQuery.refetch()}
              />
            )}
            {activeTab === 'documents' && (
              <TeacherClassDocumentsPanel
                classroomId={classroomId}
                items={data.documents}
                onChanged={() => detailQuery.refetch()}
              />
            )}
            {activeTab === 'timetable' && (
              <div className="grid gap-6">
                {data.timetable && (
                  <TimetablePrintView
                    classroom={data.classroom}
                    timetable={data.timetable}
                  />
                )}
                <TeacherTimetableEditor
                  classroom={data.classroom}
                  timetable={data.timetable}
                  onChanged={() => detailQuery.refetch()}
                />
              </div>
            )}
            {activeTab === 'members' && <MembersPanel members={data.members} />}
          </div>
        </>
      )}
    </TeacherPortalLayout>
  );
}
