import { apiClient } from './api-client';
import type { ApiDataResponse, ApiPaginatedResponse } from '../types/api';
import type { DocumentListQuery, SchoolDocument } from '../types/document';

export function getDocuments(query: DocumentListQuery = {}) {
  return apiClient.get<ApiPaginatedResponse<SchoolDocument>>('/documents', {
    params: {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      q: query.q,
      category: query.category,
      status: query.status ?? 'published',
    },
  });
}

export async function getDocumentBySlug(slug: string) {
  const response = await apiClient.get<ApiDataResponse<SchoolDocument>>(`/documents/${slug}`);
  return response.data;
}
