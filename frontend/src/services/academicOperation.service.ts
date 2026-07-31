import type {
  AcademicImportJob,
  AcademicImportStatus,
  AcademicImportType,
  AcademicReportSummary,
} from '../types/academic-operation';
import { apiClient, authHeaders } from './api-client';

type ListResponse = {
  data: AcademicImportJob[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export function previewAcademicImport(
  token: string,
  type: AcademicImportType,
  idempotencyKey: string,
  file: File,
) {
  const form = new FormData();
  form.append('type', type);
  form.append('idempotency_key', idempotencyKey);
  form.append('file', file);
  return apiClient.upload<{ data: AcademicImportJob }>(
    '/academic-operations/imports/preview',
    form,
    { headers: authHeaders(token) },
  );
}

export function getAcademicImportJobs(
  token: string,
  params: {
    page?: number;
    limit?: number;
    type?: AcademicImportType;
    status?: AcademicImportStatus;
  } = {},
) {
  return apiClient.get<ListResponse>('/academic-operations/imports', {
    headers: authHeaders(token),
    params,
  });
}

export function getAcademicImportJob(token: string, id: number) {
  return apiClient.get<{ data: AcademicImportJob }>(
    `/academic-operations/imports/${id}`,
    { headers: authHeaders(token) },
  );
}

export function commitAcademicImport(token: string, id: number) {
  return apiClient.post<{ data: AcademicImportJob }>(
    `/academic-operations/imports/${id}/commit`,
    undefined,
    { headers: authHeaders(token) },
  );
}

export function getAcademicReportSummary(
  token: string,
  params: {
    academic_year_id?: number;
    semester_id?: number;
    classroom_id?: number;
    subject_id?: number;
  } = {},
) {
  return apiClient.get<{ data: AcademicReportSummary }>(
    '/academic-operations/reports/summary',
    { headers: authHeaders(token), params },
  );
}

export function downloadAcademicFile(token: string, path: string) {
  return apiClient.download(path, { headers: authHeaders(token) });
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

