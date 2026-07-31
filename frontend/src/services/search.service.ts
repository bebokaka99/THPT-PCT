import { apiClient } from './api-client';
import type { SearchResponse, SearchSiteQuery } from '../types/search';

export function searchSite(query: SearchSiteQuery) {
  return apiClient.get<SearchResponse>('/search', {
    params: {
      q: query.q,
      type: query.type ?? 'all',
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    },
  });
}
