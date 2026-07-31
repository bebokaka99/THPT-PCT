export type ConductRating = 'good' | 'fair' | 'pass' | 'not_pass';
export type ConductStatus = 'draft' | 'submitted' | 'approved' | 'locked';

export type ConductRecord = {
  id: number;
  student_user_id: number;
  student_code: string | null;
  student_name: string;
  classroom_id: number;
  classroom_name: string;
  semester_id: number;
  semester_name: string;
  academic_year_id: number;
  academic_year_name: string;
  rating: ConductRating;
  homeroom_comment: string | null;
  status: ConductStatus;
  revision: number;
  submitted_at: string | null;
  approved_at: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ConductRosterItem = {
  student_user_id: number;
  student_code: string | null;
  student_name: string;
  attendance_summary: {
    present: number;
    excused: number;
    unexcused: number;
    late: number;
  };
  record: ConductRecord | null;
};

export type ConductAudit = {
  id: number;
  actor_name: string | null;
  action: 'create' | 'edit' | 'submit' | 'approve' | 'reject' | 'lock';
  old_status: ConductStatus | null;
  new_status: ConductStatus;
  old_rating: ConductRating | null;
  new_rating: ConductRating;
  reason: string | null;
  revision: number;
  created_at: string;
};
