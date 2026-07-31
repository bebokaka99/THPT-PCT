export type TeacherProfile = {
  id: number;
  user_id: number;
  teacher_code: string | null;
  full_name: string;
  department: string | null;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: Date;
  updated_at: Date;
};

export type StudentProfile = {
  id: number;
  user_id: number;
  student_code: string | null;
  full_name: string;
  class_name: string | null;
  date_of_birth: string | null;
  phone: string | null;
  parent_phone: string | null;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
};

export type ProfileKind = 'teacher' | 'student';

export type MyProfileResponse = {
  user: {
    id: number;
    username: string | null;
    email: string | null;
    fullName: string;
    roles: string[];
  };
  profileType: ProfileKind | 'admin' | null;
  profile: TeacherProfile | StudentProfile | null;
};

export type UpdateMyProfileInput = {
  phone?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  parent_phone?: string | null;
};

export type UpsertTeacherProfileInput = {
  user_id: number;
  teacher_code?: string | null;
  full_name: string;
  department?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
};

export type UpsertStudentProfileInput = {
  user_id: number;
  student_code?: string | null;
  full_name: string;
  class_name?: string | null;
  date_of_birth?: string | null;
  phone?: string | null;
  parent_phone?: string | null;
  avatar_url?: string | null;
};
