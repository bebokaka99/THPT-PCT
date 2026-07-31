import type { ApiDataResponse, ApiListResponse } from '../types/api';
import type {
  ConductAudit,
  ConductRating,
  ConductRecord,
  ConductRosterItem,
} from '../types/conduct';
import { apiClient, authHeaders } from './api-client';

export function getConductRoster(
  token: string,
  classroomId: number,
  semesterId: number,
) {
  return apiClient.get<ApiListResponse<ConductRosterItem>>('/conduct', {
    headers: authHeaders(token),
    params: { classroom_id: classroomId, semester_id: semesterId },
  });
}

export function saveStudentConduct(
  token: string,
  studentId: number,
  input: {
    semester_id: number;
    rating: ConductRating;
    homeroom_comment: string | null;
  },
) {
  return apiClient.put<ApiDataResponse<ConductRecord>>(
    `/conduct/students/${studentId}`,
    input,
    { headers: authHeaders(token) },
  );
}

function conductWorkflow(
  token: string,
  id: number,
  action: 'submit' | 'approve' | 'reject' | 'lock',
  reason?: string,
) {
  return apiClient.post<ApiDataResponse<ConductRecord>>(
    `/conduct/${id}/${action}`,
    { reason },
    { headers: authHeaders(token) },
  );
}

export const submitConduct = (token: string, id: number) =>
  conductWorkflow(token, id, 'submit');
export const approveConduct = (token: string, id: number) =>
  conductWorkflow(token, id, 'approve');
export const rejectConduct = (token: string, id: number, reason: string) =>
  conductWorkflow(token, id, 'reject', reason);
export const lockConduct = (token: string, id: number) =>
  conductWorkflow(token, id, 'lock');

export function getConductAudit(token: string, id: number) {
  return apiClient.get<ApiListResponse<ConductAudit>>(`/conduct/${id}/audit`, {
    headers: authHeaders(token),
  });
}
