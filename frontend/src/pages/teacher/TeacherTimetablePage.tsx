import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Clock3, MapPin, School } from 'lucide-react';
import { useMemo } from 'react';
import { TeacherPortalLayout } from '../../components/layout/TeacherPortalLayout';
import { getMyTeachingTimetable } from '../../services/timetable.service';
import { useAuth } from '../../stores/auth-context';
import type { PersonalTeachingTimetableItem } from '../../types/classroom';

const days = [
  { value: 1, label: 'Thứ 2' },
  { value: 2, label: 'Thứ 3' },
  { value: 3, label: 'Thứ 4' },
  { value: 4, label: 'Thứ 5' },
  { value: 5, label: 'Thứ 6' },
  { value: 6, label: 'Thứ 7' },
];

function SlotCard({ item }: { item: PersonalTeachingTimetableItem }) {
  return (
    <article className="border-l-4 border-emerald-500 bg-emerald-50 p-3 text-left">
      <p className="font-bold text-slate-950">{item.subject_name}</p>
      <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800">
        <School className="h-3.5 w-3.5" /> Lớp {item.classroom_name}
      </p>
      {item.room && (
        <p className="mt-1 flex items-center gap-1 text-xs text-slate-600">
          <MapPin className="h-3.5 w-3.5" /> Phòng {item.room}
        </p>
      )}
    </article>
  );
}

export function TeacherTimetablePage() {
  const { accessToken, user } = useAuth();
  const schedule = useQuery({
    queryKey: ['teacher', 'personal-timetable', user?.id],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      const response = await getMyTeachingTimetable(accessToken!);
      return response.data;
    },
  });

  const items = schedule.data ?? [];
  const shifts = [...new Map(items.map((item) => [
    item.shift_id,
    item.shift_name ?? `Ca ${item.shift_id}`,
  ])).entries()];
  const slots = useMemo(() => {
    const result = new Map<string, PersonalTeachingTimetableItem[]>();
    for (const item of items) {
      const key = `${item.shift_id}-${item.day_of_week}-${item.lesson_index}`;
      result.set(key, [...(result.get(key) ?? []), item]);
    }
    return result;
  }, [items]);

  return (
    <TeacherPortalLayout>
      <header className="border-b border-slate-200 pb-6">
        <p className="text-sm font-semibold text-emerald-700">Lịch giảng dạy cá nhân</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Thời khóa biểu của tôi</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Chỉ hiển thị các tiết đã phân công cho giáo viên đang đăng nhập, kèm lớp, môn học và phòng học.
        </p>
      </header>

      {schedule.isLoading ? (
        <div className="mt-6 h-72 animate-pulse border border-slate-200 bg-white" />
      ) : schedule.isError ? (
        <p className="mt-6 border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Không thể tải thời khóa biểu giảng dạy.
        </p>
      ) : items.length === 0 ? (
        <section className="mt-6 border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <CalendarDays className="mx-auto h-9 w-9 text-slate-400" />
          <h2 className="mt-3 font-bold text-slate-950">Chưa có tiết dạy được xếp lịch</h2>
          <p className="mt-2 text-sm text-slate-500">
            Phân công môn học cần được liên kết với tiết tương ứng trong thời khóa biểu lớp.
          </p>
        </section>
      ) : (
        <>
          <section className="mt-6 hidden gap-5 md:grid">
            {shifts.map(([shiftId, shiftName]) => {
              const shiftItems = items.filter((item) => item.shift_id === shiftId);
              const maxLesson = Math.max(5, ...shiftItems.map((item) => item.lesson_index));
              const lessons = Array.from({ length: maxLesson }, (_, index) => index + 1);
              return <div key={shiftId} className="overflow-x-auto border border-slate-200 bg-white shadow-sm">
              <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-3 font-bold text-emerald-800">{shiftName}</h2>
              <table className="min-w-[900px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-20 border-b border-r border-slate-200 bg-slate-50 p-3 text-left">Tiết</th>
                  {days.map((day) => (
                    <th key={day.value} className="border-b border-r border-slate-200 bg-slate-50 p-3 text-left last:border-r-0">
                      {day.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lessons.map((lesson) => (
                  <tr key={lesson}>
                    <td className="border-b border-r border-slate-200 p-3 align-top font-semibold text-slate-600">Tiết {lesson}</td>
                    {days.map((day) => (
                      <td key={day.value} className="min-w-36 border-b border-r border-slate-200 p-2 align-top last:border-r-0">
                        <div className="grid gap-2">
                          {(slots.get(`${shiftId}-${day.value}-${lesson}`) ?? []).map((item) => (
                            <SlotCard key={`${item.timetable_id}-${item.id}`} item={item} />
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              </table>
              </div>;
            })}
          </section>

          <section className="mt-6 grid gap-4 md:hidden">
            {days.map((day) => {
              const dayItems = items
                .filter((item) => item.day_of_week === day.value)
                .sort((a, b) => a.lesson_index - b.lesson_index);
              return (
                <article key={day.value} className="border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="font-bold text-slate-950">{day.label}</h2>
                  {dayItems.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-400">Không có tiết dạy.</p>
                  ) : (
                    <div className="mt-3 grid gap-3">
                      {dayItems.map((item) => (
                        <div key={`${item.timetable_id}-${item.id}`} className="grid grid-cols-[62px_minmax(0,1fr)] gap-3">
                          <span className="inline-flex flex-col items-start gap-1 pt-2 text-xs font-semibold text-emerald-700">
                            <span>{item.shift_name}</span>
                            <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> Tiết {item.lesson_index}</span>
                          </span>
                          <SlotCard item={item} />
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        </>
      )}
    </TeacherPortalLayout>
  );
}
