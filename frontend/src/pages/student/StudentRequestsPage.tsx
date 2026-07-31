import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FilePlus2, Paperclip, Send, XCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { StudentPortalLayout } from '../../components/layout/StudentPortalLayout';
import * as requestApi from '../../services/studentRequest.service';
import { useAuth } from '../../stores/auth-context';
import type { StudentRequestStatus } from '../../types/student-request';

const labels: Record<StudentRequestStatus, string> = {
  draft: 'Bản nháp',
  pending: 'Chờ xử lý',
  in_review: 'Đang xử lý',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  cancelled: 'Đã hủy',
};

export function StudentRequestsPage() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [typeId, setTypeId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const types = useQuery({
    queryKey: ['student-requests', 'types'],
    queryFn: async () =>
      (await requestApi.getStudentRequestTypes(accessToken!)).data,
    enabled: Boolean(accessToken),
  });
  const requests = useQuery({
    queryKey: ['student-requests', 'mine'],
    queryFn: () =>
      requestApi.getStudentRequests(accessToken!, { page: 1, limit: 50 }),
    enabled: Boolean(accessToken),
  });
  const detail = useQuery({
    queryKey: ['student-requests', 'detail', selectedId],
    queryFn: async () =>
      (await requestApi.getStudentRequest(accessToken!, selectedId!)).data,
    enabled: Boolean(accessToken && selectedId),
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['student-requests', 'mine'] }),
      queryClient.invalidateQueries({
        queryKey: ['student-requests', 'detail'],
      }),
    ]);
  };
  const create = useMutation({
    mutationFn: async () => {
      const created = (
        await requestApi.createStudentRequest(accessToken!, {
          request_type_id: Number(typeId),
          title,
          content,
        })
      ).data;
      for (const file of files) {
        await requestApi.uploadStudentRequestAttachment(
          accessToken!,
          created.id,
          file,
        );
      }
      return (await requestApi.submitStudentRequest(accessToken!, created.id))
        .data;
    },
    onSuccess: async (item) => {
      setTypeId('');
      setTitle('');
      setContent('');
      setFiles([]);
      setSelectedId(item.id);
      setMessage('Đã gửi đơn. Bạn có thể theo dõi trạng thái tại đây.');
      await refresh();
    },
    onError: async (error) => {
      setMessage(
        `${error.message} Bản nháp đã tạo (nếu có) vẫn được giữ để tránh mất dữ liệu.`,
      );
      await refresh();
    },
  });
  const cancel = useMutation({
    mutationFn: (id: number) =>
      requestApi.cancelStudentRequest(accessToken!, id),
    onSuccess: refresh,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const selectedType = types.data?.find((item) => item.id === Number(typeId));
    if (selectedType?.requires_attachment && files.length === 0) {
      setMessage('Loại đơn này yêu cầu ít nhất một tệp minh chứng.');
      return;
    }
    create.mutate();
  }

  return (
    <StudentPortalLayout>
      <div className="grid gap-6">
        <header>
          <p className="text-sm font-semibold text-blue-700">Dịch vụ học sinh</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            Đơn và yêu cầu
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Gửi yêu cầu tới giáo viên chủ nhiệm hoặc bộ phận quản trị và theo dõi
            tiến độ xử lý.
          </p>
        </header>

        <form
          onSubmit={submit}
          className="grid gap-4 border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <FilePlus2 className="h-5 w-5 text-blue-700" />
            <h2 className="font-bold text-slate-950">Tạo yêu cầu mới</h2>
          </div>
          <select
            required
            value={typeId}
            onChange={(event) => setTypeId(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2.5 text-sm"
          >
            <option value="">Chọn loại đơn</option>
            {types.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.requires_attachment ? ' · cần minh chứng' : ''}
              </option>
            ))}
          </select>
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Tiêu đề yêu cầu"
            className="rounded-md border border-slate-300 px-3 py-2.5 text-sm"
          />
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={4}
            placeholder="Nội dung, lý do hoặc thông tin cần nhà trường xử lý"
            className="rounded-md border border-slate-300 px-3 py-2.5 text-sm"
          />
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Tệp minh chứng (tối đa 10 MB mỗi tệp)
            <input
              multiple
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
              onChange={(event) =>
                setFiles(Array.from(event.target.files ?? []))
              }
              className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
            />
          </label>
          {files.length > 0 && (
            <p className="text-xs text-slate-500">
              {files.length} tệp đã chọn: {files.map((file) => file.name).join(', ')}
            </p>
          )}
          <div>
            <button
              disabled={create.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {create.isPending ? 'Đang gửi...' : 'Gửi yêu cầu'}
            </button>
          </div>
          {message && <p className="text-sm text-slate-700">{message}</p>}
        </form>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <section className="border border-slate-200 bg-white shadow-sm">
            <h2 className="border-b border-slate-200 p-4 font-bold text-slate-950">
              Yêu cầu đã gửi
            </h2>
            {requests.isLoading ? (
              <p className="p-6 text-sm text-slate-500">Đang tải...</p>
            ) : requests.data?.data.length ? (
              <div className="divide-y divide-slate-100">
                {requests.data.data.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full p-4 text-left hover:bg-slate-50 ${
                      selectedId === item.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-950">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.request_type_name} ·{' '}
                          {new Date(item.created_at).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-blue-700">
                        {labels[item.status]}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="p-8 text-center text-sm text-slate-500">
                Bạn chưa gửi yêu cầu nào.
              </p>
            )}
          </section>

          <aside className="border border-slate-200 bg-white p-5 shadow-sm">
            {!selectedId ? (
              <p className="text-sm text-slate-500">
                Chọn một yêu cầu để xem nội dung và kết quả.
              </p>
            ) : detail.isLoading ? (
              <p className="text-sm text-slate-500">Đang tải chi tiết...</p>
            ) : detail.data ? (
              <div className="grid gap-4">
                <div>
                  <p className="text-xs font-bold uppercase text-blue-700">
                    {detail.data.request_type_name}
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-950">
                    {detail.data.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {labels[detail.data.status]}
                  </p>
                </div>
                {detail.data.content && (
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {detail.data.content}
                  </p>
                )}
                {detail.data.attachments?.map((attachment) => (
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
                    <Download className="h-4 w-4" /> {attachment.original_name}
                  </button>
                ))}
                {detail.data.decision_reason && (
                  <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                    <strong>Phản hồi:</strong> {detail.data.decision_reason}
                  </div>
                )}
                {['draft', 'pending'].includes(detail.data.status) && (
                  <button
                    type="button"
                    disabled={cancel.isPending}
                    onClick={() => {
                      if (window.confirm('Hủy yêu cầu này?')) {
                        cancel.mutate(detail.data!.id);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-bold text-red-700"
                  >
                    <XCircle className="h-4 w-4" /> Hủy yêu cầu
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-red-700">Không thể tải yêu cầu.</p>
            )}
          </aside>
        </div>
      </div>
    </StudentPortalLayout>
  );
}
