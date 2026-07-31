import { apiClient, authHeaders } from './api-client';
import type { ApiListResponse } from '../types/api';
import type { Role } from '../types/role';

export function getAdminRoles(token: string) {
  return apiClient.get<ApiListResponse<Role>>('/roles', {
    headers: authHeaders(token),
  });
}
