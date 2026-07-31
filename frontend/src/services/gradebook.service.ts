import type {
  GradebookDetail,
  GradebookChangeRequest,
  GradebookScoreInput,
  GradebookStatus,
  GradebookSummary,
  GradebookWorkflowAudit,
  StudentPublishedGrade,
} from '../types/gradebook';
import type {
  ApiDataResponse,
  ApiListResponse,
  ApiPaginatedResponse,
} from '../types/api';
import { apiClient, authHeaders } from './api-client';

export function getGradebooks(
  token: string,
  query: { page?: number; limit?: number; q?: string; status?: GradebookStatus } = {},
) {
  return apiClient.get<ApiPaginatedResponse<GradebookSummary>>('/gradebooks', {
    headers: authHeaders(token),
    params: {
      page: query.page ?? 1,
      limit: query.limit ?? 50,
      q: query.q,
      status: query.status,
    },
  });
}

export function createGradebook(token: string, teachingAssignmentId: number) {
  return apiClient.post<ApiDataResponse<GradebookDetail>>(
    '/gradebooks',
    { teaching_assignment_id: teachingAssignmentId },
    { headers: authHeaders(token) },
  );
}

export function getGradebook(token: string, id: number) {
  return apiClient.get<ApiDataResponse<GradebookDetail>>(`/gradebooks/${id}`, {
    headers: authHeaders(token),
  });
}

export function saveGradebookScores(
  token: string,
  id: number,
  entries: GradebookScoreInput[],
  reason?: string,
) {
  return apiClient.put<ApiDataResponse<GradebookDetail>>(
    `/gradebooks/${id}/scores`,
    { entries, reason },
    { headers: authHeaders(token) },
  );
}

export function getMyGrades(token: string) {
  return apiClient.get<ApiListResponse<StudentPublishedGrade>>('/gradebooks/me', {
    headers: authHeaders(token),
  });
}

function workflowAction(
  token: string,
  id: number,
  action: 'submit' | 'approve' | 'reject' | 'lock',
  reason?: string,
) {
  return apiClient.post<ApiDataResponse<GradebookSummary>>(
    `/gradebooks/${id}/${action}`,
    { reason },
    { headers: authHeaders(token) },
  );
}

export const submitGradebook = (token: string, id: number, reason?: string) =>
  workflowAction(token, id, 'submit', reason);
export const approveGradebook = (token: string, id: number, reason?: string) =>
  workflowAction(token, id, 'approve', reason);
export const rejectGradebook = (token: string, id: number, reason: string) =>
  workflowAction(token, id, 'reject', reason);
export const lockGradebook = (token: string, id: number, reason?: string) =>
  workflowAction(token, id, 'lock', reason);

export function createGradebookChangeRequest(
  token: string,
  id: number,
  reason: string,
) {
  return apiClient.post<ApiDataResponse<GradebookChangeRequest>>(
    `/gradebooks/${id}/change-requests`,
    { reason },
    { headers: authHeaders(token) },
  );
}

export function getGradebookChangeRequests(token: string) {
  return apiClient.get<ApiListResponse<GradebookChangeRequest>>(
    '/gradebooks/change-requests',
    { headers: authHeaders(token) },
  );
}

export function reviewGradebookChangeRequest(
  token: string,
  requestId: number,
  decision: 'approve' | 'reject',
  reason: string,
) {
  return apiClient.post<ApiDataResponse<GradebookChangeRequest>>(
    `/gradebooks/change-requests/${requestId}/${decision}`,
    { reason },
    { headers: authHeaders(token) },
  );
}

export function getGradebookWorkflowAudit(token: string, id: number) {
  return apiClient.get<ApiListResponse<GradebookWorkflowAudit>>(
    `/gradebooks/${id}/workflow-audit`,
    { headers: authHeaders(token) },
  );
}
