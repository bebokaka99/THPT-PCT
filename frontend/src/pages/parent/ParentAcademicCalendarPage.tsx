import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AcademicCalendarWorkspace } from '../../components/academic/AcademicCalendarWorkspace';
import { ParentPortalLayout } from '../../components/layout/ParentPortalLayout';
import { getMyGuardianChildren } from '../../services/guardian.service';
import { useAuth } from '../../stores/auth-context';

export function ParentAcademicCalendarPage() {
  const { accessToken } = useAuth();
  const [selectedId, setSelectedId] = useState<number>();
  const children = useQuery({
    queryKey: ['guardian', 'children', 'academic-calendar'],
    queryFn: () => getMyGuardianChildren(accessToken!),
    enabled: Boolean(accessToken),
  });
  const selected = children.data?.data.find((child) => child.student_user_id === selectedId)
    ?? children.data?.data[0];

  return <ParentPortalLayout>
    <div className="grid gap-5">
      {(children.data?.data.length ?? 0) > 1 && <label className="grid max-w-md gap-1 text-sm font-semibold text-slate-700">Chọn học sinh
        <select value={selected?.student_user_id ?? ''} onChange={(event) => setSelectedId(Number(event.target.value))} className="rounded-md border border-slate-300 bg-white px-3 py-2.5">
          {children.data?.data.map((child) => <option key={child.student_user_id} value={child.student_user_id}>{child.full_name} · {child.classroom_name ?? 'Chưa xếp lớp'}</option>)}
        </select>
      </label>}
      {children.isLoading ? <div className="h-48 animate-pulse border border-slate-200 bg-white" /> : children.isError ? <p className="border border-red-200 bg-red-50 p-5 text-sm text-red-700">Không thể tải liên kết học sinh.</p> : !selected ? <p className="border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">Chưa có học sinh được xác minh.</p> : <AcademicCalendarWorkspace role="guardian" studentId={selected.student_user_id} studentName={selected.full_name} />}
    </div>
  </ParentPortalLayout>;
}
