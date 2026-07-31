import { apiClient } from './api-client';
import type { ApiDataResponse, ApiPaginatedResponse } from '../types/api';
import type { EventListQuery, SchoolEvent } from '../types/event';

export function getEvents(query: EventListQuery = {}) {
  return apiClient.get<ApiPaginatedResponse<SchoolEvent>>('/events', {
    params: {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      q: query.q,
      status: query.status,
      scope: query.scope ?? 'upcoming',
    },
  });
}

export async function getEventBySlug(slug: string) {
  const response = await apiClient.get<ApiDataResponse<SchoolEvent>>(
    `/events/${slug}`,
  );
  return response.data;
}
