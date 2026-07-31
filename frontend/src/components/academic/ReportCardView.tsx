import type { StudentTranscript } from '../../types/transcript';

const conductLabels = {
  good: 'Tốt',
  fair: 'Khá',
  pass: 'Đạt',
  not_pass: 'Chưa đạt',
};

export function ReportCardView({ transcript }: { transcript: StudentTranscript }) {
  return (
    <article
      id="report-card"
      className="mx-auto w-full max-w-[210mm] bg-white p-5 text-slate-950 sm:p-8 print:max-w-none print:p-0"
    >
      <header className="border-b-2 border-blue-900 pb-5 text-center">
        <p className="text-xs font-bold uppercase text-blue-800">
          Sở Giáo dục và Đào tạo Bình Thuận
        </p>
        <h1 className="mt-1 text-xl font-extrabold uppercase sm:text-2xl">
          Trường THPT Phan Chu Trinh - Phan Thiết
        </h1>
        <h2 className="mt-5 text-lg font-bold uppercase">
          Phiếu kết quả học tập
        </h2>
        <p className="mt-1 text-sm">
          {transcript.period.semester_name} - Năm học{' '}
          {transcript.period.academic_year_name}
        </p>
      </header>

      <section className="grid gap-2 border-b border-slate-300 py-5 text-sm sm:grid-cols-2">
        <p><strong>Học sinh:</strong> {transcript.student.full_name}</p>
        <p><strong>Mã học sinh:</strong> {transcript.student.student_code || 'Chưa cập nhật'}</p>
        <p><strong>Lớp:</strong> {transcript.classroom.name}</p>
        <p>
          <strong>Trạng thái:</strong>{' '}
          {transcript.source === 'snapshot' ? 'Đã chốt dữ liệu' : 'Kết quả đã duyệt'}
        </p>
      </section>

      <div className="mt-5 overflow-hidden border border-slate-400">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-blue-50">
            <tr>
              <th className="w-14 border-b border-r border-slate-400 px-3 py-2 text-center">STT</th>
              <th className="border-b border-r border-slate-400 px-3 py-2 text-left">Môn học</th>
              <th className="w-32 border-b border-slate-400 px-3 py-2 text-center">Điểm tổng kết</th>
            </tr>
          </thead>
          <tbody>
            {transcript.subjects.map((subject, index) => (
              <tr key={subject.subject_id}>
                <td className="border-b border-r border-slate-300 px-3 py-2 text-center">{index + 1}</td>
                <td className="border-b border-r border-slate-300 px-3 py-2">
                  <strong>{subject.subject_name}</strong>
                  <span className="ml-2 text-xs text-slate-500">{subject.subject_code}</span>
                </td>
                <td className="border-b border-slate-300 px-3 py-2 text-center font-bold">
                  {subject.final_score ?? '-'} / {subject.score_scale}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50">
            <tr>
              <td colSpan={2} className="border-r border-slate-400 px-3 py-3 text-right font-bold">
                Điểm trung bình các môn đã hoàn thành
              </td>
              <td className="px-3 py-3 text-center text-lg font-extrabold text-blue-900">
                {transcript.overall_average ?? '-'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <section className="mt-5 grid gap-3 border border-slate-300 p-4 text-sm">
        <p>
          <strong>Kết quả rèn luyện:</strong>{' '}
          {transcript.conduct
            ? conductLabels[transcript.conduct.rating]
            : 'Chưa công bố'}
        </p>
        <p>
          <strong>Nhận xét của giáo viên chủ nhiệm:</strong>{' '}
          {transcript.conduct?.homeroom_comment || 'Chưa có nhận xét'}
        </p>
      </section>

      {transcript.subjects.length === 0 && (
        <p className="border-x border-b border-slate-300 p-6 text-center text-sm text-slate-500">
          Chưa có môn học nào được duyệt trong kỳ này.
        </p>
      )}

      <footer className="mt-10 grid grid-cols-2 gap-8 text-center text-sm">
        <div><strong>Giáo viên chủ nhiệm</strong><p className="mt-16 text-xs text-slate-500">(Ký và ghi rõ họ tên)</p></div>
        <div><strong>Ban giám hiệu</strong><p className="mt-16 text-xs text-slate-500">(Ký tên, đóng dấu)</p></div>
      </footer>
      <p className="mt-8 border-t border-slate-200 pt-3 text-center text-[11px] text-slate-500">
        Phiếu được tạo từ dữ liệu điểm đã duyệt của nhà trường.
      </p>
    </article>
  );
}
