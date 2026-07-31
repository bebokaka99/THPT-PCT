import type { ApiDataResponse, ApiListResponse } from '../types/api';
import type { StudentTranscript, TranscriptClassStudent } from '../types/transcript';
import { apiClient, authHeaders } from './api-client';

export function getMyTranscript(token: string, semesterId?: number) {
  return apiClient.get<ApiDataResponse<StudentTranscript>>('/transcripts/me', {
    headers: authHeaders(token),
    params: { semester_id: semesterId },
  });
}

export function getStudentTranscript(
  token: string,
  studentId: number,
  semesterId?: number,
) {
  return apiClient.get<ApiDataResponse<StudentTranscript>>(
    `/transcripts/students/${studentId}`,
    {
      headers: authHeaders(token),
      params: { semester_id: semesterId },
    },
  );
}

export function getClassroomTranscripts(
  token: string,
  classroomId: number,
  semesterId: number,
) {
  return apiClient.get<ApiListResponse<TranscriptClassStudent>>(
    `/transcripts/classrooms/${classroomId}`,
    {
      headers: authHeaders(token),
      params: { semester_id: semesterId },
    },
  );
}

export function generateSemesterTranscriptSnapshots(
  token: string,
  semesterId: number,
) {
  return apiClient.post<
    ApiDataResponse<{ semester_id: number; created: number; total_students: number }>
  >(
    `/transcripts/semesters/${semesterId}/snapshot`,
    undefined,
    { headers: authHeaders(token) },
  );
}
