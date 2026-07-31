import { apiClient, authHeaders } from './api-client';
import type { ApiDataResponse, ApiListResponse } from '../types/api';
import type {
  MyProfile,
  ProfileAvatarUploadResult,
  StudentProfile,
  TeacherProfile,
  UpdateMyProfileInput,
} from '../types/profile';

export async function getMyProfile(token: string) {
  const response = await apiClient.get<ApiDataResponse<MyProfile>>('/profiles/me', {
    headers: authHeaders(token),
  });
  return response.data;
}

export async function updateMyProfile(token: string, input: UpdateMyProfileInput) {
  const response = await apiClient.patch<ApiDataResponse<MyProfile>>('/profiles/me', input, {
    headers: authHeaders(token),
  });
  return response.data;
}

export async function uploadProfileAvatar(token: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.upload<
    ApiDataResponse<ProfileAvatarUploadResult>
  >('/profiles/me/avatar', formData, {
    headers: authHeaders(token),
  });
  return response.data;
}

export function getTeacherProfiles(token: string) {
  return apiClient.get<ApiListResponse<TeacherProfile>>('/profiles/teachers', { headers: authHeaders(token) });
}

export function getStudentProfiles(token: string) {
  return apiClient.get<ApiListResponse<StudentProfile>>('/profiles/students', { headers: authHeaders(token) });
}
