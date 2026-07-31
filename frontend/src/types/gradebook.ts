export type GradeScoreState = 'scored' | 'absent' | 'exempt';

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
  student_count: number;
  scored_student_count: number;
  created_at: string;
  updated_at: string;
  submitted_by_user_id: number | null;
  submitted_at: string | null;
  approved_by_user_id: number | null;
  approved_at: string | null;
  locked_by_user_id: number | null;
  locked_at: string | null;
};

export type GradebookStatus = 'draft' | 'submitted' | 'approved' | 'locked';

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
  updated_at: string;
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
  totals: Array<{
    student_user_id: number;
    is_complete: boolean;
    raw_score: number | null;
    final_score: number | null;
  }>;
};

export type GradebookScoreInput = {
  student_user_id: number;
  column_id: number;
  state: GradeScoreState;
  score: string | null;
  expected_version: number;
};

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
  reviewed_at: string | null;
  created_at: string;
};

export type GradebookWorkflowAudit = {
  id: number;
  gradebook_id: number;
  change_request_id: number | null;
  actor_user_id: number | null;
  actor_name: string | null;
  action:
    | 'submit'
    | 'approve'
    | 'reject'
    | 'lock'
    | 'change_request_create'
    | 'change_request_approve'
    | 'change_request_reject';
  old_status: GradebookStatus;
  new_status: GradebookStatus;
  reason: string | null;
  revision: number;
  created_at: string;
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
  approved_at: string | null;
  locked_at: string | null;
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

export type StudentPublishedGradesResponse = {
  data: StudentPublishedGrade[];
  filters: StudentGradeFilterOptions;
};
