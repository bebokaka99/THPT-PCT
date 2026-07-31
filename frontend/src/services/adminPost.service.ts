import { apiClient, authHeaders } from './api-client';
import type { ApiDataResponse, ApiPaginatedResponse } from '../types/api';
import type { Post, PostFormInput, PostListQuery, PostStatus } from '../types/post';

const validPostStatuses = new Set<PostStatus>(['draft', 'published', 'archived']);

function normalizePostStatus(status: unknown): PostStatus {
  if (status === undefined || status === null || status === '') {
    return 'draft';
  }

  if (typeof status === 'string' && validPostStatuses.has(status as PostStatus)) {
    return status as PostStatus;
  }

  console.warn('[adminPost.service] Invalid post status. Falling back to draft.', {
    receivedStatus: status,
  });

  return 'draft';
}

function sanitizePostInput(input: Partial<PostFormInput>): Partial<PostFormInput> {
  return {
    title: input.title,
    slug: input.slug,
    excerpt: input.excerpt,
    content: input.content,
    category_id: input.category_id,
    status: input.status === undefined ? undefined : normalizePostStatus(input.status),
    cover_image_url: input.cover_image_url,
    post_images: input.post_images,
  };
}

export function getAdminPosts(token: string, query: PostListQuery = {}) {
  return apiClient.get<ApiPaginatedResponse<Post>>('/posts', {
    headers: authHeaders(token),
    params: {
      page: query.page ?? 1,
      limit: query.limit ?? 50,
      categorySlug: query.categorySlug,
      q: query.q,
      status: query.status ?? 'all',
    },
  });
}

export async function getAdminPostById(token: string, id: number) {
  const response = await apiClient.get<ApiDataResponse<Post>>(`/posts/admin/${id}`, {
    headers: authHeaders(token),
  });

  return response.data;
}

export function createAdminPost(token: string, input: PostFormInput) {
  return apiClient.post<ApiDataResponse<Post>>('/posts', sanitizePostInput(input), {
    headers: authHeaders(token),
  });
}

export function updateAdminPost(token: string, id: number, input: Partial<PostFormInput>) {
  return apiClient.patch<ApiDataResponse<Post>>(`/posts/${id}`, sanitizePostInput(input), {
    headers: authHeaders(token),
  });
}

export function deleteAdminPost(token: string, id: number) {
  return apiClient.delete<void>(`/posts/${id}`, {
    headers: authHeaders(token),
  });
}

export function publishAdminPost(token: string, id: number) {
  return apiClient.patch<ApiDataResponse<Post>>(`/posts/${id}/publish`, undefined, {
    headers: authHeaders(token),
  });
}

export function archiveAdminPost(token: string, id: number) {
  return apiClient.patch<ApiDataResponse<Post>>(`/posts/${id}/archive`, undefined, {
    headers: authHeaders(token),
  });
}

export function restoreAdminPost(token: string, id: number) {
  return apiClient.patch<ApiDataResponse<Post>>(`/posts/${id}/restore`, undefined, {
    headers: authHeaders(token),
  });
}
