import { useQuery } from '@tanstack/react-query';
import { Clock3, Plus, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import {
  createSchoolShift,
  getSchoolShifts,
  updateSchoolShift,
} from '../../services/timetable.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type { SchoolShift } from '../../types/classroom';

const newPeriods = Array.from({ length: 5 }, (_, index) => ({
  period_index: index + 1,
  starts_at: `${String(7 + index).padStart(2, '0')}:00`,
  ends_at: `${String(7 + index).padStart(2, '0')}:45`,
  sort_order: index + 1,
}));

export function AdminTimetableSettingsPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const query = useQuery({
    queryKey: ['school-shifts'],
    queryFn: () => getSchoolShifts(accessToken!),
    enabled: Boolean(accessToken),
  });
  const [shifts, setShifts] = useState<SchoolShift[]>([]);
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    if (query.data) setShifts(query.data.data);
  }, [query.data]);

  function updateShift(id: number, updater: (shift: SchoolShift) => SchoolShift) {
    setShifts((current) => current.map((shift) => shift.id === id ? updater(shift) : shift));
  }

  async function save(shift: SchoolShift) {
    if (!accessToken) return;
    setSavingId(shift.id);
    try {
      const input = {
        code: shift.code.trim(),
        name: shift.name.trim(),
        sort_order: shift.sort_order,
        is_active: shift.is_active,
        periods: shift.periods,
      };
      if (shift.id > 0) await updateSchoolShift(accessToken, shift.id, input);
      else await createSchoolShift(accessToken, input);
      toast.success('Đã lưu cấu hình ca học.');
      await query.refetch();
    } finally {
      setSavingId(null);
    }
  }

  function addShift() {
    const temporaryId = -Date.now();
    setShifts((current) => [...current, {
      id: temporaryId,
      code: `shift-${current.length + 1}`,
      name: `Ca học ${current.length + 1}`,
      sort_order: current.length + 1,
      is_active: true,
      created_at: '',
      updated_at: '',
      periods: newPeriods.map((period) => ({ ...period })),
    }]);
  }

  return (
    <AdminLayout>
      <div className="grid gap-6">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold text-blue-700">Vận hành thời khóa biểu</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Ca học và giờ tiết</h1>
          <p className="mt-2 text-sm text-slate-600">Cấu hình số ca, số tiết và khung giờ áp dụng cho toàn trường.</p>
        </header>

        <div className="flex justify-end">
          <button type="button" onClick={addShift} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Thêm ca học</button>
        </div>

        {query.isLoading ? <div className="h-56 animate-pulse bg-slate-100" /> : (
          <div className="grid gap-5">
            {shifts.map((shift) => (
              <section key={shift.id} className="border border-slate-200 bg-white shadow-sm">
                <div className="grid gap-3 border-b border-slate-200 p-5 md:grid-cols-[1fr_1fr_100px_auto]">
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">Mã ca<input value={shift.code} onChange={(event) => updateShift(shift.id, (current) => ({ ...current, code: event.target.value }))} className="rounded border border-slate-300 px-3 py-2 font-normal" /></label>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">Tên hiển thị<input value={shift.name} onChange={(event) => updateShift(shift.id, (current) => ({ ...current, name: event.target.value }))} className="rounded border border-slate-300 px-3 py-2 font-normal" /></label>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">Thứ tự<input type="number" min="0" value={shift.sort_order} onChange={(event) => updateShift(shift.id, (current) => ({ ...current, sort_order: Number(event.target.value) }))} className="rounded border border-slate-300 px-3 py-2 font-normal" /></label>
                  <label className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={shift.is_active} onChange={(event) => updateShift(shift.id, (current) => ({ ...current, is_active: event.target.checked }))} />Đang dùng</label>
                </div>
                <div className="overflow-x-auto p-5">
                  <table className="min-w-[560px] w-full text-sm">
                    <thead><tr className="border-b text-left text-slate-500"><th className="pb-2">Tiết</th><th className="pb-2">Bắt đầu</th><th className="pb-2">Kết thúc</th></tr></thead>
                    <tbody>{shift.periods.map((period, periodIndex) => <tr key={period.period_index} className="border-b last:border-b-0"><td className="py-3 font-semibold"><span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-blue-700" />Tiết {period.period_index}</span></td><td className="py-3"><input type="time" value={period.starts_at} onChange={(event) => updateShift(shift.id, (current) => ({ ...current, periods: current.periods.map((item, index) => index === periodIndex ? { ...item, starts_at: event.target.value } : item) }))} className="rounded border border-slate-300 px-3 py-2" /></td><td className="py-3"><input type="time" value={period.ends_at} onChange={(event) => updateShift(shift.id, (current) => ({ ...current, periods: current.periods.map((item, index) => index === periodIndex ? { ...item, ends_at: event.target.value } : item) }))} className="rounded border border-slate-300 px-3 py-2" /></td></tr>)}</tbody>
                  </table>
                </div>
                <div className="flex justify-end border-t border-slate-100 p-4"><button type="button" onClick={() => void save(shift)} disabled={savingId === shift.id} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Save className="h-4 w-4" />{savingId === shift.id ? 'Đang lưu...' : 'Lưu ca học'}</button></div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
