import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { StudentRequestReviewPanel } from '../../components/academic/StudentRequestReviewPanel';
import { AdminLayout } from '../../components/layout/AdminLayout';
import * as requestApi from '../../services/studentRequest.service';
import { useAuth } from '../../stores/auth-context';

export function AdminStudentRequestsPage() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'homeroom' | 'admin'>('admin');
  const [slaDays, setSlaDays] = useState(5);
  const [requiresAttachment, setRequiresAttachment] = useState(false);
  const types = useQuery({
    queryKey: ['student-requests', 'types', 'admin'],
    queryFn: async () =>
      (await requestApi.getStudentRequestTypes(accessToken!)).data,
    enabled: Boolean(accessToken),
  });
  const createType = useMutation({
    mutationFn: () =>
      requestApi.createStudentRequestType(accessToken!, {
        code,
        name,
        reviewer_scope: scope,
        requires_attachment: requiresAttachment,
        sla_days: slaDays,
        is_active: true,
      }),
    onSuccess: async () => {
      setCode('');
      setName('');
      await queryClient.invalidateQueries({
        queryKey: ['student-requests', 'types'],
      });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    createType.mutate();
  }

  return (
    <AdminLayout>
      <div className="grid gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-700">Dịch vụ học sinh</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              Đơn và yêu cầu học sinh
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Tiếp nhận yêu cầu cấp trường, theo dõi SLA và lưu vết quyết định.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings((current) => !current)}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700"
          >
            <Settings2 className="h-4 w-4" /> Cấu hình loại đơn
          </button>
        </header>
        {showSettings && (
          <section className="grid gap-4 border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[340px_minmax(0,1fr)]">
            <form onSubmit={submit} className="grid gap-3">
              <h2 className="font-bold text-slate-950">Thêm loại đơn</h2>
              <input
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Mã loại đơn"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Tên loại đơn"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={scope}
                  onChange={(event) =>
                    setScope(event.target.value as 'homeroom' | 'admin')
                  }
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="admin">Quản trị viên</option>
                  <option value="homeroom">GVCN</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={slaDays}
                  onChange={(event) => setSlaDays(Number(event.target.value))}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={requiresAttachment}
                  onChange={(event) =>
                    setRequiresAttachment(event.target.checked)
                  }
                />
                Bắt buộc tệp minh chứng
              </label>
              <button
                disabled={createType.isPending}
                className="rounded-md bg-blue-700 px-3 py-2 text-sm font-bold text-white"
              >
                Lưu loại đơn
              </button>
            </form>
            <div>
              <h2 className="font-bold text-slate-950">Loại đơn hiện có</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {types.data?.map((item) => (
                  <div key={item.id} className="border border-slate-200 p-3">
                    <p className="font-bold text-slate-950">{item.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.code} · {item.reviewer_scope === 'admin' ? 'Cấp trường' : 'GVCN'} · SLA {item.sla_days} ngày
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
        <StudentRequestReviewPanel />
      </div>
    </AdminLayout>
  );
}
