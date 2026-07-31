export type TeacherProfile = {
  id: number;
  user_id: number;
  teacher_code: string | null;
  full_name: string;
  department: string | null;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at?: string;
  updated_at?: string;
};

export type StudentProfile = {
  id: number;
  user_id: number;
  student_code: string | null;
  full_name: string;
  class_name: string | null;
  date_of_birth: string | null;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  permanent_address: string | null;
  avatar_url: string | null;
  created_at?: string;
  updated_at?: string;
};

export type MyProfile = {
  user: {
    id: number;
    username: string | null;
    email: string | null;
    fullName: string;
    roles: string[];
  };
  profileType: 'teacher' | 'student' | 'admin' | null;
  profile: TeacherProfile | StudentProfile | null;
};

export type UpdateMyProfileInput = {
  phone?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  permanent_address?: string | null;
};

export type ProfileAvatarUploadResult = {
  profile: MyProfile;
  media: MediaFile;
};
import type { MediaFile } from './media';
