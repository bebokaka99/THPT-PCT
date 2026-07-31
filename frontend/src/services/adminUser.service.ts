import { apiClient, authHeaders } from './api-client';
import type { ApiDataResponse, ApiPaginatedResponse } from '../types/api';
import type {
  AdminUser,
  BulkStudentAccountsResponse,
  BulkStudentInput,
  UserFormInput,
  UserListQuery,
  UserStatus,
} from '../types/user';

export function getAdminUsers(token: string, query: UserListQuery = {}) {
  return apiClient.get<ApiPaginatedResponse<AdminUser>>('/users', {
    headers: authHeaders(token),
    params: {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      q: query.q,
      role: query.role,
      status: query.status ?? 'all',
    },
  });
}

export async function getAdminUserById(token: string, id: number) {
  const response = await apiClient.get<ApiDataResponse<AdminUser>>(`/users/${id}`, {
    headers: authHeaders(token),
  });

  return response.data;
}

export function createAdminUser(token: string, input: UserFormInput) {
  return apiClient.post<ApiDataResponse<AdminUser>>('/users', input, {
    headers: authHeaders(token),
  });
}

export function updateAdminUser(token: string, id: number, input: Partial<UserFormInput>) {
  return apiClient.patch<ApiDataResponse<AdminUser>>(`/users/${id}`, input, {
    headers: authHeaders(token),
  });
}

export function updateAdminUserStatus(token: string, id: number, status: UserStatus) {
  return apiClient.patch<ApiDataResponse<AdminUser>>(
    `/users/${id}/status`,
    { status },
    {
      headers: authHeaders(token),
    },
  );
}

export function updateAdminUserRoles(token: string, id: number, roles: string[]) {
  return apiClient.patch<ApiDataResponse<AdminUser>>(
    `/users/${id}/roles`,
    { roles },
    {
      headers: authHeaders(token),
    },
  );
}

export function bulkCreateStudentAccounts(
  token: string,
  input: { cohort: string; classroom_id?: number; students: BulkStudentInput[] },
) {
  return apiClient.post<{ data: BulkStudentAccountsResponse }>('/users/students/bulk', input, {
    headers: authHeaders(token),
  });
}
