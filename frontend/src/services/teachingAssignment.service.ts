import type {
  TeachingAssignment,
  TeachingAssignmentInput,
  TeachingAssignmentListQuery,
  TeachingAssignmentRole,
  TeachingAssignmentStatus,
} from '../types/teaching-assignment';
import type {
  ApiDataResponse,
  ApiPaginatedResponse,
} from '../types/api';
import { apiClient, authHeaders } from './api-client';

function listParams(query: TeachingAssignmentListQuery) {
  return {
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    q: query.q,
    teacher_user_id: query.teacher_user_id,
    classroom_id: query.classroom_id,
    subject_id: query.subject_id,
    semester_id: query.semester_id,
    status: query.status,
  };
}

export function getTeachingAssignments(
  token: string,
  query: TeachingAssignmentListQuery = {},
) {
  return apiClient.get<ApiPaginatedResponse<TeachingAssignment>>(
    '/teaching-assignments',
    {
      headers: authHeaders(token),
      params: listParams(query),
    },
  );
}

export function getMyTeachingAssignments(
  token: string,
  query: TeachingAssignmentListQuery = {},
) {
  return apiClient.get<ApiPaginatedResponse<TeachingAssignment>>(
    '/teaching-assignments/me',
    {
      headers: authHeaders(token),
      params: listParams(query),
    },
  );
}

export function createTeachingAssignment(
  token: string,
  input: TeachingAssignmentInput,
) {
  return apiClient.post<ApiDataResponse<TeachingAssignment>>(
    '/teaching-assignments',
    input,
    { headers: authHeaders(token) },
  );
}

export function createTeachingAssignmentsBulk(
  token: string,
  assignments: TeachingAssignmentInput[],
) {
  return apiClient.post<{ data: TeachingAssignment[]; total: number }>(
    '/teaching-assignments/bulk',
    { assignments },
    { headers: authHeaders(token) },
  );
}

export function updateTeachingAssignment(
  token: string,
  id: number,
  input: { role?: TeachingAssignmentRole; note?: string | null },
) {
  return apiClient.patch<ApiDataResponse<TeachingAssignment>>(
    `/teaching-assignments/${id}`,
    input,
    { headers: authHeaders(token) },
  );
}

export function setTeachingAssignmentStatus(
  token: string,
  id: number,
  status: TeachingAssignmentStatus,
  effectiveDate: string,
) {
  return apiClient.patch<ApiDataResponse<TeachingAssignment>>(
    `/teaching-assignments/${id}/status`,
    { status, effective_date: effectiveDate },
    { headers: authHeaders(token) },
  );
}
