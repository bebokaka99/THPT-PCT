import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TimetablePrintView } from '../../components/classrooms/TimetablePrintView';
import { TeacherTimetableEditor } from '../../components/teacher/TeacherTimetableEditor';
import { AdminLayout } from '../../components/layout/AdminLayout';
import {
  addClassroomMember,
  getClassroomDetail,
  getClassroomDocuments,
  getClassroomMembers,
  getClassroomPosts,
  getClassroomTimetable,
  removeClassroomMember,
} from '../../services/classroom.service';
import { useAuth } from '../../stores/auth-context';
import type { Classroom, ClassroomDocument, ClassroomMember, ClassroomPost, ClassroomRole, Timetable } from '../../types/classroom';

export function AdminClassroomDetailPage() {
  const { id } = useParams();
  const classroomId = Number(id);
  const { accessToken } = useAuth();
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [members, setMembers] = useState<ClassroomMember[]>([]);
  const [posts, setPosts] = useState<ClassroomPost[]>([]);
  const [documents, setDocuments] = useState<ClassroomDocument[]>([]);
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [memberForm, setMemberForm] = useState({ user_id: '', role: 'student' as ClassroomRole });

  async function loadData() {
    if (!accessToken || !classroomId) return;
    const [detail, memberResponse, postResponse, documentResponse, timetableResponse] = await Promise.all([
      getClassroomDetail(accessToken, classroomId),
      getClassroomMembers(accessToken, classroomId),
      getClassroomPosts(accessToken, classroomId),
      getClassroomDocuments(accessToken, classroomId),
      getClassroomTimetable(accessToken, classroomId).catch(() => ({ data: null })),
    ]);
    setClassroom(detail);
    setMembers(memberResponse.data);
    setPosts(postResponse.data);
    setDocuments(documentResponse.data);
    setTimetable(timetableResponse.data);
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, classroomId]);

  async function handleAddMember(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    await addClassroomMember(accessToken, classroomId, Number(memberForm.user_id), memberForm.role);
    setMemberForm({ user_id: '', role: 'student' });
    await loadData();
  }

  return (
    <AdminLayout>
      <section className="grid gap-6">
        <div className="rounded-lg border bg-white p-5">
          <Link to="/admin/classrooms" className="text-sm font-semibold text-blue-700">Quay lại</Link>
          <h1 className="mt-3 text-2xl font-bold text-slate-950">{classroom?.name}</h1>
          <p className="mt-1 text-sm text-slate-600">Năm học: {classroom?.school_year}</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-lg border bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold text-slate-950">Thành viên</h2>
              <Link
                to={`/admin/enrollments?classroom_id=${classroomId}`}
                className="text-sm font-semibold text-blue-700"
              >
                Lịch sử xếp lớp
              </Link>
            </div>
            <form onSubmit={handleAddMember} className="mt-4 flex flex-wrap gap-2">
              <input required className="rounded border px-3 py-2 text-sm" placeholder="User ID" value={memberForm.user_id} onChange={(e) => setMemberForm({ ...memberForm, user_id: e.target.value })} />
              <select className="rounded border px-3 py-2 text-sm" value={memberForm.role} onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value as ClassroomRole })}>
                <option value="student">student</option>
                <option value="teacher">teacher</option>
              </select>
              <button className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Thêm</button>
            </form>
            <div className="mt-4 grid gap-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded border p-3 text-sm">
                  <span>{member.full_name} ({member.email}) - {member.role}</span>
                  <button
                    onClick={() =>
                      accessToken &&
                      removeClassroomMember(
                        accessToken,
                        classroomId,
                        member.id,
                        member.role,
                      ).then(loadData)
                    }
                    className="font-semibold text-red-700"
                  >
                    {member.role === 'student' ? 'Kết thúc xếp lớp' : 'Xóa'}
                  </button>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-lg border bg-white p-5">
            <h2 className="font-bold text-slate-950">Nội dung lớp</h2>
            <p className="mt-3 text-sm text-slate-600">Thông báo: {posts.length}</p>
            <p className="text-sm text-slate-600">Tài liệu: {documents.length}</p>
            <p className="text-sm text-slate-600">Thời khóa biểu: {timetable ? timetable.title : 'Chưa có'}</p>
            <div className="mt-4 grid gap-2">
              {posts.slice(0, 5).map((post) => <p key={post.id} className="rounded border p-2 text-sm">{post.title} - {post.status}</p>)}
              {documents.slice(0, 5).map((document) => <p key={document.id} className="rounded border p-2 text-sm">{document.title} - {document.status}</p>)}
            </div>
          </section>
        </div>
        {classroom && (
          <div className="grid gap-6">
            {timetable && <TimetablePrintView classroom={classroom} timetable={timetable} />}
            <TeacherTimetableEditor
              classroom={classroom}
              timetable={timetable}
              onChanged={loadData}
            />
          </div>
        )}
      </section>
    </AdminLayout>
  );
}
