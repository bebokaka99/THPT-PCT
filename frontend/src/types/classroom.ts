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
  created_at: string;
  updated_at: string;
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
  created_at: string;
};

export type ClassroomPost = {
  id: number;
  classroom_id: number;
  author_user_id: number;
  author_name?: string;
  title: string;
  content: string | null;
  status: ClassroomContentStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
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
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TimetableItem = {
  id?: number;
  timetable_id?: number;
  subject_id?: number | null;
  teaching_assignment_id?: number | null;
  teacher_user_id?: number | null;
  shift_id: number;
  shift_code?: string;
  shift_name?: string;
  day_of_week: number;
  lesson_index: number;
  subject_name: string;
  teacher_name?: string | null;
  room?: string | null;
  note?: string | null;
  created_at?: string;
};

export type Timetable = {
  id: number;
  classroom_id: number;
  school_year: string;
  semester: string | null;
  academic_year_id: number | null;
  semester_id: number | null;
  title: string;
  status: 'draft' | 'published' | 'archived';
  version_number: number;
  is_active: boolean;
  published_at: string | null;
  published_by_user_id: number | null;
  created_by_user_id: number | null;
  created_at: string;
  updated_at: string;
  items: TimetableItem[];
};

export type PersonalTeachingTimetableItem = TimetableItem & {
  classroom_id: number;
  classroom_name: string;
  school_year: string;
  semester: string | null;
  timetable_title: string;
};

export type TimetableInput = {
  school_year?: string;
  semester?: string | null;
  academic_year_id?: number;
  semester_id?: number | null;
  title: string;
  status?: 'draft' | 'published' | 'archived';
  is_active?: boolean;
  items: TimetableItem[];
};

export type BellPeriod = {
  id?: number;
  shift_id?: number;
  period_index: number;
  starts_at: string;
  ends_at: string;
  sort_order: number;
};

export type SchoolShift = {
  id: number;
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  periods: BellPeriod[];
};

export type TimetableConflict = {
  type: 'teacher' | 'classroom' | 'room';
  day_of_week: number;
  shift_id: number;
  shift_name: string;
  lesson_index: number;
  teacher_name: string | null;
  room: string | null;
  conflicting_classroom_id: number;
  conflicting_classroom_name: string;
  message: string;
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

export type ClassroomListQuery = {
  page?: number;
  limit?: number;
  q?: string;
  school_year?: string;
  is_active?: boolean;
};
