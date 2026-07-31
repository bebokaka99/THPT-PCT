import { apiClient, authHeaders } from './api-client';
import type { ApiPaginatedResponse } from '../types/api';
import type { NotificationListQuery, UserNotification } from '../types/notification';

export function getMyNotifications(token: string, query: NotificationListQuery = {}) {
  return apiClient.get<ApiPaginatedResponse<UserNotification>>('/notifications/me', {
    headers: authHeaders(token),
    params: {
      page: query.page ?? 1,
      limit: query.limit ?? 5,
      unread: query.unread,
    },
  });
}

export function getUnreadNotificationCount(token: string) {
  return apiClient.get<{ count: number }>('/notifications/me/unread-count', { headers: authHeaders(token) });
}

export function markNotificationRead(token: string, id: number) {
  return apiClient.patch<void>(`/notifications/me/${id}/read`, undefined, { headers: authHeaders(token) });
}

export function markAllNotificationsRead(token: string) {
  return apiClient.patch<void>('/notifications/me/read-all', undefined, { headers: authHeaders(token) });
}
