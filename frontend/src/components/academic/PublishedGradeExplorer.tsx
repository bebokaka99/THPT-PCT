import { BookOpenCheck, CircleSlash2 } from 'lucide-react';
import type { StudentPublishedGrade } from '../../types/gradebook';

const stateLabels = {
  scored: 'Đã chấm',
  absent: 'Vắng',
  exempt: 'Miễn',
  unscored: 'Chưa chấm',
} as const;

function scoreValue(score: StudentPublishedGrade['scores'][number]) {
  if (score.state === 'absent') return 'Vắng';
  if (score.state === 'exempt') return 'Miễn';
  if (score.state === 'unscored' || score.score === null) return '—';
  return score.score.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

function stateTone(state: StudentPublishedGrade['scores'][number]['state']) {
  if (state === 'scored') return 'border-blue-200 bg-blue-50 text-blue-950';
  if (state === 'absent') return 'border-red-200 bg-red-50 text-red-800';
  if (state === 'exempt') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-500';
}

function ComponentScores({ grade }: { grade: StudentPublishedGrade }) {
  return (
    <div className="flex min-w-[320px] flex-wrap gap-2">
      {grade.scores.map((score) => (
        <div
          key={score.column_id}
          className={`min-w-[92px] border px-3 py-2 text-center ${stateTone(score.state)}`}
          title={`${score.category_name} - ${stateLabels[score.state]}`}
        >
          <p className="max-w-32 truncate text-[11px] font-semibold">{score.label}</p>
          <p className="mt-1 text-base font-bold">{scoreValue(score)}</p>
          <p className="mt-0.5 text-[10px] opacity-70">/{score.max_score}</p>
        </div>
      ))}
    </div>
  );
}

export function PublishedGradeExplorer({
  grades,
  isLoading,
  isError,
}: {
  grades: StudentPublishedGrade[];
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) return <div className="h-44 animate-pulse bg-slate-50" />;
  if (isError) {
    return <p className="p-6 text-sm text-red-700">Không thể tải chi tiết bảng điểm.</p>;
  }
  if (!grades.length) {
    return (
      <div className="px-6 py-12 text-center">
        <CircleSlash2 className="mx-auto h-9 w-9 text-slate-300" />
        <p className="mt-3 font-semibold text-slate-700">Không có kết quả phù hợp</p>
        <p className="mt-1 text-sm text-slate-500">
          Chưa có sổ điểm được duyệt hoặc khóa trong phạm vi đã chọn.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 p-4 md:hidden">
        {grades.map((grade) => (
          <article key={grade.id} className="border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-slate-950">{grade.subject_name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {grade.classroom_name} · {grade.semester_name} · {grade.academic_year_name}
                </p>
              </div>
              <span className="shrink-0 rounded-md bg-blue-50 px-3 py-2 text-lg font-bold text-blue-800">
                {grade.final_score ?? '—'}
              </span>
            </div>
            <div className="mt-4 overflow-x-auto pb-1"><ComponentScores grade={grade} /></div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span>{grade.teacher_name}</span>
              <span>Thang điểm {grade.score_scale}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Môn học</th>
              <th className="px-5 py-3">Điểm thành phần</th>
              <th className="px-5 py-3 text-center">Tổng kết</th>
              <th className="px-5 py-3">Giáo viên</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {grades.map((grade) => (
              <tr key={grade.id} className="align-top">
                <td className="px-5 py-4">
                  <p className="font-bold text-slate-950">{grade.subject_name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {grade.classroom_name} · {grade.semester_name}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Thang điểm {grade.score_scale}</p>
                </td>
                <td className="px-5 py-4"><ComponentScores grade={grade} /></td>
                <td className="px-5 py-4 text-center">
                  <span className="inline-flex h-12 min-w-14 items-center justify-center rounded-md bg-blue-50 px-3 text-xl font-bold text-blue-800">
                    {grade.final_score ?? '—'}
                  </span>
                </td>
                <td className="px-5 py-4 text-slate-600">{grade.teacher_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><BookOpenCheck className="h-3.5 w-3.5 text-blue-700" /> Trạng thái:</span>
        {Object.entries(stateLabels).map(([state, label]) => <span key={state}>{label}</span>)}
      </div>
    </>
  );
}
