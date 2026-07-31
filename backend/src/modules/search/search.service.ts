import { searchPublishedDocuments, searchPublishedPosts } from './search.repository.js';
import type { SearchQuery, SearchResponse } from './search.types.js';

export async function searchSite(query: SearchQuery): Promise<SearchResponse> {
  const response: SearchResponse = {
    query: query.q,
    type: query.type,
  };

  if (query.type === 'all' || query.type === 'posts') {
    response.posts = await searchPublishedPosts(query.q, query.page, query.limit);
  }

  if (query.type === 'all' || query.type === 'documents') {
    response.documents = await searchPublishedDocuments(query.q, query.page, query.limit);
  }

  return response;
}
