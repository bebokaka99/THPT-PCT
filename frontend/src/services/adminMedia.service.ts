import { apiClient, authHeaders } from './api-client';
import type { ApiDataResponse, ApiPaginatedResponse } from '../types/api';
import type { MediaFile, MediaListQuery } from '../types/media';

export async function uploadMedia(token: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient.upload<ApiDataResponse<MediaFile>>('/media/upload', formData, {
    headers: authHeaders(token),
  });
}

export async function getAdminMedia(token: string, query: MediaListQuery = {}) {
  return apiClient.get<ApiPaginatedResponse<MediaFile>>('/media', {
    headers: authHeaders(token),
    params: {
      type: query.type ?? 'all',
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    },
  });
}

export async function deleteAdminMedia(token: string, id: number) {
  return apiClient.delete<void>(`/media/${id}`, {
    headers: authHeaders(token),
  });
}
