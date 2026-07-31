export type EnrollmentStatus =
  | 'active'
  | 'transferred'
  | 'reserved'
  | 'withdrawn'
  | 'graduated';

export type StudentEnrollment = {
  id: number;
  student_user_id: number;
  student_code: string | null;
  username: string | null;
  email: string | null;
  full_name: string;
  classroom_id: number;
  classroom_name: string;
  academic_year_id: number;
  academic_year_name: string;
  status: EnrollmentStatus;
  enrolled_at: string;
  ended_at: string | null;
  previous_enrollment_id: number | null;
  note: string | null;
  created_by_user_id: number | null;
  created_at: string;
  updated_at: string;
};

export type EnrollmentListQuery = {
  page?: number;
  limit?: number;
  q?: string;
  academic_year_id?: number;
  classroom_id?: number;
  status?: EnrollmentStatus;
};
