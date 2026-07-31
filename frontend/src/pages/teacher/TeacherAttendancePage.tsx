import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarCheck,
  CheckCheck,
  Clock3,
  Save,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { TeacherPortalLayout } from '../../components/layout/TeacherPortalLayout';
import * as attendanceApi from '../../services/attendance.service';
import { getAcademicPeriods } from '../../services/academicPeriod.service';
import { getMyTeachingAssignments } from '../../services/teachingAssignment.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type {
  AttendanceRecord,
  AttendanceSessionDetail,
  AttendanceStatus,
} from '../../types/attendance';

const statusStyles: Record<AttendanceStatus, string> = {
  present: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  excused: 'border-blue-200 bg-blue-50 text-blue-800',
  unexcused: 'border-red-200 bg-red-50 text-red-800',
  late: 'border-amber-200 bg-amber-50 text-amber-800',
};

function localToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date());
}

export function TeacherAttendancePage() {
  const { accessToken, user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedSession, setSelectedSession] =
    useState<AttendanceSessionDetail | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [correctionReason, setCorrectionReason] = useState('');
  const [form, setForm] = useState({
    assignmentId: '',
    sessionDate: localToday(),
    lessonIndex: '1',
    title: '',
  });

  const assignments = useQuery({
    queryKey: ['teacher', 'attendance-assignments', user?.id],
    queryFn: () =>
      getMyTeachingAssignments(accessToken!, {
        page: 1,
        limit: 100,
        status: 'active',
      }),
    enabled: Boolean(accessToken),
  });
  const periods = useQuery({
    queryKey: ['academic-periods'],
    queryFn: () => getAcademicPeriods(accessToken!),
    enabled: Boolean(accessToken),
  });
  const selectedAssignment = assignments.data?.data.find(
    (item) => item.id === Number(form.assignmentId),
  );
  const semester = periods.data
    ?.flatMap((year) => year.semesters)
    .find((item) => item.id === selectedAssignment?.semester_id);
  const sessions = useQuery({
    queryKey: ['teacher', 'attendance-sessions', user?.id],
    queryFn: () =>
      attendanceApi.getAttendanceSessions(accessToken!, {
        page: 1,
        limit: 50,
      }),
    enabled: Boolean(accessToken),
  });
  const mutation = useMutation({
    mutationFn: (action: () => Promise<AttendanceSessionDetail>) => action(),
    onSuccess: async (data) => {
      setSelectedSession(data);
      setRecords(data.records);
      await queryClient.invalidateQueries({
        queryKey: ['teacher', 'attendance-sessions'],
      });
    },
  });

  useEffect(() => {
    if (!semester) return;
    setForm((current) => ({
      ...current,
      sessionDate:
        current.sessionDate < semester.start_date ||
        current.sessionDate > semester.end_date
          ? semester.start_date
          : current.sessionDate,
    }));
  }, [semester]);

  const counts = useMemo(
    () =>
      records.reduce(
        (result, record) => {
          result[record.status] += 1;
          return result;
        },
        { present: 0, excused: 0, unexcused: 0, late: 0 },
      ),
    [records],
  );

  async function createSession(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !selectedAssignment) {
      toast.error('Vui lòng chọn phân công giảng dạy.');
      return;
    }
    const data = await mutation.mutateAsync(() =>
      attendanceApi.createAttendanceSession(accessToken, {
        classroom_id: selectedAssignment.classroom_id,
        semester_id: selectedAssignment.semester_id,
        subject_id: selectedAssignment.subject_id,
        teaching_assignment_id: selectedAssignment.id,
        session_date: form.sessionDate,
        lesson_index: Number(form.lessonIndex),
        title: form.title.trim() || undefined,
      }),
    );
    toast.success(`Đã mở điểm danh cho ${data.classroom_name}.`);
  }

  async function openSession(id: number) {
    if (!accessToken) return;
    const data = await attendanceApi.getAttendanceSession(accessToken, id);
    setSelectedSession(data);
    setRecords(data.records);
    setCorrectionReason('');
  }

  function updateRecord(
    studentUserId: number,
    patch: Partial<Pick<AttendanceRecord, 'status' | 'note'>>,
  ) {
    setRecords((current) =>
      current.map((record) =>
        record.student_user_id === studentUserId
          ? { ...record, ...patch }
          : record,
      ),
    );
  }

  async function save() {
    if (!accessToken || !selectedSession || records.length === 0) return;
    if (
      selectedSession.session_date < localToday() &&
      !correctionReason.trim()
    ) {
      toast.error('Vui lòng nhập lý do chỉnh sửa chuyên cần ngày cũ.');
      return;
    }
    await mutation.mutateAsync(() =>
      attendanceApi.saveAttendanceRecords(
        accessToken,
        selectedSession.id,
        records.map((record) => ({
          student_user_id: record.student_user_id,
          status: record.status,
          note: record.note,
        })),
        correctionReason.trim() || undefined,
      ),
    );
    toast.success('Đã lưu điểm danh toàn lớp.');
    setCorrectionReason('');
  }

  return (
    <TeacherPortalLayout>
      <div className="grid min-w-0 gap-6">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold text-emerald-700">
            Quản lý chuyên cần
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
            Điểm danh lớp học
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Mở phiên theo phân công, cập nhật cả lớp trong một lần lưu và lưu
            lịch sử chỉnh lý.
          </p>
        </header>

        <form
          onSubmit={(event) => void createSession(event)}
          className="border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="font-bold text-slate-950">Mở phiên điểm danh</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700 md:col-span-2">
              Phân công
              <select
                required
                value={form.assignmentId}
                onChange={(event) =>
                  setForm({ ...form, assignmentId: event.target.value })
                }
                className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal"
              >
                <option value="">Chọn lớp và môn</option>
                {assignments.data?.data.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.classroom_name} · {item.subject_name} ·{' '}
                    {item.semester_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Ngày học
              <input
                required
                type="date"
                min={semester?.start_date}
                max={semester?.end_date}
                value={form.sessionDate}
                onChange={(event) =>
                  setForm({ ...form, sessionDate: event.target.value })
                }
                className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Tiết
              <input
                required
                type="number"
                min="0"
                max="20"
                value={form.lessonIndex}
                onChange={(event) =>
                  setForm({ ...form, lessonIndex: event.target.value })
                }
                className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700 md:col-span-2">
              Ghi chú buổi học
              <input
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
                placeholder="Ví dụ: Kiểm tra giữa kỳ"
                className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>
          </div>
          <button
            disabled={mutation.isPending}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <CalendarCheck className="h-4 w-4" /> Mở điểm danh
          </button>
        </form>

        <section className="border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <h2 className="font-bold text-slate-950">Phiên gần đây</h2>
          </div>
          {sessions.isLoading ? (
            <div className="h-24 animate-pulse bg-slate-50" />
          ) : (sessions.data?.data.length ?? 0) === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              Chưa có phiên điểm danh trong phạm vi của thầy/cô.
            </p>
          ) : (
            <div className="grid divide-y divide-slate-100">
              {sessions.data?.data.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => void openSession(session.id)}
                  className="flex flex-col gap-3 p-4 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-950">
                      {session.classroom_name} ·{' '}
                      {session.subject_name || 'Sinh hoạt lớp'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {session.session_date} · Tiết {session.lesson_index} ·{' '}
                      {session.record_count} học sinh đã lưu
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-700">
                    Mở danh sách
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {selectedSession && (
          <section className="min-w-0 border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-700">
                    {selectedSession.session_date} · Tiết{' '}
                    {selectedSession.lesson_index}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">
                    {selectedSession.classroom_name} ·{' '}
                    {selectedSession.subject_name || 'Sinh hoạt lớp'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setRecords((current) =>
                      current.map((record) => ({
                        ...record,
                        status: 'present',
                      })),
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700"
                >
                  <CheckCheck className="h-4 w-4" /> Tất cả có mặt
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  Object.keys(
                    attendanceApi.attendanceStatusLabels,
                  ) as AttendanceStatus[]
                ).map((status) => (
                  <div
                    key={status}
                    className={`border p-3 ${statusStyles[status]}`}
                  >
                    <p className="text-xs font-semibold">
                      {attendanceApi.attendanceStatusLabels[status]}
                    </p>
                    <p className="mt-1 text-2xl font-bold">{counts[status]}</p>
                  </div>
                ))}
              </div>
            </div>

            {records.length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                <Users className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-3">Lớp chưa có học sinh tại ngày này.</p>
              </div>
            ) : (
              <div className="max-w-full overflow-x-auto">
                <table className="min-w-[880px] divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Học sinh</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map((record) => (
                      <tr key={record.student_user_id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-950">
                            {record.student_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {record.student_code || `ID ${record.student_user_id}`}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={record.status}
                            onChange={(event) =>
                              updateRecord(record.student_user_id, {
                                status: event.target.value as AttendanceStatus,
                              })
                            }
                            className={`rounded-md border px-3 py-2 font-semibold ${statusStyles[record.status]}`}
                          >
                            {Object.entries(
                              attendanceApi.attendanceStatusLabels,
                            ).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={record.note || ''}
                            onChange={(event) =>
                              updateRecord(record.student_user_id, {
                                note: event.target.value || null,
                              })
                            }
                            placeholder="Lý do hoặc ghi chú"
                            className="w-full rounded-md border border-slate-300 px-3 py-2"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-t border-slate-100 p-5">
              {selectedSession.session_date < localToday() && (
                <label className="mb-4 grid gap-1.5 text-sm font-semibold text-slate-700">
                  Lý do chỉnh sửa ngày cũ
                  <input
                    required
                    value={correctionReason}
                    onChange={(event) =>
                      setCorrectionReason(event.target.value)
                    }
                    placeholder="Nêu rõ lý do để lưu audit"
                    className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 font-normal"
                  />
                </label>
              )}
              <button
                type="button"
                disabled={mutation.isPending || records.length === 0}
                onClick={() => void save()}
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {mutation.isPending ? 'Đang lưu...' : 'Lưu điểm danh toàn lớp'}
              </button>
              <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                <Clock3 className="h-3.5 w-3.5" /> Mọi thay đổi được ghi lịch sử
                theo tài khoản thực hiện.
              </p>
            </div>
          </section>
        )}
      </div>
    </TeacherPortalLayout>
  );
}

