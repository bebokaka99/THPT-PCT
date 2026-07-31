import { apiClient, authHeaders } from './api-client';
import type {
  ApiDataResponse,
  ApiListResponse,
  ApiPaginatedResponse,
} from '../types/api';
import type {
  EnrollmentListQuery,
  EnrollmentStatus,
  StudentEnrollment,
} from '../types/enrollment';

export function getEnrollments(
  token: string,
  query: EnrollmentListQuery = {},
) {
  return apiClient.get<ApiPaginatedResponse<StudentEnrollment>>(
    '/enrollments',
    {
      headers: authHeaders(token),
      params: {
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        q: query.q,
        academic_year_id: query.academic_year_id,
        classroom_id: query.classroom_id,
        status: query.status,
      },
    },
  );
}

export function getMyEnrollments(token: string) {
  return apiClient.get<ApiListResponse<StudentEnrollment>>('/enrollments/me', {
    headers: authHeaders(token),
  });
}

export function getStudentEnrollmentHistory(
  token: string,
  studentUserId: number,
) {
  return apiClient.get<ApiListResponse<StudentEnrollment>>(
    `/enrollments/students/${studentUserId}`,
    { headers: authHeaders(token) },
  );
}

export function createEnrollment(
  token: string,
  input: {
    student_user_id: number;
    classroom_id: number;
    enrolled_at: string;
    note?: string;
  },
) {
  return apiClient.post<ApiDataResponse<StudentEnrollment>>(
    '/enrollments',
    input,
    { headers: authHeaders(token) },
  );
}

export function transferEnrollment(
  token: string,
  id: number,
  input: {
    target_classroom_id: number;
    effective_date: string;
    note?: string;
  },
) {
  return apiClient.post<ApiDataResponse<StudentEnrollment>>(
    `/enrollments/${id}/transfer`,
    input,
    { headers: authHeaders(token) },
  );
}

export function endEnrollment(
  token: string,
  id: number,
  input: {
    status: Exclude<EnrollmentStatus, 'active' | 'transferred'>;
    effective_date: string;
    note?: string;
  },
) {
  return apiClient.patch<ApiDataResponse<StudentEnrollment>>(
    `/enrollments/${id}/status`,
    input,
    { headers: authHeaders(token) },
  );
}
