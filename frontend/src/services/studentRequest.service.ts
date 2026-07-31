import { apiClient, authHeaders } from './api-client';
import type {
  StudentRequest,
  StudentRequestHistory,
  StudentRequestListResponse,
  StudentRequestStatus,
  StudentRequestType,
  StudentRequestTypeInput,
} from '../types/student-request';

type DataResponse<T> = { data: T };

export function getStudentRequestTypes(token: string) {
  return apiClient.get<DataResponse<StudentRequestType[]>>(
    '/student-requests/types',
    { headers: authHeaders(token) },
  );
}

export function createStudentRequestType(
  token: string,
  input: StudentRequestTypeInput,
) {
  return apiClient.post<DataResponse<StudentRequestType>>(
    '/student-requests/types',
    input,
    { headers: authHeaders(token) },
  );
}

export function getStudentRequests(
  token: string,
  params: {
    page?: number;
    limit?: number;
    q?: string;
    status?: StudentRequestStatus | '';
    type_id?: number;
  } = {},
) {
  return apiClient.get<StudentRequestListResponse>('/student-requests', {
    headers: authHeaders(token),
    params,
  });
}

export function getStudentRequest(token: string, id: number) {
  return apiClient.get<DataResponse<StudentRequest>>(
    `/student-requests/${id}`,
    { headers: authHeaders(token) },
  );
}

export function createStudentRequest(
  token: string,
  input: {
    request_type_id: number;
    title: string;
    content: string;
    form_data?: Record<string, unknown>;
  },
) {
  return apiClient.post<DataResponse<StudentRequest>>(
    '/student-requests',
    input,
    { headers: authHeaders(token) },
  );
}

export function uploadStudentRequestAttachment(
  token: string,
  id: number,
  file: File,
) {
  const form = new FormData();
  form.append('file', file);
  return apiClient.upload<DataResponse<unknown>>(
    `/student-requests/${id}/attachments`,
    form,
    { headers: authHeaders(token) },
  );
}

function transition(token: string, id: number, action: string, body?: unknown) {
  return apiClient.post<DataResponse<StudentRequest>>(
    `/student-requests/${id}/${action}`,
    body,
    { headers: authHeaders(token) },
  );
}

export const submitStudentRequest = (token: string, id: number) =>
  transition(token, id, 'submit');
export const cancelStudentRequest = (token: string, id: number) =>
  transition(token, id, 'cancel');
export const startStudentRequestReview = (token: string, id: number) =>
  transition(token, id, 'start-review');
export const approveStudentRequest = (
  token: string,
  id: number,
  reason: string,
) => transition(token, id, 'approve', { reason });
export const rejectStudentRequest = (
  token: string,
  id: number,
  reason: string,
) => transition(token, id, 'reject', { reason });

export function getStudentRequestHistory(token: string, id: number) {
  return apiClient.get<DataResponse<StudentRequestHistory[]>>(
    `/student-requests/${id}/history`,
    { headers: authHeaders(token) },
  );
}

export async function downloadStudentRequestAttachment(
  token: string,
  attachment: { download_url: string; original_name: string },
) {
  const path = attachment.download_url.replace(/^\/api/, '');
  const blob = await apiClient.download(path, {
    headers: authHeaders(token),
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = attachment.original_name;
  anchor.click();
  URL.revokeObjectURL(url);
}
