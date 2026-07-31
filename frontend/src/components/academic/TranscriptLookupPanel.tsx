import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileCheck2, Printer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getAcademicPeriods } from '../../services/academicPeriod.service';
import { getClassrooms } from '../../services/classroom.service';
import {
  generateSemesterTranscriptSnapshots,
  getClassroomTranscripts,
  getStudentTranscript,
} from '../../services/transcript.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import { ReportCardView } from './ReportCardView';

export function TranscriptLookupPanel({ allowSnapshot = false }: { allowSnapshot?: boolean }) {
  const { accessToken } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [classroomId, setClassroomId] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [studentId, setStudentId] = useState<number | null>(null);
  const periods = useQuery({
    queryKey: ['academic-periods', 'transcript'],
    queryFn: () => getAcademicPeriods(accessToken!),
    enabled: Boolean(accessToken),
  });
  const classrooms = useQuery({
    queryKey: ['classrooms', 'transcript'],
    queryFn: () => getClassrooms(accessToken!, { page: 1, limit: 100 }),
    enabled: Boolean(accessToken),
  });
  const semesters = useMemo(
    () => (periods.data ?? []).flatMap((year) => year.semesters.map((semester) => ({ ...semester, year_name: year.name }))),
    [periods.data],
  );
  useEffect(() => {
    if (!semesterId && semesters[0]) setSemesterId(String(semesters[0].id));
  }, [semesterId, semesters]);
  useEffect(() => {
    if (!classroomId && classrooms.data?.data[0]) setClassroomId(String(classrooms.data.data[0].id));
  }, [classroomId, classrooms.data]);
  const roster = useQuery({
    queryKey: ['transcripts', 'classroom', classroomId, semesterId],
    queryFn: () => getClassroomTranscripts(accessToken!, Number(classroomId), Number(semesterId)),
    enabled: Boolean(accessToken && classroomId && semesterId),
  });
  const detail = useQuery({
    queryKey: ['transcript', 'student', studentId, semesterId],
    queryFn: () => getStudentTranscript(accessToken!, studentId!, Number(semesterId)),
    enabled: Boolean(accessToken && studentId && semesterId),
  });
  const snapshot = useMutation({
    mutationFn: () => generateSemesterTranscriptSnapshots(accessToken!, Number(semesterId)),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['transcripts'] });
      toast.success(`Đã tạo ${response.data.created} snapshot phiếu điểm.`);
    },
  });
  const selectedSemester = semesters.find((item) => item.id === Number(semesterId));

  return (
    <div className="grid gap-5">
      <section className="no-print grid gap-3 border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Lớp học
          <select value={classroomId} onChange={(event) => { setClassroomId(event.target.value); setStudentId(null); }} className="rounded-md border border-slate-300 px-3 py-2.5 font-normal">
            {(classrooms.data?.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} - {item.school_year}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Học kỳ
          <select value={semesterId} onChange={(event) => { setSemesterId(event.target.value); setStudentId(null); }} className="rounded-md border border-slate-300 px-3 py-2.5 font-normal">
            {semesters.map((item) => <option key={item.id} value={item.id}>{item.year_name} - {item.name}</option>)}
          </select>
        </label>
        {allowSnapshot && selectedSemester?.is_locked && (
          <button type="button" onClick={() => snapshot.mutate()} disabled={snapshot.isPending} className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-300 px-3 py-2 text-sm font-bold text-blue-800 md:col-span-2 md:justify-self-end">
            <FileCheck2 className="h-4 w-4" /> Chốt snapshot học kỳ
          </button>
        )}
      </section>

      <section className="no-print overflow-hidden border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-200 px-4 py-3 font-bold">Danh sách học sinh</h2>
        {roster.isLoading ? <p className="p-6 text-sm text-slate-500">Đang tải danh sách...</p>
          : roster.isError ? <p className="bg-red-50 p-4 text-sm text-red-700">Không thể tải dữ liệu lớp hoặc bạn không có quyền.</p>
          : (roster.data?.data.length ?? 0) === 0 ? <p className="p-8 text-center text-sm text-slate-500">Chưa có học sinh hoặc kết quả trong phạm vi này.</p>
          : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Học sinh</th><th className="px-4 py-3">Hoàn thành</th><th className="px-4 py-3">Trung bình</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-slate-200">{roster.data?.data.map((item) => <tr key={item.student_user_id}><td className="px-4 py-3"><strong className="block">{item.full_name}</strong><span className="text-xs text-slate-500">{item.student_code || 'Chưa có mã'}</span></td><td className="px-4 py-3">{item.completed_subjects}/{item.total_subjects} môn</td><td className="px-4 py-3 font-bold text-blue-800">{item.overall_average ?? '-'}</td><td className="px-4 py-3 text-right"><button onClick={() => setStudentId(item.student_user_id)} className="rounded-md bg-blue-700 px-3 py-2 text-xs font-bold text-white">Xem phiếu</button></td></tr>)}</tbody></table></div>}
      </section>

      {detail.data?.data && (
        <section className="border border-slate-200 bg-white shadow-sm">
          <div className="no-print flex justify-end border-b border-slate-200 p-3">
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white"><Printer className="h-4 w-4" /> In / Lưu PDF</button>
          </div>
          <ReportCardView transcript={detail.data.data} />
        </section>
      )}
    </div>
  );
}
