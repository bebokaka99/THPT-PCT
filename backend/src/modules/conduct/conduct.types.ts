export type ConductRating = 'good' | 'fair' | 'pass' | 'not_pass';
export type ConductStatus = 'draft' | 'submitted' | 'approved' | 'locked';
export type ConductAction =
  | 'create'
  | 'edit'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'lock';

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
  created_by_user_id: number | null;
  submitted_at: Date | null;
  approved_at: Date | null;
  locked_at: Date | null;
  created_at: Date;
  updated_at: Date;
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

export type ConductUpsertInput = {
  semester_id: number;
  rating: ConductRating;
  homeroom_comment: string | null;
};

export type ConductListQuery = {
  classroom_id: number;
  semester_id: number;
};

export type ConductAudit = {
  id: number;
  conduct_record_id: number;
  actor_user_id: number | null;
  actor_name: string | null;
  action: ConductAction;
  old_status: ConductStatus | null;
  new_status: ConductStatus;
  old_rating: ConductRating | null;
  new_rating: ConductRating;
  old_comment: string | null;
  new_comment: string | null;
  reason: string | null;
  revision: number;
  created_at: Date;
};
