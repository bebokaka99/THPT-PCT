import type {
  AcademicPeriodStatus,
  AcademicYear,
  AcademicYearInput,
  ActiveAcademicPeriods,
  Semester,
  SemesterInput,
} from '../types/academic-period';
import type { ApiDataResponse } from '../types/api';
import { apiClient, authHeaders } from './api-client';

export async function getAcademicPeriods(
  token: string,
  status?: AcademicPeriodStatus,
) {
  const response = await apiClient.get<ApiDataResponse<AcademicYear[]>>(
    '/academic-periods',
    { headers: authHeaders(token), params: { status } },
  );
  return response.data;
}

export async function getActiveAcademicPeriods(token: string) {
  const response = await apiClient.get<ApiDataResponse<ActiveAcademicPeriods>>(
    '/academic-periods/active',
    { headers: authHeaders(token) },
  );
  return response.data;
}

export async function createAcademicYear(
  token: string,
  input: AcademicYearInput,
) {
  const response = await apiClient.post<ApiDataResponse<AcademicYear>>(
    '/academic-periods/years',
    input,
    { headers: authHeaders(token) },
  );
  return response.data;
}

export async function updateAcademicYear(
  token: string,
  id: number,
  input: Partial<AcademicYearInput>,
) {
  const response = await apiClient.patch<ApiDataResponse<AcademicYear>>(
    `/academic-periods/years/${id}`,
    input,
    { headers: authHeaders(token) },
  );
  return response.data;
}

export function activateAcademicYear(token: string, id: number) {
  return apiClient.patch<ApiDataResponse<AcademicYear>>(
    `/academic-periods/years/${id}/activate`,
    undefined,
    { headers: authHeaders(token) },
  );
}

export function closeAcademicYear(token: string, id: number) {
  return apiClient.patch<ApiDataResponse<AcademicYear>>(
    `/academic-periods/years/${id}/close`,
    undefined,
    { headers: authHeaders(token) },
  );
}

export function setAcademicYearLock(
  token: string,
  id: number,
  isLocked: boolean,
) {
  return apiClient.patch<ApiDataResponse<AcademicYear>>(
    `/academic-periods/years/${id}/lock`,
    { is_locked: isLocked },
    { headers: authHeaders(token) },
  );
}

export function deleteAcademicYear(token: string, id: number) {
  return apiClient.delete<void>(`/academic-periods/years/${id}`, {
    headers: authHeaders(token),
  });
}

export async function createSemester(
  token: string,
  academicYearId: number,
  input: SemesterInput,
) {
  const response = await apiClient.post<ApiDataResponse<Semester>>(
    `/academic-periods/years/${academicYearId}/semesters`,
    input,
    { headers: authHeaders(token) },
  );
  return response.data;
}

export async function updateSemester(
  token: string,
  id: number,
  input: Partial<SemesterInput>,
) {
  const response = await apiClient.patch<ApiDataResponse<Semester>>(
    `/academic-periods/semesters/${id}`,
    input,
    { headers: authHeaders(token) },
  );
  return response.data;
}

export function activateSemester(token: string, id: number) {
  return apiClient.patch<ApiDataResponse<Semester>>(
    `/academic-periods/semesters/${id}/activate`,
    undefined,
    { headers: authHeaders(token) },
  );
}

export function closeSemester(token: string, id: number) {
  return apiClient.patch<ApiDataResponse<Semester>>(
    `/academic-periods/semesters/${id}/close`,
    undefined,
    { headers: authHeaders(token) },
  );
}

export function setSemesterLock(
  token: string,
  id: number,
  isLocked: boolean,
) {
  return apiClient.patch<ApiDataResponse<Semester>>(
    `/academic-periods/semesters/${id}/lock`,
    { is_locked: isLocked },
    { headers: authHeaders(token) },
  );
}

export function deleteSemester(token: string, id: number) {
  return apiClient.delete<void>(`/academic-periods/semesters/${id}`, {
    headers: authHeaders(token),
  });
}
