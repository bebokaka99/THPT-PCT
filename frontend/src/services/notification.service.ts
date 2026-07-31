import { apiClient, authHeaders } from './api-client';
import type { ApiPaginatedResponse } from '../types/api';
import type { CommunicationOptions, CreateNotificationInput, NotificationListQuery, NotificationReport, UserNotification } from '../types/notification';

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

export function acknowledgeNotification(token: string, id: number) {
  return apiClient.patch<void>(`/notifications/me/${id}/acknowledge`, undefined, { headers: authHeaders(token) });
}

export function getCommunicationOptions(token: string) {
  return apiClient.get<{ data: CommunicationOptions }>('/notifications/options', { headers: authHeaders(token) });
}

export function createNotification(token: string, input: CreateNotificationInput) {
  return apiClient.post<{ data: UserNotification }>('/notifications', input, { headers: authHeaders(token) });
}

export function getSentNotifications(token: string, query: { page?: number; limit?: number } = {}) {
  return apiClient.get<ApiPaginatedResponse<UserNotification>>('/notifications', {
    headers: authHeaders(token),
    params: { page: query.page ?? 1, limit: query.limit ?? 20 },
  });
}

export function getNotificationReport(token: string, id: number) {
  return apiClient.get<{ data: NotificationReport }>(`/notifications/${id}/report`, { headers: authHeaders(token) });
}
