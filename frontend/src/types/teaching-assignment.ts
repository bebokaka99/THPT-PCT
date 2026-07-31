export type TeachingAssignmentRole = 'primary' | 'assistant';
export type TeachingAssignmentStatus = 'active' | 'inactive';

export type TeachingAssignment = {
  id: number;
  teacher_user_id: number;
  teacher_name: string;
  teacher_email: string | null;
  classroom_id: number;
  classroom_name: string;
  grade_level: number;
  academic_year_id: number;
  academic_year_name: string;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  semester_id: number;
  semester_name: string;
  semester_code: string;
  role: TeachingAssignmentRole;
  status: TeachingAssignmentStatus;
  assigned_at: string;
  ended_at: string | null;
  note: string | null;
  created_by_user_id: number | null;
  created_at: string;
  updated_at: string;
};

export type TeachingAssignmentInput = {
  teacher_user_id: number;
  classroom_id: number;
  subject_id: number;
  semester_id: number;
  role: TeachingAssignmentRole;
  assigned_at: string;
  note?: string | null;
};

export type TeachingAssignmentListQuery = {
  page?: number;
  limit?: number;
  q?: string;
  teacher_user_id?: number;
  classroom_id?: number;
  subject_id?: number;
  semester_id?: number;
  status?: TeachingAssignmentStatus;
};
