import { apiClient, authHeaders } from './api-client';
import type { ApiDataResponse, ApiListResponse } from '../types/api';
import type { Category, CategoryFormInput } from '../types/category';

export function getAdminCategories() {
  return apiClient.get<ApiListResponse<Category>>('/categories');
}

export function getAllAdminCategories(token: string) {
  return apiClient.get<ApiListResponse<Category>>('/categories/admin/all', {
    headers: authHeaders(token),
  });
}

export function createAdminCategory(token: string, input: CategoryFormInput) {
  return apiClient.post<ApiDataResponse<Category>>('/categories', input, {
    headers: authHeaders(token),
  });
}

export function updateAdminCategory(token: string, id: number, input: CategoryFormInput) {
  return apiClient.patch<ApiDataResponse<Category>>(`/categories/${id}`, input, {
    headers: authHeaders(token),
  });
}

export function deleteAdminCategory(token: string, id: number) {
  return apiClient.delete<void>(`/categories/${id}`, {
    headers: authHeaders(token),
  });
}
