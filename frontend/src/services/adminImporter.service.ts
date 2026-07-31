import { apiClient, authHeaders } from './api-client';
import type { ApiDataResponse, ApiPaginatedResponse } from '../types/api';
import type {
  ConvertImportedContentResponse,
  ImportedContentDetail,
  ImportedContentListItem,
  ImportedContentQuery,
  ImportStatus,
} from '../types/importer';

export function getImportedContents(token: string, query: ImportedContentQuery = {}) {
  return apiClient.get<ApiPaginatedResponse<ImportedContentListItem>>('/importer/imported-contents', {
    headers: authHeaders(token),
    params: {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      q: query.q,
      status: query.status === 'all' ? undefined : query.status,
      category: query.category,
    },
  });
}

export async function getImportedContentById(token: string, id: number) {
  const response = await apiClient.get<ApiDataResponse<ImportedContentDetail>>(
    `/importer/imported-contents/${id}`,
    {
      headers: authHeaders(token),
    },
  );

  return response.data;
}

export function updateImportedContentStatus(token: string, id: number, status: Exclude<ImportStatus, 'error'>) {
  return apiClient.patch<ApiDataResponse<ImportedContentDetail>>(
    `/importer/imported-contents/${id}/status`,
    { status },
    {
      headers: authHeaders(token),
    },
  );
}

export function convertImportedContentToPost(token: string, id: number) {
  return apiClient.post<ApiDataResponse<ConvertImportedContentResponse>>(
    `/importer/imported-contents/${id}/convert-to-post`,
    { status: 'draft' },
    {
      headers: authHeaders(token),
    },
  );
}
