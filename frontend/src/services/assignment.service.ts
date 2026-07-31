import type {
  ApiDataResponse,
  ApiListResponse,
  ApiPaginatedResponse,
} from '../types/api';
import type {
  Assignment,
  AssignmentDetail,
  AssignmentInput,
  AssignmentListQuery,
  AssignmentSubmission,
  AssignmentRosterItem,
  AssignmentUpdateInput,
  SubmissionReviewInput,
} from '../types/assignment';
import { apiClient, authHeaders } from './api-client';

export function getAssignments(
  token: string,
  query: AssignmentListQuery = {},
) {
  return apiClient.get<ApiPaginatedResponse<Assignment>>('/assignments', {
    headers: authHeaders(token),
    params: {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      q: query.q,
      classroom_id: query.classroom_id,
      subject_id: query.subject_id,
      semester_id: query.semester_id,
      status: query.status,
    },
  });
}

export function getAssignment(token: string, id: number) {
  return apiClient.get<ApiDataResponse<AssignmentDetail>>(`/assignments/${id}`, {
    headers: authHeaders(token),
  });
}

export function createAssignment(token: string, input: AssignmentInput) {
  return apiClient.post<ApiDataResponse<Assignment>>('/assignments', input, {
    headers: authHeaders(token),
  });
}

export function updateAssignment(
  token: string,
  id: number,
  input: AssignmentUpdateInput,
) {
  return apiClient.patch<ApiDataResponse<Assignment>>(
    `/assignments/${id}`,
    input,
    { headers: authHeaders(token) },
  );
}

export function publishAssignment(token: string, id: number) {
  return apiClient.post<ApiDataResponse<Assignment>>(
    `/assignments/${id}/publish`,
    undefined,
    { headers: authHeaders(token) },
  );
}

export function closeAssignment(token: string, id: number) {
  return apiClient.post<ApiDataResponse<Assignment>>(
    `/assignments/${id}/close`,
    undefined,
    { headers: authHeaders(token) },
  );
}

export function deleteAssignment(token: string, id: number) {
  return apiClient.delete<void>(`/assignments/${id}`, {
    headers: authHeaders(token),
  });
}

export function getAssignmentSubmissions(token: string, id: number) {
  return apiClient.get<ApiListResponse<AssignmentRosterItem>>(
    `/assignments/${id}/submissions`,
    { headers: authHeaders(token) },
  );
}

export function submitAssignment(
  token: string,
  id: number,
  input: { file?: File; note?: string; content_text?: string; link_url?: string },
) {
  const formData = new FormData();
  if (input.file) formData.append('file', input.file);
  if (input.note?.trim()) formData.append('note', input.note.trim());
  if (input.content_text?.trim()) formData.append('content_text', input.content_text.trim());
  if (input.link_url?.trim()) formData.append('link_url', input.link_url.trim());
  return apiClient.upload<ApiDataResponse<AssignmentSubmission>>(
    `/assignments/${id}/submissions`,
    formData,
    { headers: authHeaders(token) },
  );
}

export function reviewSubmission(
  token: string,
  assignmentId: number,
  submissionId: number,
  input: SubmissionReviewInput,
) {
  return apiClient.patch<ApiDataResponse<AssignmentSubmission>>(
    `/assignments/${assignmentId}/submissions/${submissionId}/review`,
    input,
    { headers: authHeaders(token) },
  );
}

export function downloadSubmissionFile(
  token: string,
  assignmentId: number,
  submissionId: number,
  fileId: number,
) {
  return apiClient.download(
    `/assignments/${assignmentId}/submissions/${submissionId}/files/${fileId}/download`,
    { headers: authHeaders(token) },
  );
}

export function getGuardianAssignments(
  token: string,
  studentId: number,
  query: AssignmentListQuery = {},
) {
  return apiClient.get<ApiPaginatedResponse<Assignment>>(
    `/assignments/guardian/students/${studentId}`,
    {
      headers: authHeaders(token),
      params: { page: query.page ?? 1, limit: query.limit ?? 20, status: query.status },
    },
  );
}
