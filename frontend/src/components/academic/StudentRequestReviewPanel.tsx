import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Download,
  Eye,
  LoaderCircle,
  Search,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import * as requestApi from '../../services/studentRequest.service';
import { useAuth } from '../../stores/auth-context';
import type {
  StudentRequest,
  StudentRequestStatus,
} from '../../types/student-request';

const labels: Record<StudentRequestStatus, string> = {
  draft: 'Bản nháp',
  pending: 'Chờ tiếp nhận',
  in_review: 'Đang xử lý',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  cancelled: 'Đã hủy',
};

export function StudentRequestReviewPanel() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StudentRequestStatus | ''>('');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const requests = useQuery({
    queryKey: ['student-requests', 'review', status, q],
    queryFn: () =>
      requestApi.getStudentRequests(accessToken!, {
        page: 1,
        limit: 50,
        status,
        q,
      }),
    enabled: Boolean(accessToken),
  });
  const detail = useQuery({
    queryKey: ['student-requests', 'detail', selectedId],
    queryFn: async () =>
      (await requestApi.getStudentRequest(accessToken!, selectedId!)).data,
    enabled: Boolean(accessToken && selectedId),
  });
  const history = useQuery({
    queryKey: ['student-requests', 'history', selectedId],
    queryFn: async () =>
      (await requestApi.getStudentRequestHistory(accessToken!, selectedId!))
        .data,
    enabled: Boolean(accessToken && selectedId),
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['student-requests', 'review'],
      }),
      queryClient.invalidateQueries({
        queryKey: ['student-requests', 'detail', selectedId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['student-requests', 'history', selectedId],
      }),
    ]);
  };
  const transition = useMutation({
    mutationFn: async (input: {
      action: 'start' | 'approve' | 'reject';
      item: StudentRequest;
    }) => {
      if (input.action === 'start') {
        return requestApi.startStudentRequestReview(
          accessToken!,
          input.item.id,
        );
      }
      if (reason.trim().length < 3) {
        throw new Error('Vui lòng nhập lý do ít nhất 3 ký tự.');
      }
      return input.action === 'approve'
        ? requestApi.approveStudentRequest(
            accessToken!,
            input.item.id,
            reason.trim(),
          )
        : requestApi.rejectStudentRequest(
            accessToken!,
            input.item.id,
            reason.trim(),
          );
    },
    onSuccess: async () => {
      setReason('');
      await refresh();
    },
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-[1fr_180px]">
          <label className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Tìm học sinh hoặc tiêu đề đơn"
              className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm"
            />
          </label>
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as StudentRequestStatus | '')
            }
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {requests.isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Đang tải đơn...
          </div>
        ) : requests.isError ? (
          <p className="p-6 text-sm text-red-700">Không thể tải danh sách đơn.</p>
        ) : requests.data?.data.length ? (
          <div className="divide-y divide-slate-100">
            {requests.data.data.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`flex w-full items-start justify-between gap-4 p-4 text-left hover:bg-slate-50 ${
                  selectedId === item.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-950">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {item.student_name}
                    {item.student_code ? ` · ${item.student_code}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.request_type_name} ·{' '}
                    {new Date(item.created_at).toLocaleDateString('vi-VN')}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                  {labels[item.status]}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="p-8 text-center text-sm text-slate-500">
            Không có đơn phù hợp phạm vi xét duyệt.
          </p>
        )}
      </section>

      <aside className="border border-slate-200 bg-white shadow-sm">
        {!selectedId ? (
          <div className="p-8 text-center text-sm text-slate-500">
            <Eye className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            Chọn một đơn để xem chi tiết.
          </div>
        ) : detail.isLoading ? (
          <p className="p-6 text-sm text-slate-500">Đang tải chi tiết...</p>
        ) : detail.isError || !detail.data ? (
          <p className="p-6 text-sm text-red-700">Không thể mở đơn này.</p>
        ) : (
          <div className="grid gap-5 p-5">
            <div>
              <p className="text-xs font-bold uppercase text-blue-700">
                {detail.data.request_type_name}
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">
                {detail.data.title}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {detail.data.student_name} · {labels[detail.data.status]}
              </p>
            </div>
            {detail.data.content && (
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {detail.data.content}
              </p>
            )}
            {detail.data.attachments?.length ? (
              <div>
                <h3 className="text-sm font-bold text-slate-950">Tệp đính kèm</h3>
                <div className="mt-2 grid gap-2">
                  {detail.data.attachments.map((attachment) => (
                    <button
                      key={attachment.id}
                      type="button"
                      onClick={() =>
                        requestApi.downloadStudentRequestAttachment(
                          accessToken!,
                          attachment,
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-left text-sm font-semibold text-blue-700"
                    >
                      <Download className="h-4 w-4" />
                      {attachment.original_name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {['pending', 'in_review'].includes(detail.data.status) && (
              <div className="grid gap-3 border-t border-slate-100 pt-4">
                {detail.data.status === 'pending' && (
                  <button
                    type="button"
                    disabled={transition.isPending}
                    onClick={() =>
                      transition.mutate({
                        action: 'start',
                        item: detail.data!,
                      })
                    }
                    className="rounded-md border border-blue-300 px-3 py-2 text-sm font-bold text-blue-700"
                  >
                    Tiếp nhận xử lý
                  </button>
                )}
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  placeholder="Lý do hoặc ghi chú quyết định"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={transition.isPending}
                    onClick={() =>
                      transition.mutate({
                        action: 'approve',
                        item: detail.data!,
                      })
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-bold text-white"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Duyệt
                  </button>
                  <button
                    type="button"
                    disabled={transition.isPending}
                    onClick={() =>
                      transition.mutate({
                        action: 'reject',
                        item: detail.data!,
                      })
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-red-700 px-3 py-2 text-sm font-bold text-white"
                  >
                    <XCircle className="h-4 w-4" /> Từ chối
                  </button>
                </div>
                {transition.error && (
                  <p className="text-sm text-red-700">
                    {transition.error.message}
                  </p>
                )}
              </div>
            )}
            {detail.data.decision_reason && (
              <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                <strong>Kết quả:</strong> {detail.data.decision_reason}
              </div>
            )}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-sm font-bold text-slate-950">Lịch sử xử lý</h3>
              <div className="mt-2 grid gap-2 text-xs text-slate-600">
                {history.data?.map((entry) => (
                  <p key={entry.id}>
                    {new Date(entry.created_at).toLocaleString('vi-VN')} ·{' '}
                    {entry.actor_name || 'Hệ thống'} · {entry.action}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
