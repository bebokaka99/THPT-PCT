import { apiClient, authHeaders } from './api-client';
import type { ApiDataResponse, ApiPaginatedResponse } from '../types/api';
import type {
  DocumentFormInput,
  DocumentListQuery,
  SchoolDocument,
} from '../types/document';

export function getAdminDocuments(token: string, query: DocumentListQuery = {}) {
  return apiClient.get<ApiPaginatedResponse<SchoolDocument>>('/documents', {
    headers: authHeaders(token),
    params: {
      page: query.page ?? 1,
      limit: query.limit ?? 50,
      q: query.q,
      category: query.category,
      status: query.status ?? 'all',
    },
  });
}

export async function getAdminDocumentById(token: string, id: number) {
  const response = await apiClient.get<ApiDataResponse<SchoolDocument>>(`/documents/admin/${id}`, {
    headers: authHeaders(token),
  });

  return response.data;
}

export function createAdminDocument(token: string, input: DocumentFormInput) {
  return apiClient.post<ApiDataResponse<SchoolDocument>>('/documents', input, {
    headers: authHeaders(token),
  });
}

export function updateAdminDocument(token: string, id: number, input: Partial<DocumentFormInput>) {
  return apiClient.patch<ApiDataResponse<SchoolDocument>>(`/documents/${id}`, input, {
    headers: authHeaders(token),
  });
}

export function deleteAdminDocument(token: string, id: number) {
  return apiClient.delete<void>(`/documents/${id}`, {
    headers: authHeaders(token),
  });
}

export function publishAdminDocument(token: string, id: number) {
  return apiClient.patch<ApiDataResponse<SchoolDocument>>(`/documents/${id}/publish`, undefined, {
    headers: authHeaders(token),
  });
}

export function archiveAdminDocument(token: string, id: number) {
  return apiClient.patch<ApiDataResponse<SchoolDocument>>(`/documents/${id}/archive`, undefined, {
    headers: authHeaders(token),
  });
}

export function restoreAdminDocument(token: string, id: number) {
  return apiClient.patch<ApiDataResponse<SchoolDocument>>(`/documents/${id}/restore`, undefined, {
    headers: authHeaders(token),
  });
}
