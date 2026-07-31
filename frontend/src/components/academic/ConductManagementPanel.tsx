import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, LockKeyhole, RotateCcw, Save, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getAcademicPeriods } from '../../services/academicPeriod.service';
import { getClassrooms } from '../../services/classroom.service';
import {
  approveConduct,
  getConductRoster,
  lockConduct,
  rejectConduct,
  saveStudentConduct,
  submitConduct,
} from '../../services/conduct.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type {
  ConductRating,
  ConductRecord,
  ConductRosterItem,
} from '../../types/conduct';

const ratingLabels: Record<ConductRating, string> = {
  good: 'Tốt',
  fair: 'Khá',
  pass: 'Đạt',
  not_pass: 'Chưa đạt',
};

const statusLabels = {
  draft: 'Bản nháp',
  submitted: 'Chờ duyệt',
  approved: 'Đã duyệt',
  locked: 'Đã khóa',
};

function ConductRow({
  allowReview,
  item,
  semesterId,
}: {
  allowReview: boolean;
  item: ConductRosterItem;
  semesterId: number;
}) {
  const { accessToken } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState<ConductRating>(
    item.record?.rating ?? 'good',
  );
  const [comment, setComment] = useState(item.record?.homeroom_comment ?? '');
  useEffect(() => {
    setRating(item.record?.rating ?? 'good');
    setComment(item.record?.homeroom_comment ?? '');
  }, [item.record]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['conduct', 'roster'] });
  };
  const save = useMutation({
    mutationFn: () =>
      saveStudentConduct(accessToken!, item.student_user_id, {
        semester_id: semesterId,
        rating,
        homeroom_comment: comment.trim() || null,
      }),
    onSuccess: async () => {
      await refresh();
      toast.success(`Đã lưu kết quả của ${item.student_name}.`);
    },
  });
  const workflow = useMutation({
    mutationFn: async ({
      action,
      record,
    }: {
      action: 'submit' | 'approve' | 'reject' | 'lock';
      record: ConductRecord;
    }) => {
      if (action === 'submit') return submitConduct(accessToken!, record.id);
      if (action === 'approve') return approveConduct(accessToken!, record.id);
      if (action === 'lock') return lockConduct(accessToken!, record.id);
      const reason = window.prompt('Nhập lý do trả lại giáo viên chủ nhiệm:');
      if (!reason?.trim()) throw new Error('Cần nhập lý do trả lại');
      return rejectConduct(accessToken!, record.id, reason.trim());
    },
    onSuccess: async () => {
      await refresh();
      toast.success('Đã cập nhật trạng thái kết quả rèn luyện.');
    },
  });
  const record = item.record;
  const editable = !record || record.status === 'draft';
  const error = save.error || workflow.error;

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <strong className="block text-slate-950">{item.student_name}</strong>
        <span className="text-xs text-slate-500">
          {item.student_code || 'Chưa có mã học sinh'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="grid min-w-32 gap-1 text-xs text-slate-600">
          <span>Có mặt: <strong>{item.attendance_summary.present}</strong></span>
          <span>Vắng phép: <strong>{item.attendance_summary.excused}</strong></span>
          <span>Vắng KP: <strong>{item.attendance_summary.unexcused}</strong></span>
          <span>Đi muộn: <strong>{item.attendance_summary.late}</strong></span>
        </div>
      </td>
      <td className="px-4 py-3">
        <select
          value={rating}
          disabled={!editable}
          onChange={(event) => setRating(event.target.value as ConductRating)}
          className="w-full min-w-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
        >
          {Object.entries(ratingLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </td>
      <td className="min-w-72 px-4 py-3">
        <textarea
          value={comment}
          disabled={!editable}
          maxLength={2000}
          rows={2}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Nhận xét ngắn của giáo viên chủ nhiệm"
          className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
        />
        {error && (
          <p className="mt-1 text-xs text-red-600">{(error as Error).message}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
          {record ? statusLabels[record.status] : 'Chưa nhập'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex min-w-36 flex-wrap justify-end gap-2">
          {editable && (
            <button
              type="button"
              disabled={save.isPending || workflow.isPending}
              onClick={() => save.mutate()}
              title="Lưu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
            </button>
          )}
          {record?.status === 'draft' && (
            <button
              type="button"
              disabled={workflow.isPending}
              onClick={() => workflow.mutate({ action: 'submit', record })}
              className="inline-flex items-center gap-1 rounded-md bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" /> Gửi duyệt
            </button>
          )}
          {allowReview && record?.status === 'submitted' && (
            <>
              <button
                type="button"
                onClick={() => workflow.mutate({ action: 'approve', record })}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-3 py-2 text-xs font-bold text-white"
              >
                <Check className="h-3.5 w-3.5" /> Duyệt
              </button>
              <button
                type="button"
                onClick={() => workflow.mutate({ action: 'reject', record })}
                className="inline-flex items-center gap-1 rounded-md border border-amber-300 px-3 py-2 text-xs font-bold text-amber-800"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Trả lại
              </button>
            </>
          )}
          {allowReview && record?.status === 'approved' && (
            <button
              type="button"
              onClick={() => workflow.mutate({ action: 'lock', record })}
              className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-2 text-xs font-bold text-white"
            >
              <LockKeyhole className="h-3.5 w-3.5" /> Khóa
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function ConductManagementPanel({
  allowReview = false,
}: {
  allowReview?: boolean;
}) {
  const { accessToken } = useAuth();
  const [classroomId, setClassroomId] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const periods = useQuery({
    queryKey: ['academic-periods', 'conduct'],
    queryFn: () => getAcademicPeriods(accessToken!),
    enabled: Boolean(accessToken),
  });
  const classrooms = useQuery({
    queryKey: ['classrooms', 'conduct', allowReview],
    queryFn: () => getClassrooms(accessToken!, { page: 1, limit: 100 }),
    enabled: Boolean(accessToken),
  });
  const semesters = useMemo(
    () =>
      (periods.data ?? []).flatMap((year) =>
        year.semesters.map((semester) => ({
          ...semester,
          year_name: year.name,
        })),
      ),
    [periods.data],
  );
  useEffect(() => {
    if (!classroomId && classrooms.data?.data[0]) {
      setClassroomId(String(classrooms.data.data[0].id));
    }
  }, [classroomId, classrooms.data]);
  useEffect(() => {
    if (!semesterId && semesters[0]) setSemesterId(String(semesters[0].id));
  }, [semesterId, semesters]);
  const roster = useQuery({
    queryKey: ['conduct', 'roster', classroomId, semesterId],
    queryFn: () =>
      getConductRoster(
        accessToken!,
        Number(classroomId),
        Number(semesterId),
      ),
    enabled: Boolean(accessToken && classroomId && semesterId),
  });

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Lớp học
          <select
            value={classroomId}
            onChange={(event) => setClassroomId(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
          >
            {(classrooms.data?.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} - {item.school_year}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Học kỳ
          <select
            value={semesterId}
            onChange={(event) => setSemesterId(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
          >
            {semesters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.year_name} - {item.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="overflow-hidden border border-slate-200 bg-white shadow-sm">
        {roster.isLoading ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Đang tải danh sách học sinh...
          </p>
        ) : roster.isError ? (
          <p className="bg-red-50 p-4 text-sm text-red-700">
            {(roster.error as Error).message}
          </p>
        ) : !roster.data?.data.length ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Chưa có học sinh hoặc bạn không phải giáo viên chủ nhiệm của lớp này.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Học sinh</th>
                  <th className="px-4 py-3">Chuyên cần tham khảo</th>
                  <th className="px-4 py-3">Xếp loại</th>
                  <th className="px-4 py-3">Nhận xét chủ nhiệm</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {roster.data.data.map((item) => (
                  <ConductRow
                    key={item.student_user_id}
                    allowReview={allowReview}
                    item={item}
                    semesterId={Number(semesterId)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
