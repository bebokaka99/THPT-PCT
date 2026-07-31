import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { deleteClassroom, getClassrooms } from '../../services/classroom.service';
import { useAuth } from '../../stores/auth-context';
import type { Classroom } from '../../types/classroom';

export function AdminClassroomsPage() {
  const { accessToken } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [q, setQ] = useState('');

  async function loadData() {
    if (!accessToken) return;
    const response = await getClassrooms(accessToken, { page: 1, limit: 50, q });
    setClassrooms(response.data);
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  return (
    <AdminLayout>
      <section>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Lớp học</h1>
            <p className="text-sm text-slate-500">Quản lý lớp và thành viên.</p>
          </div>
          <Link to="/admin/classrooms/new" className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Tạo lớp</Link>
        </div>
        <div className="mt-5 flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} className="rounded border px-3 py-2 text-sm" placeholder="Tìm lớp..." />
          <button onClick={() => void loadData()} className="rounded border px-4 py-2 text-sm font-semibold">Tìm</button>
        </div>
        <div className="mt-5 overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Tên lớp</th><th>Năm học</th><th>Thành viên</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>
              {classrooms.map((classroom) => (
                <tr key={classroom.id} className="border-t">
                  <td className="p-3 font-semibold">{classroom.name}</td>
                  <td>{classroom.school_year}</td>
                  <td>{classroom.member_count ?? 0}</td>
                  <td>{classroom.is_active ? 'Active' : 'Inactive'}</td>
                  <td className="space-x-2 p-3 text-right">
                    <Link to={`/admin/classrooms/${classroom.id}`} className="font-semibold text-blue-700">Chi tiết</Link>
                    <Link to={`/admin/classrooms/${classroom.id}/edit`} className="font-semibold text-slate-700">Sửa</Link>
                    <button onClick={() => accessToken && confirm('Xóa lớp này?') && deleteClassroom(accessToken, classroom.id).then(loadData)} className="font-semibold text-red-700">Xóa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminLayout>
  );
}
