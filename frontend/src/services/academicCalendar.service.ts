import type { ApiDataResponse, ApiListResponse, ApiPaginatedResponse } from '../types/api';
import type {
  AcademicCalendarConflict,
  AcademicCalendarEntry,
  AcademicCalendarInput,
  AcademicCalendarListQuery,
} from '../types/academic-calendar';
import { apiClient, authHeaders } from './api-client';

export function getAcademicCalendar(token: string, query: AcademicCalendarListQuery = {}) {
  return apiClient.get<ApiPaginatedResponse<AcademicCalendarEntry>>('/academic-calendar', {
    headers: authHeaders(token), params: { page: query.page ?? 1, limit: query.limit ?? 100, ...query },
  });
}

export function getAcademicCalendarEntry(token: string, id: number, studentId?: number) {
  return apiClient.get<ApiDataResponse<AcademicCalendarEntry>>(`/academic-calendar/${id}`, {
    headers: authHeaders(token), params: { student_id: studentId },
  });
}

export function createAcademicCalendarEntry(token: string, input: AcademicCalendarInput) {
  return apiClient.post<ApiDataResponse<AcademicCalendarEntry>>('/academic-calendar', input, { headers: authHeaders(token) });
}

export function updateAcademicCalendarEntry(token: string, id: number, input: Partial<AcademicCalendarInput>) {
  return apiClient.patch<ApiDataResponse<AcademicCalendarEntry>>(`/academic-calendar/${id}`, input, { headers: authHeaders(token) });
}

export function previewAcademicCalendarConflicts(token: string, input: AcademicCalendarInput, excludeId?: number) {
  return apiClient.post<ApiListResponse<AcademicCalendarConflict>>('/academic-calendar/conflicts', input, {
    headers: authHeaders(token), params: { exclude_id: excludeId },
  });
}

export function publishAcademicCalendarEntry(token: string, id: number) {
  return apiClient.post<ApiDataResponse<AcademicCalendarEntry>>(`/academic-calendar/${id}/publish`, undefined, { headers: authHeaders(token) });
}

export function archiveAcademicCalendarEntry(token: string, id: number) {
  return apiClient.post<ApiDataResponse<AcademicCalendarEntry>>(`/academic-calendar/${id}/archive`, undefined, { headers: authHeaders(token) });
}

export function deleteAcademicCalendarEntry(token: string, id: number) {
  return apiClient.delete<void>(`/academic-calendar/${id}`, { headers: authHeaders(token) });
}
