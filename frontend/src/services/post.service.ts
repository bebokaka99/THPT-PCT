import { apiClient } from './api-client';
import type { ApiDataResponse, ApiPaginatedResponse } from '../types/api';
import type { Post, PostListQuery } from '../types/post';

export function getPosts(query: PostListQuery = {}) {
  return apiClient.get<ApiPaginatedResponse<Post>>('/posts', {
    params: {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      categorySlug: query.categorySlug,
      q: query.q,
      status: query.status ?? 'published',
    },
  });
}

export function getPostBySlug(slug: string) {
  return apiClient.get<ApiDataResponse<Post>>(`/posts/${slug}`);
}

