import type {
  AttendanceRecord,
  AttendanceSession,
  AttendanceSessionDetail,
  AttendanceStatus,
  ClassroomAttendanceSummary,
  StudentAttendanceRecord,
  AttendanceSummary,
} from '../types/attendance';
import type {
  ApiDataResponse,
  ApiPaginatedResponse,
} from '../types/api';
import { apiClient, authHeaders } from './api-client';

export function getAttendanceSessions(
  token: string,
  query: {
    page?: number;
    limit?: number;
    classroom_id?: number;
    semester_id?: number;
    from?: string;
    to?: string;
  } = {},
) {
  return apiClient.get<ApiPaginatedResponse<AttendanceSession>>(
    '/attendance/sessions',
    {
      headers: authHeaders(token),
      params: { page: 1, limit: 50, ...query },
    },
  );
}

export async function getAttendanceSession(token: string, id: number) {
  const response = await apiClient.get<
    ApiDataResponse<AttendanceSessionDetail>
  >(`/attendance/sessions/${id}`, { headers: authHeaders(token) });
  return response.data;
}

export async function createAttendanceSession(
  token: string,
  input: {
    classroom_id: number;
    semester_id: number;
    subject_id?: number;
    teaching_assignment_id?: number;
    session_date: string;
    lesson_index: number;
    title?: string;
  },
) {
  const response = await apiClient.post<
    ApiDataResponse<AttendanceSessionDetail>
  >('/attendance/sessions', input, { headers: authHeaders(token) });
  return response.data;
}

export async function saveAttendanceRecords(
  token: string,
  sessionId: number,
  records: Array<
    Pick<AttendanceRecord, 'student_user_id' | 'status' | 'note'>
  >,
  correctionReason?: string,
) {
  const response = await apiClient.put<
    ApiDataResponse<AttendanceSessionDetail>
  >(
    `/attendance/sessions/${sessionId}/records`,
    {
      records,
      correction_reason: correctionReason || undefined,
    },
    { headers: authHeaders(token) },
  );
  return response.data;
}

export function getAttendanceAudit(token: string, sessionId: number) {
  return apiClient.get<ApiDataResponse<Array<Record<string, unknown>>>>(
    `/attendance/sessions/${sessionId}/audit`,
    { headers: authHeaders(token) },
  );
}

export function getMyAttendance(token: string, semesterId?: number) {
  return apiClient.get<{
    data: StudentAttendanceRecord[];
    summary: AttendanceSummary;
  }>('/attendance/me', {
    headers: authHeaders(token),
    params: { semester_id: semesterId },
  });
}

export async function getClassroomAttendanceSummary(
  token: string,
  classroomId: number,
  semesterId?: number,
) {
  const response = await apiClient.get<
    ApiDataResponse<ClassroomAttendanceSummary[]>
  >(`/attendance/summary/classrooms/${classroomId}`, {
    headers: authHeaders(token),
    params: { semester_id: semesterId },
  });
  return response.data;
}

export const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  present: 'Có mặt',
  excused: 'Vắng có phép',
  unexcused: 'Vắng không phép',
  late: 'Đi trễ',
};

