import { useQuery } from '@tanstack/react-query';
import { Activity, Database, HardDrive, RefreshCw, Server, TriangleAlert } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getOperationalHealth } from '../../services/operations.service';
import { useAuth } from '../../stores/auth-context';

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function HealthCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'blue',
}: {
  icon: typeof Database;
  label: string;
  value: string;
  detail: string;
  tone?: 'blue' | 'emerald' | 'amber' | 'slate';
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-xl font-bold text-slate-950">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{detail}</p>
        </div>
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-md ${tones[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

export function AdminSystemHealthPage() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['admin', 'system-health'],
    queryFn: () => getOperationalHealth(accessToken!),
    enabled: Boolean(accessToken),
    refetchInterval: 30_000,
  });
  const data = query.data;

  return (
    <AdminLayout>
      <section className="grid gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Vận hành</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Sức khỏe hệ thống</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Theo dõi API, cơ sở dữ liệu, pool kết nối, bộ nhớ và file upload. Không hiển thị dữ liệu nghiệp vụ hoặc bí mật.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
            className="inline-flex items-center justify-center gap-2 rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-700 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
            Làm mới
          </button>
        </header>

        {query.isLoading && <div className="h-40 animate-pulse border border-slate-200 bg-white" />}
        {query.isError && (
          <div className="flex items-start gap-3 border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Không tải được trạng thái hệ thống.</p>
              <p className="mt-1">Kiểm tra token admin và endpoint /api/operations/health.</p>
            </div>
          </div>
        )}

        {data && (
          <>
            <div className={`flex items-center justify-between gap-4 border p-4 ${data.status === 'ok' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${data.status === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <div>
                  <p className="font-semibold text-slate-950">
                    {data.status === 'ok' ? 'Hệ thống đang ổn định' : 'Hệ thống cần theo dõi'}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">Môi trường: {data.environment} · Cập nhật {formatDate(data.generated_at)}</p>
                </div>
              </div>
              <span className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 sm:block">Tự làm mới 30 giây</span>
            </div>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <HealthCard
                icon={Database}
                label="Cơ sở dữ liệu"
                value={data.database.status === 'connected' ? 'Connected' : 'Disconnected'}
                detail={`${data.database.latency_ms} ms · pool ${data.database.pool.total}/${data.database.pool.max}`}
                tone={data.database.status === 'connected' ? 'emerald' : 'amber'}
              />
              <HealthCard
                icon={Activity}
                label="API requests"
                value={`${data.api.requests.finished}`}
                detail={`${data.api.requests.average_duration_ms} ms trung bình · ${data.api.requests.status_counts['5xx']} lỗi 5xx`}
                tone={data.api.requests.status_counts['5xx'] > 0 ? 'amber' : 'blue'}
              />
              <HealthCard
                icon={Server}
                label="Process"
                value={`${Math.floor(data.process.uptime_seconds / 3600)} giờ uptime`}
                detail={`${data.process.node_version} · heap ${formatBytes(data.process.memory.heap_used_bytes)}`}
                tone="slate"
              />
              <HealthCard
                icon={HardDrive}
                label="Uploads"
                value={`${data.storage.public_uploads.files + data.storage.private_uploads.files} files`}
                detail={`${formatBytes(data.storage.public_uploads.bytes + data.storage.private_uploads.bytes)} đang sử dụng`}
                tone="blue"
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="font-bold text-slate-950">Request và connection pool</h2>
                  <p className="mt-1 text-sm text-slate-500">Chỉ số tổng hợp từ lúc process khởi động.</p>
                </div>
                <dl className="grid gap-4 p-5 sm:grid-cols-2">
                  <Metric label="Đang xử lý" value={`${data.api.requests.active}`} />
                  <Metric label="Request bị ngắt" value={`${data.api.requests.aborted}`} />
                  <Metric label="Request chậm trên 1s" value={`${data.api.requests.slow_requests_over_1s}`} />
                  <Metric label="Pool đang chờ" value={`${data.database.pool.waiting}`} />
                  <Metric label="Pool utilization" value={`${data.database.pool.utilization_percent}%`} />
                  <Metric label="Lâu nhất" value={`${data.api.requests.max_duration_ms} ms`} />
                  <Metric label="P95 trong 5 phút" value={`${data.api.requests.recent_5m.p95_duration_ms} ms`} />
                </dl>
              </div>

              <div className="border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="font-bold text-slate-950">Lỗi kỹ thuật gần đây</h2>
                  <p className="mt-1 text-sm text-slate-500">Chỉ lưu request ID, route và loại lỗi; không lưu message hoặc payload.</p>
                </div>
                {data.api.recent_errors.length === 0 ? (
                  <p className="p-8 text-center text-sm text-slate-500">Chưa có lỗi 5xx trong bộ nhớ process.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {data.api.recent_errors.slice(0, 8).map((error) => (
                      <div key={`${error.request_id}-${error.occurred_at}`} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{error.path}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">{error.error_name} · {error.request_id}</p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-red-600">{error.status_code}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </section>
    </AdminLayout>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-100 bg-slate-50 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-950">{value}</dd>
    </div>
  );
}
