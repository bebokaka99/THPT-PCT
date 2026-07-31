import { apiClient, authHeaders } from './api-client';
import type { ApiDataResponse, ApiListResponse, ApiPaginatedResponse } from '../types/api';
import type {
  Classroom,
  ClassroomContentStatus,
  ClassroomDocument,
  ClassroomInput,
  ClassroomListQuery,
  ClassroomMember,
  ClassroomPost,
  ClassroomRole,
  Timetable,
  TimetableInput,
} from '../types/classroom';

export function getClassrooms(token: string, query: ClassroomListQuery = {}) {
  return apiClient.get<ApiPaginatedResponse<Classroom>>('/classrooms', {
    headers: authHeaders(token),
    params: {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      q: query.q,
      school_year: query.school_year,
      is_active: query.is_active,
    },
  });
}

export async function getClassroomDetail(token: string, id: number) {
  const response = await apiClient.get<ApiDataResponse<Classroom>>(`/classrooms/${id}`, { headers: authHeaders(token) });
  return response.data;
}

export function createClassroom(token: string, input: ClassroomInput) {
  return apiClient.post<ApiDataResponse<Classroom>>('/classrooms', input, { headers: authHeaders(token) });
}

export function updateClassroom(token: string, id: number, input: ClassroomInput) {
  return apiClient.patch<ApiDataResponse<Classroom>>(`/classrooms/${id}`, input, { headers: authHeaders(token) });
}

export function deleteClassroom(token: string, id: number) {
  return apiClient.delete<void>(`/classrooms/${id}`, { headers: authHeaders(token) });
}

export function getClassroomMembers(token: string, id: number) {
  return apiClient.get<ApiListResponse<ClassroomMember>>(`/classrooms/${id}/members`, { headers: authHeaders(token) });
}

export function addClassroomMember(token: string, id: number, user_id: number, role: ClassroomRole) {
  return apiClient.post<ApiListResponse<ClassroomMember>>(`/classrooms/${id}/members`, { user_id, role }, { headers: authHeaders(token) });
}

export function removeClassroomMember(
  token: string,
  id: number,
  memberId: number,
  role?: ClassroomRole,
) {
  return apiClient.delete<void>(`/classrooms/${id}/members/${memberId}`, {
    headers: authHeaders(token),
    params: { role },
  });
}

export function getClassroomPosts(token: string, id: number) {
  return apiClient.get<ApiListResponse<ClassroomPost>>(`/classrooms/${id}/posts`, { headers: authHeaders(token) });
}

export function createClassroomPost(token: string, id: number, input: { title: string; content?: string; status?: ClassroomContentStatus }) {
  return apiClient.post<ApiDataResponse<ClassroomPost>>(`/classrooms/${id}/posts`, input, { headers: authHeaders(token) });
}

export function updateClassroomPost(
  token: string,
  id: number,
  postId: number,
  input: { title?: string; content?: string; status?: ClassroomContentStatus },
) {
  return apiClient.patch<ApiDataResponse<ClassroomPost>>(`/classrooms/${id}/posts/${postId}`, input, { headers: authHeaders(token) });
}

export function deleteClassroomPost(token: string, id: number, postId: number) {
  return apiClient.delete<void>(`/classrooms/${id}/posts/${postId}`, { headers: authHeaders(token) });
}

export function publishClassroomPost(token: string, id: number, postId: number) {
  return apiClient.patch<ApiDataResponse<ClassroomPost>>(`/classrooms/${id}/posts/${postId}/publish`, undefined, { headers: authHeaders(token) });
}

export function archiveClassroomPost(token: string, id: number, postId: number) {
  return apiClient.patch<ApiDataResponse<ClassroomPost>>(`/classrooms/${id}/posts/${postId}/archive`, undefined, { headers: authHeaders(token) });
}

export function getClassroomDocuments(token: string, id: number) {
  return apiClient.get<ApiListResponse<ClassroomDocument>>(`/classrooms/${id}/documents`, { headers: authHeaders(token) });
}

export function createClassroomDocument(token: string, id: number, input: { title: string; description?: string; file_url: string; status?: ClassroomContentStatus }) {
  return apiClient.post<ApiDataResponse<ClassroomDocument>>(`/classrooms/${id}/documents`, input, { headers: authHeaders(token) });
}

export function updateClassroomDocument(
  token: string,
  id: number,
  documentId: number,
  input: { title?: string; description?: string; file_url?: string; status?: ClassroomContentStatus },
) {
  return apiClient.patch<ApiDataResponse<ClassroomDocument>>(`/classrooms/${id}/documents/${documentId}`, input, { headers: authHeaders(token) });
}

export function deleteClassroomDocument(token: string, id: number, documentId: number) {
  return apiClient.delete<void>(`/classrooms/${id}/documents/${documentId}`, { headers: authHeaders(token) });
}

export function publishClassroomDocument(token: string, id: number, documentId: number) {
  return apiClient.patch<ApiDataResponse<ClassroomDocument>>(`/classrooms/${id}/documents/${documentId}/publish`, undefined, { headers: authHeaders(token) });
}

export function archiveClassroomDocument(token: string, id: number, documentId: number) {
  return apiClient.patch<ApiDataResponse<ClassroomDocument>>(`/classrooms/${id}/documents/${documentId}/archive`, undefined, { headers: authHeaders(token) });
}

export function getClassroomTimetable(token: string, id: number) {
  return apiClient.get<ApiDataResponse<Timetable | null>>(`/classrooms/${id}/timetable`, { headers: authHeaders(token) });
}

export function createClassroomTimetable(token: string, id: number, input: TimetableInput) {
  return apiClient.post<ApiDataResponse<Timetable>>(`/classrooms/${id}/timetable`, input, { headers: authHeaders(token) });
}

export function updateClassroomTimetable(token: string, id: number, timetableId: number, input: TimetableInput) {
  return apiClient.patch<ApiDataResponse<Timetable>>(`/classrooms/${id}/timetable/${timetableId}`, input, { headers: authHeaders(token) });
}

export function deleteClassroomTimetable(token: string, id: number, timetableId: number) {
  return apiClient.delete<void>(`/classrooms/${id}/timetable/${timetableId}`, { headers: authHeaders(token) });
}
