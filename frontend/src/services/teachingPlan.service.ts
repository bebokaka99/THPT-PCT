import type { ApiDataResponse, ApiPaginatedResponse } from '../types/api';
import type { TeachingPlan, TeachingPlanInput, TeachingPlanOptions, TeachingPlanStatus, TeachingPlanSummary } from '../types/teaching-plan';
import { apiClient, authHeaders } from './api-client';

export function getTeachingPlans(token: string, query: { page?: number; limit?: number; q?: string; status?: TeachingPlanStatus } = {}) {
  return apiClient.get<ApiPaginatedResponse<TeachingPlan>>('/teaching-plans', {
    headers: authHeaders(token), params: { page: query.page ?? 1, limit: query.limit ?? 30, q: query.q, status: query.status },
  });
}

export function getTeachingPlanOptions(token: string) {
  return apiClient.get<ApiDataResponse<TeachingPlanOptions>>('/teaching-plans/options', { headers: authHeaders(token) });
}

export function getTeachingPlanSummary(token: string) {
  return apiClient.get<ApiDataResponse<TeachingPlanSummary>>('/teaching-plans/summary', { headers: authHeaders(token) });
}

export function createTeachingPlan(token: string, input: TeachingPlanInput) {
  return apiClient.post<ApiDataResponse<TeachingPlan>>('/teaching-plans', input, { headers: authHeaders(token) });
}

export function updateTeachingPlan(token: string, id: number, input: Omit<TeachingPlanInput, 'teaching_assignment_id'>) {
  return apiClient.patch<ApiDataResponse<TeachingPlan>>(`/teaching-plans/${id}`, input, { headers: authHeaders(token) });
}

export function submitTeachingPlan(token: string, id: number) {
  return apiClient.post<ApiDataResponse<TeachingPlan>>(`/teaching-plans/${id}/submit`, undefined, { headers: authHeaders(token) });
}

export function approveTeachingPlan(token: string, id: number, comment?: string) {
  return apiClient.post<ApiDataResponse<TeachingPlan>>(`/teaching-plans/${id}/approve`, { comment: comment || null }, { headers: authHeaders(token) });
}

export function rejectTeachingPlan(token: string, id: number, comment: string) {
  return apiClient.post<ApiDataResponse<TeachingPlan>>(`/teaching-plans/${id}/reject`, { comment }, { headers: authHeaders(token) });
}

export function archiveTeachingPlan(token: string, id: number) {
  return apiClient.post<ApiDataResponse<TeachingPlan>>(`/teaching-plans/${id}/archive`, undefined, { headers: authHeaders(token) });
}

export function deleteTeachingPlan(token: string, id: number) {
  return apiClient.delete<void>(`/teaching-plans/${id}`, { headers: authHeaders(token) });
}
