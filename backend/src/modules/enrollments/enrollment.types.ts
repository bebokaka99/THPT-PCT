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
  created_at: Date;
  updated_at: Date;
};

export type ListEnrollmentsQuery = {
  page: number;
  limit: number;
  q?: string;
  academic_year_id?: number;
  classroom_id?: number;
  status?: EnrollmentStatus;
};

export type CreateEnrollmentInput = {
  student_user_id: number;
  classroom_id: number;
  enrolled_at: string;
  note?: string | null;
};

export type TransferEnrollmentInput = {
  target_classroom_id: number;
  effective_date: string;
  note?: string | null;
};

export type EndEnrollmentInput = {
  status: Exclude<EnrollmentStatus, 'active' | 'transferred'>;
  effective_date: string;
  note?: string | null;
};
