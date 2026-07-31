export type GradebookStatus = 'draft' | 'submitted' | 'approved' | 'locked';
export type GradeScoreState = 'scored' | 'absent' | 'exempt';

export type GradebookListQuery = {
  page: number;
  limit: number;
  q?: string;
  classroom_id?: number;
  semester_id?: number;
  status?: GradebookStatus;
};

export type StudentGradeQuery = {
  academic_year_id?: number;
  semester_id?: number;
  subject_id?: number;
};

export type StudentGradeFilterOptions = {
  academic_years: Array<{ id: number; name: string }>;
  semesters: Array<{
    id: number;
    academic_year_id: number;
    name: string;
  }>;
  subjects: Array<{
    id: number;
    code: string;
    name: string;
    academic_year_id: number;
    semester_id: number;
  }>;
};

export type GradebookSummary = {
  id: number;
  teaching_assignment_id: number;
  assessment_configuration_id: number;
  classroom_id: number;
  classroom_name: string;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  semester_id: number;
  semester_name: string;
  academic_year_id: number;
  academic_year_name: string;
  teacher_user_id: number;
  teacher_name: string;
  status: GradebookStatus;
  revision: number;
  submitted_by_user_id: number | null;
  submitted_at: Date | null;
  approved_by_user_id: number | null;
  approved_at: Date | null;
  locked_by_user_id: number | null;
  locked_at: Date | null;
  student_count: number;
  scored_student_count: number;
  created_at: Date;
  updated_at: Date;
};

export type GradebookColumn = {
  id: number;
  gradebook_id: number;
  assessment_category_id: number;
  category_code: string;
  category_name: string;
  entry_index: number;
  label: string;
  max_score: number;
  weight_percent: number;
  sort_order: number;
};

export type GradebookStudent = {
  user_id: number;
  full_name: string;
  student_code: string | null;
};

export type StudentScore = {
  id: number;
  column_id: number;
  student_user_id: number;
  state: GradeScoreState;
  score: number | null;
  version: number;
  updated_at: Date;
};

export type StudentGradeTotal = {
  student_user_id: number;
  is_complete: boolean;
  raw_score: number | null;
  final_score: number | null;
};

export type GradebookDetail = GradebookSummary & {
  configuration: {
    title: string;
    score_scale: number;
    decimal_places: number;
    rounding_mode: 'half_up' | 'half_even' | 'truncate';
  };
  columns: GradebookColumn[];
  students: GradebookStudent[];
  scores: StudentScore[];
  totals: StudentGradeTotal[];
};

export type GradebookCreateInput = {
  teaching_assignment_id: number;
};

export type StudentScoreInput = {
  student_user_id: number;
  column_id: number;
  state: GradeScoreState;
  score: string | null;
  expected_version: number;
};

export type GradebookScoreBatchInput = {
  entries: StudentScoreInput[];
  reason?: string | null;
};

export type GradebookWorkflowAction =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'lock'
  | 'change_request_create'
  | 'change_request_approve'
  | 'change_request_reject';

export type GradebookChangeRequest = {
  id: number;
  gradebook_id: number;
  classroom_name: string;
  subject_name: string;
  teacher_name: string;
  requested_by_user_id: number | null;
  requested_by_name: string | null;
  requested_revision: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by_user_id: number | null;
  reviewed_by_name: string | null;
  review_note: string | null;
  reviewed_at: Date | null;
  created_at: Date;
};

export type GradebookWorkflowAudit = {
  id: number;
  gradebook_id: number;
  change_request_id: number | null;
  actor_user_id: number | null;
  actor_name: string | null;
  action: GradebookWorkflowAction;
  old_status: GradebookStatus;
  new_status: GradebookStatus;
  reason: string | null;
  revision: number;
  created_at: Date;
};

export type StudentPublishedGrade = {
  id: number;
  classroom_name: string;
  academic_year_id: number;
  semester_id: number;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  teacher_name: string;
  semester_name: string;
  academic_year_name: string;
  status: 'approved' | 'locked';
  score_scale: number;
  final_score: number | null;
  approved_at: Date | null;
  locked_at: Date | null;
  scores: Array<{
    column_id: number;
    category_code: string;
    category_name: string;
    entry_index: number;
    label: string;
    max_score: number;
    state: GradeScoreState | 'unscored';
    score: number | null;
  }>;
};

export type StudentScoreAudit = {
  id: number;
  student_score_id: number | null;
  column_id: number;
  column_label: string;
  student_user_id: number;
  student_name: string;
  actor_user_id: number | null;
  actor_name: string | null;
  action: 'insert' | 'update';
  old_state: GradeScoreState | null;
  new_state: GradeScoreState;
  old_score: number | null;
  new_score: number | null;
  old_version: number | null;
  new_version: number;
  reason: string | null;
  changed_at: Date;
};
