import { apiClient, authHeaders } from './api-client';
import type { ApiDataResponse, ApiListResponse } from '../types/api';
import type {
  DailyScheduleItem,
  ScheduleOverride,
  ScheduleOverrideInput,
  ScheduleOverrideOptions,
} from '../types/schedule-override';

export function getClassroomDailySchedule(token: string, classroomId: number, date: string) {
  return apiClient.get<ApiDataResponse<{ date: string; data: DailyScheduleItem[] }>>(
    `/schedule-overrides/classrooms/${classroomId}/daily-schedule?date=${encodeURIComponent(date)}`,
    { headers: authHeaders(token) },
  );
}

export function getMyDailySchedule(token: string, date: string) {
  return apiClient.get<ApiDataResponse<{ date: string; data: DailyScheduleItem[] }>>(
    `/schedule-overrides/me?date=${encodeURIComponent(date)}`,
    { headers: authHeaders(token) },
  );
}

export function getGuardianStudentDailySchedule(token: string, studentId: number, date: string) {
  return apiClient.get<ApiDataResponse<{ date: string; data: DailyScheduleItem[] }>>(
    `/schedule-overrides/guardians/students/${studentId}/daily-schedule?date=${encodeURIComponent(date)}`,
    { headers: authHeaders(token) },
  );
}

export function getScheduleOverrideOptions(token: string, classroomId: number, timetableItemId: number) {
  return apiClient.get<ApiDataResponse<ScheduleOverrideOptions>>(
    `/schedule-overrides/classrooms/${classroomId}/options?timetable_item_id=${timetableItemId}`,
    { headers: authHeaders(token) },
  );
}

export function getClassroomOverrides(token: string, classroomId: number, date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiClient.get<ApiListResponse<ScheduleOverride>>(
    `/schedule-overrides/classrooms/${classroomId}${query}`,
    { headers: authHeaders(token) },
  );
}

export function getAdminOverrides(token: string, query?: { date?: string; status?: string }) {
  const params = new URLSearchParams();
  if (query?.date) params.set('date', query.date);
  if (query?.status) params.set('status', query.status);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return apiClient.get<ApiListResponse<ScheduleOverride>>(`/schedule-overrides${suffix}`, {
    headers: authHeaders(token),
  });
}

export function createScheduleOverride(token: string, classroomId: number, input: ScheduleOverrideInput) {
  return apiClient.post<ApiDataResponse<ScheduleOverride>>(`/schedule-overrides/classrooms/${classroomId}`, input, {
    headers: authHeaders(token),
  });
}

export function publishScheduleOverride(token: string, id: number) {
  return apiClient.post<ApiDataResponse<ScheduleOverride>>(`/schedule-overrides/${id}/publish`, {}, {
    headers: authHeaders(token),
  });
}

export function archiveScheduleOverride(token: string, id: number) {
  return apiClient.post<ApiDataResponse<ScheduleOverride>>(`/schedule-overrides/${id}/archive`, {}, {
    headers: authHeaders(token),
  });
}

export function deleteScheduleOverride(token: string, id: number) {
  return apiClient.delete(`/schedule-overrides/${id}`, { headers: authHeaders(token) });
}
