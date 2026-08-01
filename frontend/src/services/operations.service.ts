import { apiClient, authHeaders } from './api-client';
import type { ApiDataResponse } from '../types/api';
import type { OperationalHealth } from '../types/operations';

export async function getOperationalHealth(token: string) {
  const response = await apiClient.get<ApiDataResponse<OperationalHealth>>(
    '/operations/health',
    { headers: authHeaders(token) },
  );
  return response.data;
}
