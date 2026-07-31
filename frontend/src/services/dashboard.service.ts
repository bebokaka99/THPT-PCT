import { apiClient, authHeaders } from './api-client';
import type { ApiDataResponse } from '../types/api';
import type { DashboardOverview } from '../types/dashboard';

export async function getAdminDashboardOverview(token: string) {
  const response = await apiClient.get<ApiDataResponse<DashboardOverview>>(
    '/dashboard/overview',
    { headers: authHeaders(token) },
  );
  return response.data;
}
