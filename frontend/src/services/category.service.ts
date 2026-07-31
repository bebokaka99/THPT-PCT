import { apiClient } from './api-client';
import type { ApiDataResponse, ApiListResponse } from '../types/api';
import type { Category } from '../types/category';

export function getCategories() {
  return apiClient.get<ApiListResponse<Category>>('/categories');
}

export function getCategoryBySlug(slug: string) {
  return apiClient.get<ApiDataResponse<Category>>(`/categories/${slug}`);
}

