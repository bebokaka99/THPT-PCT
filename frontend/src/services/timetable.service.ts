import { apiClient, authHeaders } from './api-client';
import type { ApiListResponse } from '../types/api';
import type { PersonalTeachingTimetableItem } from '../types/classroom';

export function getMyTeachingTimetable(token: string) {
  return apiClient.get<ApiListResponse<PersonalTeachingTimetableItem>>(
    '/timetables/me',
    { headers: authHeaders(token) },
  );
}
