export type ClassroomRole = 'teacher' | 'student';
export type ClassroomContentStatus = 'draft' | 'published' | 'archived';

export type Classroom = {
  id: number;
  name: string;
  school_year: string;
  academic_year_id: number | null;
  grade_level: number | null;
  homeroom_teacher_user_id: number | null;
  description: string | null;
  is_active: boolean;
  member_count?: number;
  student_count?: number;
  teacher_count?: number;
  created_at: Date;
  updated_at: Date;
};

export type ClassroomMember = {
  id: number;
  classroom_id: number;
  user_id: number;
  role: ClassroomRole;
  full_name: string;
  email: string | null;
  membership_source?: 'membership' | 'enrollment';
  enrollment_status?: string | null;
  created_at: Date;
};

export type ClassroomPost = {
  id: number;
  classroom_id: number;
  author_user_id: number;
  author_name?: string;
  title: string;
  content: string | null;
  status: ClassroomContentStatus;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type ClassroomDocument = {
  id: number;
  classroom_id: number;
  author_user_id: number;
  author_name?: string;
  title: string;
  description: string | null;
  file_url: string;
  status: ClassroomContentStatus;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type ListClassroomsQuery = {
  page: number;
  limit: number;
  q?: string;
  school_year?: string;
  is_active?: boolean;
};

export type ClassroomInput = {
  name: string;
  school_year?: string;
  academic_year_id?: number;
  grade_level?: number | null;
  homeroom_teacher_user_id?: number | null;
  description?: string | null;
  is_active?: boolean;
};

export type ResolvedClassroomInput = Omit<
  ClassroomInput,
  'school_year' | 'academic_year_id'
> & {
  school_year: string;
  academic_year_id: number;
};

export type MemberInput = {
  user_id: number;
  role: ClassroomRole;
};

export type ClassroomPostInput = {
  title: string;
  content?: string | null;
  status?: ClassroomContentStatus;
};

export type ClassroomDocumentInput = {
  title: string;
  description?: string | null;
  file_url: string;
  status?: ClassroomContentStatus;
};
