import type {
  AssessmentCalculationResult,
  AssessmentConfiguration,
  AssessmentConfigurationInput,
  AssessmentConfigurationListQuery,
} from '../types/assessment-configuration';
import type {
  ApiDataResponse,
  ApiPaginatedResponse,
} from '../types/api';
import { apiClient, authHeaders } from './api-client';

function params(query: AssessmentConfigurationListQuery) {
  return {
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    q: query.q,
    subject_id: query.subject_id,
    semester_id: query.semester_id,
    grade_level: query.grade_level,
    status: query.status,
  };
}

export function getAssessmentConfigurations(
  token: string,
  query: AssessmentConfigurationListQuery = {},
) {
  return apiClient.get<ApiPaginatedResponse<AssessmentConfiguration>>(
    '/assessment-configurations',
    { headers: authHeaders(token), params: params(query) },
  );
}

export function getMyAssessmentConfigurations(
  token: string,
  query: AssessmentConfigurationListQuery = {},
) {
  return apiClient.get<ApiPaginatedResponse<AssessmentConfiguration>>(
    '/assessment-configurations/me',
    { headers: authHeaders(token), params: params(query) },
  );
}

export async function createAssessmentConfiguration(
  token: string,
  input: AssessmentConfigurationInput,
) {
  const response = await apiClient.post<
    ApiDataResponse<AssessmentConfiguration>
  >('/assessment-configurations', input, { headers: authHeaders(token) });
  return response.data;
}

export async function updateAssessmentConfiguration(
  token: string,
  id: number,
  input: Partial<
    Pick<
      AssessmentConfigurationInput,
      | 'title'
      | 'score_scale'
      | 'decimal_places'
      | 'rounding_mode'
      | 'categories'
    >
  >,
) {
  const response = await apiClient.patch<
    ApiDataResponse<AssessmentConfiguration>
  >(`/assessment-configurations/${id}`, input, {
    headers: authHeaders(token),
  });
  return response.data;
}

export async function createAssessmentConfigurationVersion(
  token: string,
  id: number,
) {
  const response = await apiClient.post<
    ApiDataResponse<AssessmentConfiguration>
  >(`/assessment-configurations/${id}/versions`, undefined, {
    headers: authHeaders(token),
  });
  return response.data;
}

export async function activateAssessmentConfiguration(
  token: string,
  id: number,
) {
  const response = await apiClient.post<
    ApiDataResponse<AssessmentConfiguration>
  >(`/assessment-configurations/${id}/activate`, undefined, {
    headers: authHeaders(token),
  });
  return response.data;
}

export function deleteAssessmentConfiguration(token: string, id: number) {
  return apiClient.delete<void>(`/assessment-configurations/${id}`, {
    headers: authHeaders(token),
  });
}

export async function calculateAssessmentPreview(
  token: string,
  id: number,
  scores: Array<{ category_code: string; values: number[] }>,
) {
  const response = await apiClient.post<
    ApiDataResponse<AssessmentCalculationResult>
  >(`/assessment-configurations/${id}/calculate`, { scores }, {
    headers: authHeaders(token),
  });
  return response.data;
}
