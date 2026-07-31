import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarCheck, Printer, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ReportCardView } from '../../components/academic/ReportCardView';
import { TimetablePrintView } from '../../components/classrooms/TimetablePrintView';
import { ParentPortalLayout } from '../../components/layout/ParentPortalLayout';
import { getGuardianStudentSummary } from '../../services/guardian.service';
import { useAuth } from '../../stores/auth-context';

const statusLabels = {
  present: 'Có mặt',
  excused: 'Vắng có phép',
  unexcused: 'Vắng không phép',
  late: 'Đi trễ',
} as const;

export function ParentStudentPage() {
  const { id } = useParams();
  const studentId = Number(id);
  const { accessToken } = useAuth();
  const summary = useQuery({
    queryKey: ['guardian', 'student-summary', studentId],
    queryFn: () => getGuardianStudentSummary(accessToken!, studentId),
    enabled: Boolean(accessToken && Number.isInteger(studentId) && studentId > 0),
    retry: false,
  });

  return (
    <ParentPortalLayout>
      <div className="grid gap-6">
        <header className="no-print flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <Link
              to="/parent"
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"
            >
              <ArrowLeft className="h-4 w-4" /> Danh sách học sinh
            </Link>
            <h1 className="mt-3 text-2xl font-bold text-slate-950 sm:text-3xl">
              {summary.data?.data.child.full_name || 'Thông tin học sinh'}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {summary.data?.data.child.classroom_name || 'Chưa xếp lớp'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!summary.data?.data.transcript}
            className="inline-flex items-center gap-2 rounded-md bg-blue-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            <Printer className="h-4 w-4" /> In phiếu kết quả
          </button>
        </header>

        {summary.isLoading ? (
          <p className="border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Đang tải dữ liệu học sinh...
          </p>
        ) : summary.isError ? (
          <div className="border border-red-200 bg-red-50 p-8 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-red-300" />
            <h2 className="mt-3 font-bold text-red-900">
              Không có quyền xem học sinh này
            </h2>
            <p className="mt-2 text-sm text-red-700">
              Liên kết chưa được xác minh hoặc đã bị thu hồi.
            </p>
          </div>
        ) : summary.data?.data ? (
          <>
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ['Tổng buổi', summary.data.data.attendance.summary.total],
                ['Có mặt', summary.data.data.attendance.summary.present],
                ['Có phép', summary.data.data.attendance.summary.excused],
                ['Không phép', summary.data.data.attendance.summary.unexcused],
                ['Đi trễ', summary.data.data.attendance.summary.late],
              ].map(([label, value]) => (
                <div key={label} className="border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    {label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
                </div>
              ))}
            </section>

            <section className="border border-slate-200 bg-white shadow-sm">
              {summary.data.data.transcript ? (
                <ReportCardView transcript={summary.data.data.transcript} />
              ) : (
                <div className="p-8 text-center">
                  <h2 className="font-bold text-slate-950">
                    Chưa có phiếu kết quả được công bố
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Điểm nháp và kết quả chưa duyệt không hiển thị tại đây.
                  </p>
                </div>
              )}
            </section>

            {summary.data.data.timetable && summary.data.data.child.classroom_name && (
              <TimetablePrintView
                classroom={{ name: summary.data.data.child.classroom_name }}
                timetable={summary.data.data.timetable}
              />
            )}

            <section className="border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-blue-700" />
                <h2 className="font-bold text-slate-950">Chuyên cần gần đây</h2>
              </div>
              {summary.data.data.attendance.data.length ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Ngày</th>
                        <th className="px-3 py-3">Môn</th>
                        <th className="px-3 py-3">Tiết</th>
                        <th className="px-3 py-3">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summary.data.data.attendance.data.slice(0, 20).map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-3">{item.session_date}</td>
                          <td className="px-3 py-3">
                            {item.subject_name || 'Sinh hoạt lớp'}
                          </td>
                          <td className="px-3 py-3">{item.lesson_index}</td>
                          <td className="px-3 py-3 font-semibold text-slate-700">
                            {statusLabels[item.status]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  Chưa có dữ liệu chuyên cần.
                </p>
              )}
            </section>
          </>
        ) : null}
      </div>
    </ParentPortalLayout>
  );
}
