import type {
  CurriculumSubject,
  CurriculumSubjectInput,
  Subject,
  SubjectGroup,
  SubjectInput,
} from '../types/subject';
import type {
  ApiDataResponse,
  ApiPaginatedResponse,
} from '../types/api';
import { apiClient, authHeaders } from './api-client';

export function getSubjects(
  token: string,
  query: {
    page?: number;
    limit?: number;
    q?: string;
    subject_group?: SubjectGroup;
    is_active?: boolean;
  } = {},
) {
  return apiClient.get<ApiPaginatedResponse<Subject>>('/subjects', {
    headers: authHeaders(token),
    params: {
      page: query.page ?? 1,
      limit: query.limit ?? 100,
      q: query.q,
      subject_group: query.subject_group,
      is_active: query.is_active,
    },
  });
}

export async function createSubject(token: string, input: SubjectInput) {
  const response = await apiClient.post<ApiDataResponse<Subject>>(
    '/subjects',
    input,
    { headers: authHeaders(token) },
  );
  return response.data;
}

export async function updateSubject(
  token: string,
  id: number,
  input: Partial<Omit<SubjectInput, 'code'>>,
) {
  const response = await apiClient.patch<ApiDataResponse<Subject>>(
    `/subjects/${id}`,
    input,
    { headers: authHeaders(token) },
  );
  return response.data;
}

export function deleteSubject(token: string, id: number) {
  return apiClient.delete<void>(`/subjects/${id}`, {
    headers: authHeaders(token),
  });
}

export function importSubjects(token: string, subjects: SubjectInput[]) {
  return apiClient.post<{ data: Subject[]; total: number }>(
    '/subjects/import',
    { subjects },
    { headers: authHeaders(token) },
  );
}

export async function getCurriculum(
  token: string,
  query: {
    academic_year_id?: number;
    grade_level?: number;
    is_active?: boolean;
  } = {},
) {
  const response = await apiClient.get<
    ApiDataResponse<CurriculumSubject[]>
  >('/subjects/curriculum', {
    headers: authHeaders(token),
    params: query,
  });
  return response.data;
}

export async function createCurriculumSubject(
  token: string,
  input: CurriculumSubjectInput,
) {
  const response = await apiClient.post<
    ApiDataResponse<CurriculumSubject>
  >('/subjects/curriculum', input, { headers: authHeaders(token) });
  return response.data;
}

export async function updateCurriculumSubject(
  token: string,
  id: number,
  input: Partial<
    Pick<
      CurriculumSubjectInput,
      'subject_id' | 'periods_per_week' | 'is_required' | 'is_active'
    >
  >,
) {
  const response = await apiClient.patch<
    ApiDataResponse<CurriculumSubject>
  >(`/subjects/curriculum/${id}`, input, { headers: authHeaders(token) });
  return response.data;
}

export function deleteCurriculumSubject(token: string, id: number) {
  return apiClient.delete<void>(`/subjects/curriculum/${id}`, {
    headers: authHeaders(token),
  });
}

