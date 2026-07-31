import { apiClient, authHeaders } from './api-client';
import type { ApiDataResponse, ApiListResponse } from '../types/api';
import type { PersonalTeachingTimetableItem, SchoolShift } from '../types/classroom';

export function getMyTeachingTimetable(token: string) {
  return apiClient.get<ApiListResponse<PersonalTeachingTimetableItem>>(
    '/timetables/me',
    { headers: authHeaders(token) },
  );
}

export function getSchoolShifts(token: string) {
  return apiClient.get<ApiListResponse<SchoolShift>>('/timetables/shifts', {
    headers: authHeaders(token),
  });
}

export function createSchoolShift(
  token: string,
  input: Pick<SchoolShift, 'code' | 'name' | 'sort_order' | 'is_active' | 'periods'>,
) {
  return apiClient.post<ApiDataResponse<SchoolShift>>('/timetables/shifts', input, {
    headers: authHeaders(token),
  });
}

export function updateSchoolShift(
  token: string,
  id: number,
  input: Pick<SchoolShift, 'code' | 'name' | 'sort_order' | 'is_active' | 'periods'>,
) {
  return apiClient.patch<ApiDataResponse<SchoolShift>>(`/timetables/shifts/${id}`, input, {
    headers: authHeaders(token),
  });
}
