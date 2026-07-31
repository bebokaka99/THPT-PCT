import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpenCheck, LoaderCircle, LockKeyhole, Plus, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { TeacherPortalLayout } from '../../components/layout/TeacherPortalLayout';
import * as gradebookApi from '../../services/gradebook.service';
import { getMyTeachingAssignments } from '../../services/teachingAssignment.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type { GradebookDetail, GradebookStatus, GradeScoreState } from '../../types/gradebook';

type Cell = { state: GradeScoreState; score: string; version: number };
const keyOf = (studentId: number, columnId: number) => `${studentId}:${columnId}`;
const statusLabel: Record<GradebookStatus, string> = {
  draft: 'Bản nháp',
  submitted: 'Chờ duyệt',
  approved: 'Đã duyệt',
  locked: 'Đã khóa',
};

function cellsFrom(detail: GradebookDetail) {
  return Object.fromEntries(
    detail.scores.map((score) => [
      keyOf(score.student_user_id, score.column_id),
      {
        state: score.state,
        score: score.score === null ? '' : String(score.score),
        version: score.version,
      },
    ]),
  ) as Record<string, Cell>;
}

export function TeacherGradebookPage() {
  const { accessToken, user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [assignmentId, setAssignmentId] = useState('');
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [dirtyKeys, setDirtyKeys] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');

  const gradebooks = useQuery({
    queryKey: ['teacher', 'gradebooks', user?.id],
    queryFn: () => gradebookApi.getGradebooks(accessToken!, { limit: 100 }),
    enabled: Boolean(accessToken),
  });
  const assignments = useQuery({
    queryKey: ['teacher', 'teaching-assignments', 'gradebook', user?.id],
    queryFn: () => getMyTeachingAssignments(accessToken!, { page: 1, limit: 100, status: 'active' }),
    enabled: Boolean(accessToken),
  });
  const detail = useQuery({
    queryKey: ['gradebook', selectedId],
    queryFn: () => gradebookApi.getGradebook(accessToken!, selectedId!),
    enabled: Boolean(accessToken && selectedId),
  });
  const selected = detail.data?.data;
  const writable = selected?.status === 'draft';

  useEffect(() => {
    if (!selected) return;
    setCells(cellsFrom(selected));
    setDirtyKeys([]);
    setSaveState('idle');
  }, [selected]);

  const createMutation = useMutation({
    mutationFn: () => gradebookApi.createGradebook(accessToken!, Number(assignmentId)),
    onSuccess: async (response) => {
      setSelectedId(response.data.id);
      setAssignmentId('');
      await queryClient.invalidateQueries({ queryKey: ['teacher', 'gradebooks'] });
      toast.success('Đã mở sổ điểm nháp.');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (keys: string[]) => {
      if (!selected || !accessToken || selected.status !== 'draft') {
        throw new Error('Sổ điểm không ở trạng thái có thể chỉnh sửa');
      }
      setSaveState('saving');
      return gradebookApi.saveGradebookScores(
        accessToken,
        selected.id,
        keys.map((key) => {
          const [studentId, columnId] = key.split(':').map(Number);
          const cell = cells[key];
          return {
            student_user_id: studentId,
            column_id: columnId,
            state: cell.state,
            score: cell.state === 'scored' ? cell.score : null,
            expected_version: cell.version,
          };
        }),
        'Teacher gradebook autosave',
      );
    },
    onSuccess: (response) => {
      queryClient.setQueryData(['gradebook', selectedId], response);
      setCells(cellsFrom(response.data));
      setDirtyKeys([]);
      setSaveState('saved');
    },
    onError: () => setSaveState('error'),
  });

  const workflowMutation = useMutation({
    mutationFn: async (action: 'submit' | 'request') => {
      if (!selected || !accessToken) throw new Error('Chưa chọn sổ điểm');
      if (action === 'submit') return gradebookApi.submitGradebook(accessToken, selected.id);
      const reason = window.prompt('Nhập lý do cần mở khóa sổ điểm:')?.trim();
      if (!reason) throw new Error('Cần nhập lý do mở khóa');
      return gradebookApi.createGradebookChangeRequest(accessToken, selected.id, reason);
    },
    onSuccess: async (_, action) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['gradebook', selectedId] }),
        queryClient.invalidateQueries({ queryKey: ['teacher', 'gradebooks'] }),
      ]);
      toast.success(action === 'submit' ? 'Đã gửi sổ điểm chờ duyệt.' : 'Đã gửi yêu cầu mở khóa.');
    },
  });

  const validDirtyKeys = useMemo(
    () => dirtyKeys.filter((key) => cells[key] && (cells[key].state !== 'scored' || cells[key].score.trim())),
    [cells, dirtyKeys],
  );
  useEffect(() => {
    if (!writable || validDirtyKeys.length === 0 || saveMutation.isPending) return;
    const timer = window.setTimeout(() => {
      void saveMutation.mutateAsync(validDirtyKeys).catch(() => undefined);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [writable, saveMutation.isPending, validDirtyKeys.join('|')]);

  function updateCell(studentId: number, columnId: number, patch: Partial<Cell>) {
    if (!writable) return;
    const key = keyOf(studentId, columnId);
    setCells((current) => ({
      ...current,
      [key]: { ...(current[key] ?? { state: 'scored', score: '', version: 0 }), ...patch },
    }));
    setDirtyKeys((current) => (current.includes(key) ? current : [...current, key]));
    setSaveState('dirty');
  }

  return (
    <TeacherPortalLayout>
      <div className="grid min-w-0 gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Học vụ</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Sổ điểm</h1>
            <p className="mt-2 text-sm text-slate-600">Nhập điểm, gửi duyệt và theo dõi trạng thái khóa sổ.</p>
          </div>
          <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
            {saveState === 'saving' ? 'Đang lưu...' : saveState === 'dirty' ? 'Chưa lưu' : saveState === 'error' ? 'Lỗi lưu điểm' : 'Đã đồng bộ'}
          </span>
        </header>

        <section className="border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <select value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2.5 text-sm">
              <option value="">Chọn phân công để mở sổ điểm</option>
              {(assignments.data?.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>{item.classroom_name} - {item.subject_name} - {item.semester_name}</option>
              ))}
            </select>
            <button type="button" disabled={!assignmentId || createMutation.isPending} onClick={() => createMutation.mutate()} className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              <Plus className="h-4 w-4" /> Mở sổ điểm
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(gradebooks.data?.data ?? []).map((book) => (
              <button key={book.id} type="button" onClick={() => setSelectedId(book.id)} className={`rounded-md border px-3 py-2 text-left text-sm ${selectedId === book.id ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'}`}>
                <strong>{book.classroom_name}</strong> - {book.subject_name}
                <span className="ml-2 text-xs text-slate-500">{statusLabel[book.status]}</span>
              </button>
            ))}
          </div>
        </section>

        {!selectedId ? (
          <section className="border border-dashed border-slate-300 bg-white p-10 text-center">
            <BookOpenCheck className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">Chọn một sổ điểm hoặc mở sổ mới từ phân công giảng dạy.</p>
          </section>
        ) : detail.isLoading ? (
          <p className="p-8 text-center text-sm text-slate-500"><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />Đang tải sổ điểm...</p>
        ) : !selected ? (
          <p className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">Không thể tải sổ điểm.</p>
        ) : (
          <section className="min-w-0 border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
              <div>
                <h2 className="font-bold text-slate-950">{selected.classroom_name} - {selected.subject_name}</h2>
                <p className="mt-1 text-sm text-slate-500">{selected.academic_year_name} - {selected.semester_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">{statusLabel[selected.status]}</span>
                {selected.status === 'draft' && (
                  <button type="button" disabled={workflowMutation.isPending || dirtyKeys.length > 0 || saveMutation.isPending} onClick={() => workflowMutation.mutate('submit')} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    <Send className="h-4 w-4" /> Gửi duyệt
                  </button>
                )}
                {selected.status === 'locked' && (
                  <button type="button" disabled={workflowMutation.isPending} onClick={() => workflowMutation.mutate('request')} className="inline-flex items-center gap-2 rounded-md border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800">
                    <LockKeyhole className="h-4 w-4" /> Yêu cầu sửa điểm
                  </button>
                )}
              </div>
              {selected.status !== 'draft' && <p className="w-full text-sm text-slate-500">Sổ điểm đang ở chế độ chỉ đọc.</p>}
            </div>
            <div className="max-w-full overflow-auto">
              <table className="min-w-max border-collapse text-sm">
                <thead className="bg-slate-100 text-xs text-slate-600">
                  <tr>
                    <th className="sticky left-0 min-w-56 border-b border-r border-slate-200 bg-slate-100 px-3 py-3 text-left">Học sinh</th>
                    {selected.columns.map((column) => <th key={column.id} className="min-w-28 border-b border-r border-slate-200 px-2 py-3">{column.label}<span className="block font-normal">/{column.max_score}</span></th>)}
                    <th className="min-w-24 border-b border-slate-200 px-3 py-3">Tổng kết</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.students.map((student) => {
                    const total = selected.totals.find((item) => item.student_user_id === student.user_id);
                    return (
                      <tr key={student.user_id}>
                        <th className="sticky left-0 border-b border-r border-slate-200 bg-white px-3 py-2 text-left"><span className="block">{student.full_name}</span><span className="text-xs font-normal text-slate-500">{student.student_code || `ID ${student.user_id}`}</span></th>
                        {selected.columns.map((column) => {
                          const key = keyOf(student.user_id, column.id);
                          const cell = cells[key] ?? { state: 'scored' as const, score: '', version: 0 };
                          return (
                            <td key={column.id} className="border-b border-r border-slate-200 p-1.5">
                              <select value={cell.state} disabled={!writable || saveMutation.isPending} onChange={(event) => updateCell(student.user_id, column.id, { state: event.target.value as GradeScoreState, score: event.target.value === 'scored' ? cell.score : '' })} className="mb-1 w-full rounded border border-slate-200 px-1 py-1 text-xs disabled:bg-slate-100">
                                <option value="scored">Có điểm</option><option value="absent">Vắng</option><option value="exempt">Miễn</option>
                              </select>
                              {cell.state === 'scored' && <input type="number" min="0" max={column.max_score} step="0.01" value={cell.score} disabled={!writable || saveMutation.isPending} onChange={(event) => updateCell(student.user_id, column.id, { score: event.target.value })} className="w-full rounded border border-slate-300 px-2 py-2 text-center font-semibold disabled:bg-slate-100" />}
                            </td>
                          );
                        })}
                        <td className="border-b border-slate-200 px-3 py-2 text-center font-bold">{total?.final_score ?? '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {workflowMutation.isError && <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">{(workflowMutation.error as Error).message}</p>}
      </div>
    </TeacherPortalLayout>
  );
}
