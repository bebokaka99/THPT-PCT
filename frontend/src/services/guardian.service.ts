import type { ApiDataResponse, ApiListResponse, ApiPaginatedResponse } from '../types/api';
import type {
  GuardianChild,
  GuardianLink,
  GuardianLinkStatus,
  GuardianPreferences,
  GuardianStudentSummary,
} from '../types/guardian';
import { apiClient, authHeaders } from './api-client';

export function getGuardianLinks(
  token: string,
  query: {
    page?: number;
    limit?: number;
    q?: string;
    status?: GuardianLinkStatus;
  } = {},
) {
  return apiClient.get<ApiPaginatedResponse<GuardianLink>>('/guardians/links', {
    headers: authHeaders(token),
    params: { page: 1, limit: 20, ...query },
  });
}

export function inviteGuardianLink(
  token: string,
  input: {
    guardian_user_id: number;
    student_user_id: number;
    relationship: string;
  },
) {
  return apiClient.post<ApiDataResponse<GuardianLink>>('/guardians/links', input, {
    headers: authHeaders(token),
  });
}

export function verifyGuardianLink(token: string, id: number) {
  return apiClient.post<ApiDataResponse<GuardianLink>>(
    `/guardians/links/${id}/verify`,
    {},
    { headers: authHeaders(token) },
  );
}

export function revokeGuardianLink(token: string, id: number, reason?: string) {
  return apiClient.post<ApiDataResponse<GuardianLink>>(
    `/guardians/links/${id}/revoke`,
    { reason },
    { headers: authHeaders(token) },
  );
}

export function getMyGuardianChildren(token: string) {
  return apiClient.get<ApiListResponse<GuardianChild>>('/guardians/me/students', {
    headers: authHeaders(token),
  });
}

export function getGuardianStudentSummary(
  token: string,
  studentId: number,
  semesterId?: number,
) {
  return apiClient.get<ApiDataResponse<GuardianStudentSummary>>(
    `/guardians/me/students/${studentId}/summary`,
    {
      headers: authHeaders(token),
      params: { semester_id: semesterId },
    },
  );
}

export function getGuardianPreferences(token: string) {
  return apiClient.get<ApiDataResponse<GuardianPreferences>>(
    '/guardians/me/preferences',
    { headers: authHeaders(token) },
  );
}

export function updateGuardianPreferences(
  token: string,
  input: Partial<Omit<GuardianPreferences, 'updated_at'>>,
) {
  return apiClient.patch<ApiDataResponse<GuardianPreferences>>(
    '/guardians/me/preferences',
    input,
    { headers: authHeaders(token) },
  );
}
