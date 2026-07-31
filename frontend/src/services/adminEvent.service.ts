import { apiClient, authHeaders } from './api-client';
import type { ApiDataResponse, ApiPaginatedResponse } from '../types/api';
import type {
  EventFormInput,
  EventListQuery,
  SchoolEvent,
} from '../types/event';

export function getAdminEvents(token: string, query: EventListQuery = {}) {
  return apiClient.get<ApiPaginatedResponse<SchoolEvent>>('/events/admin', {
    headers: authHeaders(token),
    params: {
      page: query.page ?? 1,
      limit: query.limit ?? 50,
      q: query.q,
      status: query.status,
      scope: query.scope ?? 'all',
    },
  });
}

export async function getAdminEventById(token: string, id: number) {
  const response = await apiClient.get<ApiDataResponse<SchoolEvent>>(
    `/events/admin/${id}`,
    { headers: authHeaders(token) },
  );
  return response.data;
}

export function createAdminEvent(token: string, input: EventFormInput) {
  return apiClient.post<ApiDataResponse<SchoolEvent>>('/events', input, {
    headers: authHeaders(token),
  });
}

export function updateAdminEvent(
  token: string,
  id: number,
  input: Partial<EventFormInput>,
) {
  return apiClient.patch<ApiDataResponse<SchoolEvent>>(`/events/${id}`, input, {
    headers: authHeaders(token),
  });
}

function eventAction(token: string, id: number, action: string) {
  return apiClient.patch<ApiDataResponse<SchoolEvent>>(
    `/events/${id}/${action}`,
    undefined,
    { headers: authHeaders(token) },
  );
}

export const publishAdminEvent = (token: string, id: number) =>
  eventAction(token, id, 'publish');
export const hideAdminEvent = (token: string, id: number) =>
  eventAction(token, id, 'hide');
export const cancelAdminEvent = (token: string, id: number) =>
  eventAction(token, id, 'cancel');
export const completeAdminEvent = (token: string, id: number) =>
  eventAction(token, id, 'complete');

export function deleteAdminEvent(token: string, id: number) {
  return apiClient.delete<void>(`/events/${id}`, {
    headers: authHeaders(token),
  });
}
