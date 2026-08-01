import type { ApiDataResponse, ApiPaginatedResponse, ApiListResponse } from '../types/api';
import type { ClassJournal, ClassJournalInput, ClassJournalOption, ClassJournalReport, ClassJournalStatus } from '../types/class-journal';
import { apiClient, authHeaders } from './api-client';

export function getClassJournalOptions(token: string, date: string) {
  return apiClient.get<ApiListResponse<ClassJournalOption>>('/class-journals/options', { headers: authHeaders(token), params: { date } });
}

export function getClassJournals(token: string, query: { page?: number; limit?: number; classroom_id?: number; semester_id?: number; from?: string; to?: string; status?: ClassJournalStatus } = {}) {
  return apiClient.get<ApiPaginatedResponse<ClassJournal>>('/class-journals', { headers: authHeaders(token), params: { page: query.page ?? 1, limit: query.limit ?? 50, ...query } });
}

export function getClassJournal(token: string, id: number) {
  return apiClient.get<ApiDataResponse<ClassJournal>>(`/class-journals/${id}`, { headers: authHeaders(token) });
}

export function createClassJournal(token: string, input: ClassJournalInput) {
  return apiClient.post<ApiDataResponse<ClassJournal>>('/class-journals', input, { headers: authHeaders(token) });
}

export function updateClassJournal(token: string, id: number, input: ClassJournalInput) {
  return apiClient.patch<ApiDataResponse<ClassJournal>>(`/class-journals/${id}`, input, { headers: authHeaders(token) });
}

export function getClassJournalAudit(token: string, id: number) {
  return apiClient.get<ApiDataResponse<Array<Record<string, unknown>>>>(`/class-journals/${id}/audit`, { headers: authHeaders(token) });
}

export function getClassJournalReport(token: string, query: { from: string; to: string; classroom_id?: number; semester_id?: number }) {
  return apiClient.get<ApiDataResponse<ClassJournalReport>>('/class-journals/report', { headers: authHeaders(token), params: query });
}
