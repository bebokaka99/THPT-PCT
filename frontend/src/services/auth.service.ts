import { apiClient, authHeaders } from './api-client';
import type {
  LoginResponse,
  MeResponse,
  RefreshSessionResponse,
} from '../types/auth';

let restoreSessionRequest: Promise<RefreshSessionResponse> | null = null;

export function login(identifier: string, password: string) {
  return apiClient.post<LoginResponse>('/auth/login', {
    identifier,
    password,
  });
}

export function getMe(token: string) {
  return apiClient.get<MeResponse>('/auth/me', {
    headers: authHeaders(token),
  });
}

export function refreshSession() {
  if (restoreSessionRequest) return restoreSessionRequest;

  restoreSessionRequest = apiClient
    .post<RefreshSessionResponse>('/auth/refresh', undefined, {
      skipAuthRefresh: true,
      suppressErrorToast: true,
    })
    .finally(() => {
      restoreSessionRequest = null;
    });

  return restoreSessionRequest;
}

export function logoutSession() {
  return apiClient.post<void>('/auth/logout', undefined, {
    skipAuthRefresh: true,
    suppressErrorToast: true,
  });
}
