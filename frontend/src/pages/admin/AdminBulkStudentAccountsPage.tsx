import { Download, FileUp, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { bulkCreateStudentAccounts } from '../../services/adminUser.service';
import { getClassrooms } from '../../services/classroom.service';
import { useAuth } from '../../stores/auth-context';
import type { Classroom } from '../../types/classroom';
import type { BulkStudentInput, StudentCredential } from '../../types/user';

const requiredHeaders = ['full_name', 'date_of_birth'];

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (const character of line) {
    if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  values.push(current.trim());
  return values;
}

function parseCsv(text: string): BulkStudentInput[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    throw new Error('File CSV cần có dòng tiêu đề và ít nhất một học sinh.');
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  for (const requiredHeader of requiredHeaders) {
    if (!headers.includes(requiredHeader)) {
      throw new Error(`CSV thiếu cột bắt buộc: ${requiredHeader}`);
    }
  }

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    return {
      full_name: row.full_name,
      date_of_birth: row.date_of_birth,
      class_name: row.class_name || undefined,
      student_code: row.student_code || undefined,
      phone: row.phone || undefined,
      parent_phone: row.parent_phone || undefined,
      email: row.email || undefined,
    };
  });
}

function downloadCredentials(credentials: StudentCredential[]) {
  const header = 'full_name,username,password,date_of_birth,class_name,student_code';
  const rows = credentials.map((item) =>
    [item.full_name, item.username, item.password, item.date_of_birth, item.class_name ?? '', item.student_code ?? '']
      .map((value) => `"${value.replace(/"/g, '""')}"`)
      .join(','),
  );
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'pct-student-credentials.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadSampleCsv() {
  const sample = [
    'full_name,date_of_birth,class_name,student_code,phone,parent_phone,email',
    '"Nguyễn Văn An","03/09/2009","12A1","HS001","","",""',
    '"Trần Thị Bình","15/12/2009","12A1","HS002","","",""',
  ].join('\n');
  const blob = new Blob([sample], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'pct-students-sample.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminBulkStudentAccountsPage() {
  const { accessToken } = useAuth();
  const [cohort, setCohort] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<BulkStudentInput[]>([]);
  const [credentials, setCredentials] = useState<StudentCredential[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => Boolean(accessToken && cohort.trim() && students.length > 0 && !isSaving),
    [accessToken, cohort, isSaving, students.length],
  );

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    getClassrooms(accessToken, { page: 1, limit: 50, is_active: true })
      .then((response) => {
        if (active) setClassrooms(response.data);
      })
      .catch(() => {
        if (active) setClassrooms([]);
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setError(null);
      setSuccess(null);
      setStudents(parseCsv(await file.text()));
      setCredentials([]);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Không thể đọc file CSV.');
      setStudents([]);
    } finally {
      event.target.value = '';
    }
  }

  async function handleSubmit() {
    if (!accessToken || !canSubmit) return;
    try {
      setIsSaving(true);
      setError(null);
      const response = await bulkCreateStudentAccounts(accessToken, {
        cohort: cohort.trim(),
        classroom_id: classroomId ? Number(classroomId) : undefined,
        students,
      });
      setCredentials(response.data.credentials);
      setSuccess(`Đã tạo ${response.data.createdCount} tài khoản học sinh.`);
    } catch {
      setError('Không thể tạo tài khoản hàng loạt. Kiểm tra cohort, ngày sinh và danh sách CSV.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminLayout>
      <section className="mx-auto grid max-w-6xl gap-5">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <Link to="/admin/users" className="text-sm font-semibold text-blue-700">Quay lại tài khoản</Link>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded bg-blue-50 text-blue-700">
                  <UsersRound className="h-5 w-5" />
                </span>
                <h2 className="text-2xl font-bold text-slate-950">Tạo tài khoản học sinh hàng loạt</h2>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Giáo viên vẫn được tạo thủ công. Học sinh dùng tài khoản dạng cohort + pct + ngày sinh + 4 số ngẫu nhiên.
              </p>
            </div>
            <button type="button" onClick={downloadSampleCsv} className="inline-flex items-center justify-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700">
              <Download className="h-4 w-4" />
              Tải CSV mẫu
            </button>
          </div>
        </div>

        <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Khóa / cohort
            <input value={cohort} onChange={(event) => setCohort(event.target.value)} placeholder="21" className="rounded border border-slate-300 px-3 py-2 font-normal" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Gán vào lớp (tùy chọn)
            <select value={classroomId} onChange={(event) => setClassroomId(event.target.value)} className="rounded border border-slate-300 px-3 py-2 font-normal">
              <option value="">Chưa gán lớp</option>
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name} - {classroom.school_year}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            File CSV
            <span className="relative inline-flex items-center justify-center gap-2 rounded border border-dashed border-blue-300 bg-blue-50 px-3 py-2 font-semibold text-blue-800">
              <FileUp className="h-4 w-4" />
              Chọn danh sách CSV
              <input type="file" accept=".csv,text/csv" onChange={(event) => void handleFile(event)} className="absolute inset-0 cursor-pointer opacity-0" />
            </span>
          </label>
          <p className="text-xs text-slate-500 md:col-span-3">
            Cột bắt buộc: <code>full_name,date_of_birth</code>. Cột tùy chọn: <code>class_name,student_code,phone,parent_phone,email</code>. Ngày sinh dùng DD/MM/YYYY hoặc YYYY-MM-DD.
          </p>
        </div>

        {error && <p className="rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
        {success && <p className="rounded border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">{success}</p>}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
            <div>
              <h3 className="font-bold text-slate-950">Xem trước danh sách</h3>
              <p className="text-sm text-slate-500">{students.length} học sinh</p>
            </div>
            <button type="button" disabled={!canSubmit} onClick={() => void handleSubmit()} className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {isSaving ? 'Đang tạo...' : 'Tạo tài khoản'}
            </button>
          </div>
          {students.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">Chọn file CSV để xem trước.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr><th className="px-4 py-3">Họ tên</th><th className="px-4 py-3">Ngày sinh</th><th className="px-4 py-3">Lớp</th><th className="px-4 py-3">Mã học sinh</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {students.map((student, index) => (
                    <tr key={`${student.full_name}-${index}`}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{student.full_name}</td>
                      <td className="px-4 py-3 text-slate-600">{student.date_of_birth}</td>
                      <td className="px-4 py-3 text-slate-600">{student.class_name ?? '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{student.student_code ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {credentials.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-amber-200 bg-amber-50">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 p-4">
              <div>
                <h3 className="font-bold text-amber-950">Thông tin đăng nhập vừa tạo</h3>
                <p className="text-sm text-amber-800">Mật khẩu chỉ hiển thị ở lần này. Hãy tải xuống và lưu trữ an toàn.</p>
              </div>
              <button type="button" onClick={() => downloadCredentials(credentials)} className="rounded border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900">Tải CSV tài khoản</button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-amber-200 text-sm">
                <thead className="text-left text-xs uppercase text-amber-800"><tr><th className="px-4 py-3">Họ tên</th><th className="px-4 py-3">Tài khoản</th><th className="px-4 py-3">Mật khẩu</th></tr></thead>
                <tbody className="divide-y divide-amber-200">
                  {credentials.map((item) => <tr key={item.user_id}><td className="px-4 py-3">{item.full_name}</td><td className="px-4 py-3 font-mono">{item.username}</td><td className="px-4 py-3 font-mono font-bold">{item.password}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </AdminLayout>
  );
}
